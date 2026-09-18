import json
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.project import (
    DEFAULT_PROJECT_TYPES,
    DEFAULT_PROJECT_TYPES_JSON,
    DEFAULT_SUBTASK_TEMPLATE,
    ETC_SUBTASK_TEMPLATE,
    INSPECTION_SUBTASK_TEMPLATE,
    MajorProject,
    Project,
    STATUS_COMPLETED,
    STATUS_IN_PROGRESS,
    STATUS_PLANNED,
    SubProject,
    project_participants,
    subproject_assignees,
)
from app.models.progress_log import ProgressLog
from app.models.time_entry import STAGE_LABELS, SubProjectTimeEntry
from app.models.user import User
from app.models.workflow import ProjectExecutionHistory, WORKLOG_RUNNING, WorkLog
from app.schemas.project import (
    HistoryStageMinutes,
    MajorProjectResponse,
    ProjectHistoryEntry,
    ProjectResponse,
)


# ?꾨줈?앺듃 ?좏삎 ???몃? ?쒖뒪???쒗뵆由?留ㅽ븨
_TEMPLATE_BY_TYPE = {
    "official_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "regular_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "change_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "etc_task": ETC_SUBTASK_TEMPLATE,
    "general": DEFAULT_SUBTASK_TEMPLATE,
}


# ?낅뜲?댄듃 ??怨듯넻?쇰줈 蹂듭궗??KEFICO ?꾨뱶 紐⑸줉
_KEFICO_COPY_FIELDS = (
    "priority", "controller_name", "controller_version", "controller_country",
    "to_number", "to_assignee", "verification_level", "vehicle_type",
    "function_name", "function_owner", "verifier_id", "reviewer_id", "inreviewer_id",
    "seat_no", "controller_no", "avg_expected_minutes", "issue_note",
    "upload_done", "special_note", "completed_on",
    "first_verify_status", "first_setup_min", "first_aud_min", "first_review_min",
    "inreview_status", "inreview_setup_min", "inreview_aud_min", "inreview_feedback_min",
    "cr_no", "ip_addr", "change_feedback_min", "change_revalidate_min", "lin_std_hold_note",
    "etc_category", "etc_month", "etc_days", "etc_note",
    "weight",
)


# ========== helpers ==========

def _recalc_status_and_progress(sp: SubProject) -> None:
    total_weight = sum(float(t.weight) for t in sp.subtasks) or 1.0
    done_weight = sum(float(t.weight) for t in sp.subtasks if t.is_done)
    sp.progress = round(done_weight / total_weight * 100, 2)

    if sp.progress >= 100:
        sp.status = STATUS_COMPLETED
    elif done_weight > 0:
        sp.status = STATUS_IN_PROGRESS
    else:
        sp.status = STATUS_PLANNED


def _recalc_status_and_progress_from_logs(
    db: Session,
    sp: SubProject,
) -> None:
    progress_user_ids = set(
        db.scalars(
            select(ProgressLog.user_id)
            .where(ProgressLog.subproject_id == sp.id)
            .distinct()
        ).all()
    )
    progress_owner_ids = sorted(_subproject_assignee_ids(sp) | progress_user_ids)
    if not progress_owner_ids:
        sp.progress = 0
        sp.status = STATUS_PLANNED
        return

    logs = db.scalars(
        select(ProgressLog)
        .where(
            ProgressLog.subproject_id == sp.id,
            ProgressLog.user_id.in_(progress_owner_ids),
        )
        .order_by(
            ProgressLog.user_id.asc(),
            ProgressLog.work_date.desc(),
            ProgressLog.id.desc(),
        )
    ).all()
    latest_by_user: dict[int, int] = {}
    for log in logs:
        if log.user_id not in latest_by_user:
            latest_by_user[log.user_id] = log.progress_percent

    per_assignee_share = 100 / len(progress_owner_ids)
    contributed_progress = sum(
        per_assignee_share * (latest_by_user.get(user_id, 0) / 100)
        for user_id in progress_owner_ids
    )
    sp.progress = round(contributed_progress, 2)
    if sp.progress >= 100:
        sp.status = STATUS_COMPLETED
    elif sp.progress > 0:
        sp.status = STATUS_IN_PROGRESS
    else:
        sp.status = STATUS_PLANNED


def _has_subproject_progress_logs(db: Session, subproject_id: int) -> bool:
    return (
        db.scalar(
            select(ProgressLog.id)
            .where(ProgressLog.subproject_id == subproject_id)
            .limit(1)
        )
        is not None
    )


def _load_subproject(db: Session, subproject_id: int) -> SubProject:
    sp = db.scalar(
        select(SubProject)
        .options(
            selectinload(SubProject.subtasks),
            selectinload(SubProject.assignee),
            selectinload(SubProject.assignees),
            selectinload(SubProject.verifier),
            selectinload(SubProject.reviewer),
            selectinload(SubProject.inreviewer),
            selectinload(SubProject.verifiers),
            selectinload(SubProject.reviewers),
            selectinload(SubProject.inreviewers),
            selectinload(SubProject.creator),
        )
        .where(SubProject.id == subproject_id)
    )
    if not sp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?뚰봽濡쒖젥?몃? 李얠쓣 ???놁뒿?덈떎.",
        )
    return sp


def _subproject_assignee_ids(sp: SubProject) -> set[int]:
    ids = {user.id for user in (sp.assignees or [])}
    if sp.assignee_id is not None:
        ids.add(sp.assignee_id)
    return ids


def _payload_assignee_ids(payload) -> list[int] | None:
    if "assignee_ids" in payload.model_fields_set:
        return list(dict.fromkeys(payload.assignee_ids or []))
    if "assignee_id" in payload.model_fields_set and payload.assignee_id is not None:
        return [payload.assignee_id]
    return None


def _load_valid_assignees(
    db: Session,
    project: Project | None,
    assignee_ids: list[int],
    allow_empty: bool = False,
    keep_ids: set[int] | None = None,
) -> list[User]:
    """keep_ids 는 이미 이 하위 프로젝트에 배정돼 있던 담당자 id 다.
    퇴사해서 비활성이 되었어도 기존 배정은 유지한다."""
    # B-83: 담당자를 비운 채로 하위 프로젝트를 만들고 나중에 지정할 수 있다.
    if not assignee_ids:
        if allow_empty:
            return []
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?대떦?먮? 1紐??댁긽 ?좏깮?댁＜?몄슂.",
        )

    keep_ids = keep_ids or set()
    active_or_kept = User.is_active.is_(True)
    if keep_ids:
        active_or_kept = or_(active_or_kept, User.id.in_(keep_ids))
    assignees = db.scalars(
        select(User)
        .where(User.id.in_(assignee_ids), active_or_kept)
        .order_by(User.name.asc())
    ).all()
    if len(assignees) != len(assignee_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?좏슚?섏? ?딆? ?대떦?먭? ?ы븿?섏뼱 ?덉뒿?덈떎.",
        )

    if project and project.participants:
        participant_ids = {member.id for member in project.participants}
        invalid = [
            user.name
            for user in assignees
            if user.id not in participant_ids and user.id not in keep_ids
        ]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="?대떦?먮뒗 ?대떦 ?꾨줈?앺듃 李몄뿬 ?몄썝 以묒뿉?쒕쭔 ?좏깮?????덉뒿?덈떎.",
            )

    order = {user_id: index for index, user_id in enumerate(assignee_ids)}
    return sorted(assignees, key=lambda user: order[user.id])


def _set_subproject_assignees(sp: SubProject, assignees: list[User]) -> None:
    sp.assignees = assignees
    sp.assignee_id = assignees[0].id if assignees else None


def _payload_role_ids(payload, plural_name: str, singular_name: str) -> list[int] | None:
    if plural_name in payload.model_fields_set:
        return list(dict.fromkeys(getattr(payload, plural_name) or []))
    if singular_name in payload.model_fields_set:
        singular_id = getattr(payload, singular_name)
        return [] if singular_id is None else [singular_id]
    return None


def _load_valid_role_members(
    db: Session,
    project: Project,
    user_ids: list[int],
) -> list[User]:
    if not user_ids:
        return []
    members = db.scalars(
        select(User).where(User.id.in_(user_ids), User.is_active.is_(True))
    ).all()
    if len(members) != len(user_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="유효하지 않은 담당자가 포함되어 있습니다.")
    if project.participants:
        participant_ids = {member.id for member in project.participants}
        if any(member.id not in participant_ids for member in members):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="담당자는 프로젝트 참여 인원 중에서만 선택할 수 있습니다.")
    order = {user_id: index for index, user_id in enumerate(user_ids)}
    return sorted(members, key=lambda member: order[member.id])


def _set_role_members(sp: SubProject, role: str, members: list[User]) -> None:
    setattr(sp, f"{role}s", members)
    setattr(sp, f"{role}_id", members[0].id if members else None)


def _apply_role_assignments(db: Session, project: Project, sp: SubProject, payload) -> None:
    for role in ("verifier", "reviewer", "inreviewer"):
        user_ids = _payload_role_ids(payload, f"{role}_ids", f"{role}_id")
        if user_ids is not None:
            _set_role_members(sp, role, _load_valid_role_members(db, project, user_ids))


def _serialize_major_project_response(major_project: MajorProject) -> MajorProjectResponse:
    return MajorProjectResponse(
        id=major_project.id,
        name=major_project.name,
        start_date=major_project.start_date,
        end_date=major_project.end_date,
        kickoff_date=major_project.kickoff_date,
        project_types=_major_project_project_types(major_project),
        is_default=bool(major_project.is_default),
        created_at=major_project.created_at,
        members=list(major_project.members or []),
        project_count=len(major_project.projects or []),
    )


def _major_project_project_types(major_project: MajorProject) -> list[str]:
    raw = major_project.project_types or DEFAULT_PROJECT_TYPES_JSON
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return list(DEFAULT_PROJECT_TYPES)
    if not isinstance(parsed, list):
        return list(DEFAULT_PROJECT_TYPES)
    values = [value.strip() for value in parsed if isinstance(value, str) and value.strip()]
    return list(dict.fromkeys(values)) or list(DEFAULT_PROJECT_TYPES)


def _ensure_project_type_allowed(major_project: MajorProject, project_type: str) -> None:
    if project_type not in _major_project_project_types(major_project):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="선택한 대프로젝트에서 사용할 수 없는 프로젝트 유형입니다.",
        )


def _load_major_project_for_user(
    db: Session,
    major_project_id: int,
    current_user: User,
) -> MajorProject:
    major_project = db.scalar(
        select(MajorProject)
        .options(selectinload(MajorProject.members), selectinload(MajorProject.projects))
        .where(MajorProject.id == major_project_id)
    )
    if not major_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="??꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )
    if current_user.role != "admin" and current_user.id not in {user.id for user in major_project.members}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="蹂몄씤??諛곗젙????꾨줈?앺듃留??ъ슜?????덉뒿?덈떎.",
        )
    return major_project


def _load_major_project_members(
    db: Session,
    member_ids: list[int],
) -> list[User]:
    if not member_ids:
        return []
    unique_ids = list(dict.fromkeys(member_ids))
    members = db.scalars(
        select(User)
        .where(User.id.in_(unique_ids), User.is_active.is_(True))
        .order_by(User.name.asc())
    ).all()
    if len(members) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?좏슚?섏? ?딆? ??꾨줈?앺듃 李몄뿬?먭? ?ы븿?섏뼱 ?덉뒿?덈떎.",
        )
    order = {user_id: index for index, user_id in enumerate(unique_ids)}
    return sorted(members, key=lambda user: order[user.id])


def _load_project_participants_for_major(
    db: Session,
    major_project: MajorProject,
    participant_ids: list[int],
    keep_ids: set[int] | None = None,
) -> list[User]:
    """프로젝트 참여 인원을 검증해서 불러온다.

    keep_ids 는 이미 이 프로젝트에 참여자로 등록돼 있던 사람의 id 다.
    퇴사해서 비활성이 되었더라도 이미 등록된 사람은 그대로 통과시킨다.
    그러지 않으면 퇴사자가 남은 프로젝트는 날짜 하나 바꾸는 것도 막힌다.
    새로 추가하는 사람에게는 기존 규칙을 그대로 적용한다.
    """
    keep_ids = keep_ids or set()
    unique_ids = list(dict.fromkeys(participant_ids))
    if not unique_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?꾨줈?앺듃 李몄뿬 ?몄썝??1紐??댁긽 ?좏깮?댁＜?몄슂.",
        )
    major_member_ids = {user.id for user in major_project.members}
    invalid_ids = [
        user_id
        for user_id in unique_ids
        if user_id not in major_member_ids and user_id not in keep_ids
    ]
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="以묓봽濡쒖젥??李몄뿬?먮뒗 ?좏깮????꾨줈?앺듃 李몄뿬???덉뿉?쒕쭔 ?좏깮?????덉뒿?덈떎.",
        )
    # 이미 등록돼 있던 사람은 비활성이어도 함께 불러온다
    active_or_kept = User.is_active.is_(True)
    if keep_ids:
        active_or_kept = or_(active_or_kept, User.id.in_(keep_ids))
    participants = db.scalars(
        select(User)
        .where(User.id.in_(unique_ids), active_or_kept)
        .order_by(User.name.asc())
    ).all()
    if len(participants) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?좏슚?섏? ?딆? ?꾨줈?앺듃 李몄뿬 ?몄썝???ы븿?섏뼱 ?덉뒿?덈떎.",
        )
    order = {user_id: index for index, user_id in enumerate(unique_ids)}
    return sorted(participants, key=lambda user: order[user.id])


def _get_visible_project_ids_for_user(db: Session, current_user: User) -> set[int]:
    if current_user.role == "admin":
        return set(
            db.scalars(select(Project.id)).all()
        )

    member_project_ids = _get_member_project_ids_for_user(db, current_user)
    assigned_project_ids = set(
        db.scalars(
            select(SubProject.project_id)
            .where(SubProject.assignee_id == current_user.id)
            .distinct()
        ).all()
    )
    assigned_project_ids |= set(
        db.scalars(
            select(SubProject.project_id)
            .join(
                subproject_assignees,
                subproject_assignees.c.subproject_id == SubProject.id,
            )
            .where(subproject_assignees.c.user_id == current_user.id)
            .distinct()
        ).all()
    )
    return member_project_ids | assigned_project_ids


def _get_member_project_ids_for_user(db: Session, current_user: User) -> set[int]:
    major_project_ids = set(
        db.scalars(
            select(Project.id)
            .join(MajorProject, MajorProject.id == Project.major_project_id)
            .join(MajorProject.members)
            .where(User.id == current_user.id)
        ).all()
    )

    # Use whole-project membership as the primary visibility rule. Keep assigned
    # subprojects as a fallback for older data that may not have participants.
    participant_project_ids = set(
        db.scalars(
            select(project_participants.c.project_id).where(
                project_participants.c.user_id == current_user.id
            )
        ).all()
    )
    return major_project_ids | participant_project_ids


def _ensure_subproject_access(db: Session, sp: SubProject, current_user: User) -> None:
    if current_user.role == "admin":
        return
    if current_user.id in _subproject_assignee_ids(sp):
        return
    if sp.project_id in _get_visible_project_ids_for_user(db, current_user):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="?대떦 ?뚰봽濡쒖젥?몄뿉 ?묎렐?????놁뒿?덈떎.",
    )


def _can_edit_subproject_progress(db: Session, sp: SubProject, current_user: User) -> bool:
    if current_user.role == "admin":
        return True
    if current_user.id in _subproject_assignee_ids(sp):
        return True
    return (
        db.scalar(
            select(project_participants.c.project_id)
            .where(
                project_participants.c.project_id == sp.project_id,
                project_participants.c.user_id == current_user.id,
            )
            .limit(1)
        )
        is not None
    )


def _ensure_project_participant_write_access(
    project: Project | None,
    current_user: User,
) -> None:
    if current_user.role == "admin":
        return
    if project and current_user.id in {user.id for user in project.participants or []}:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="프로젝트 참여자만 하위 프로젝트를 추가하거나 수정할 수 있습니다.",
    )


def _validate_subproject_dates_within_project(
    project: Project | None,
    start_date: date,
    end_date: date,
) -> None:
    if end_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="醫낅즺?쇱? ?쒖옉???댄썑?ъ빞 ?⑸땲??",
        )
    if project is None:
        return
    if project.start_date is not None and start_date < project.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?섏쐞 ?꾨줈?앺듃 ?쒖옉?쇱? ?곸쐞 ?꾨줈?앺듃 ?쒖옉???댄썑?ъ빞 ?⑸땲??",
        )
    if project.end_date is not None and end_date > project.end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?섏쐞 ?꾨줈?앺듃 醫낅즺?쇱? ?곸쐞 ?꾨줈?앺듃 醫낅즺???대궡?ъ빞 ?⑸땲??",
        )


def _estimate_worked_minutes(db: Session, subproject_id: int, assignee_id: int | None) -> int:
    if assignee_id is None:
        return 0

    now = datetime.now(timezone.utc)
    logs = db.scalars(
        select(WorkLog).where(
            WorkLog.subproject_id == subproject_id,
            WorkLog.user_id == assignee_id,
        )
    ).all()

    total_seconds = 0
    for log in logs:
        total_seconds += log.duration_sec
        if log.status == WORKLOG_RUNNING and log.current_started_at:
            total_seconds += max(0, int((now - log.current_started_at).total_seconds()))
    if total_seconds <= 0:
        return 0
    return max(1, (total_seconds + 59) // 60)


def _build_history_keywords(project: Project, subproject: SubProject) -> str:
    tokens = [
        project.name,
        subproject.name,
        subproject.function_name,
        subproject.controller_name,
        subproject.vehicle_type,
        subproject.verification_level,
        subproject.priority,
        subproject.cr_no,
        subproject.etc_category,
    ]
    return " ".join(token.strip() for token in tokens if token and token.strip())


def _sync_subproject_execution_history(
    db: Session,
    project: Project,
    subproject: SubProject,
) -> None:
    existing_rows = db.scalars(
        select(ProjectExecutionHistory).where(
            ProjectExecutionHistory.subproject_id == subproject.id
        )
    ).all()

    # 愿由ъ옄媛 ?섎룞 ?몄쭛???됱? ?먮룞 ?숆린????곸뿉???쒖쇅 ??蹂댁〈留??쒕떎.
    auto_rows = [row for row in existing_rows if not row.manual_override]

    assignee_ids = sorted(_subproject_assignee_ids(subproject))
    if subproject.status != STATUS_COMPLETED or not assignee_ids:
        for row in auto_rows:
            db.delete(row)
        return

    fallback_minutes = (
        subproject.total_minutes
        or subproject.avg_expected_minutes
        or max(1, (subproject.end_date - subproject.start_date).days + 1) * 60
    )
    auto_by_user = {row.user_id: row for row in auto_rows}
    for row in auto_rows:
        if row.user_id not in assignee_ids:
            db.delete(row)

    for assignee_id in assignee_ids:
        history = auto_by_user.get(assignee_id)
        if history is None:
            history = ProjectExecutionHistory(
                user_id=assignee_id,
                project_id=project.id,
                subproject_id=subproject.id,
            )
            db.add(history)

        worked_minutes = _estimate_worked_minutes(db, subproject.id, assignee_id)
        if worked_minutes <= 0:
            worked_minutes = fallback_minutes

        history.project_name = project.name
        history.subproject_name = subproject.name
        history.project_type = project.project_type
        history.role_in_project = "assignee"
        history.started_on = subproject.start_date
        history.ended_on = subproject.completed_on or subproject.end_date
        history.worked_minutes = worked_minutes
        history.completion_rate = float(subproject.progress)
        history.keyword_text = _build_history_keywords(project, subproject)


def _load_stage_minutes_map(
    db: Session,
    subproject_ids: list[int],
) -> dict[tuple[int, int], list[HistoryStageMinutes]]:
    """B-82: (user_id, subproject_id) -> 단계별 소요 시간.

    수행 이력 목록에서 한 번에 읽어 행마다 쿼리가 나가지 않게 한다.
    """
    if not subproject_ids:
        return {}

    entries = db.scalars(
        select(SubProjectTimeEntry)
        .where(SubProjectTimeEntry.subproject_id.in_(subproject_ids))
        .order_by(SubProjectTimeEntry.stage.asc())
    ).all()

    grouped: dict[tuple[int, int], list[HistoryStageMinutes]] = {}
    for entry in entries:
        minutes = entry.total_min
        if minutes <= 0:
            continue
        key = (entry.user_id, entry.subproject_id)
        grouped.setdefault(key, []).append(
            HistoryStageMinutes(
                stage=entry.stage,
                stage_label=STAGE_LABELS.get(entry.stage, entry.stage),
                minutes=minutes,
            )
        )
    return grouped


def _serialize_history_entry(
    history: ProjectExecutionHistory,
    user: User | None,
    project: Project | None = None,
    major_project: MajorProject | None = None,
    stage_minutes: list[HistoryStageMinutes] | None = None,
) -> ProjectHistoryEntry:
    history_project = project or history.project
    history_major_project = major_project or (
        history_project.major_project if history_project else None
    )
    return ProjectHistoryEntry(
        id=history.id,
        user_id=history.user_id,
        user_name=user.name if user else "",
        major_project_id=history_major_project.id if history_major_project else None,
        major_project_name=history_major_project.name if history_major_project else None,
        project_id=history.project_id,
        project_name=history.project_name,
        subproject_id=history.subproject_id,
        subproject_name=history.subproject_name,
        project_type=history.project_type,
        role_in_project=history.role_in_project,
        started_on=history.started_on,
        ended_on=history.ended_on,
        worked_minutes=history.worked_minutes,
        completion_rate=float(history.completion_rate),
        recorded_at=history.recorded_at,
        manual_override=bool(history.manual_override),
        stage_breakdown=stage_minutes or [],
    )


# custom_fields 를 "지정 안 함"과 "None 으로 지우기"를 구분하기 위한 표식
_UNSET = object()


def _apply_kefico_fields(sp: SubProject, payload) -> None:
    """payload?먯꽌 KEFICO ?꾨뱶??以?媛믪씠 ?ㅼ뼱??寃껊쭔 sp??諛섏쁺."""
    data = payload.model_dump(exclude_unset=True)
    for fname in _KEFICO_COPY_FIELDS:
        if fname in data:
            setattr(sp, fname, data[fname])
    # 而ㅼ뒪? ?꾨뱶 諛섏쁺
    # overflow 는 날짜·숫자 칸에 들어온 해석 불가 텍스트다(E-2).
    # 저장된 값을 지우지 않도록 기존 내용 위에 얹는다.
    overflow = data.get("free_text_overflow")
    if "custom_fields" in data:
        base = dict(data["custom_fields"]) if data["custom_fields"] is not None else None
    elif overflow:
        try:
            base = dict(json.loads(sp.custom_fields)) if sp.custom_fields else {}
        except (TypeError, ValueError):
            base = {}
    else:
        base = _UNSET

    if base is not _UNSET:
        if overflow:
            base = {**(base or {}), **overflow}
        sp.custom_fields = (
            json.dumps(base, ensure_ascii=False) if base is not None else None
        )


def _subproject_effective_weight(subproject: SubProject) -> float:
    """가중치가 명시된 경우 그 값을 사용, 없으면 소요 시간 기반으로 fallback."""
    if subproject.weight is not None:
        return float(subproject.weight)
    return float(
        max(
            1,
            subproject.total_minutes
            or subproject.avg_expected_minutes
            or max(1, (subproject.end_date - subproject.start_date).days + 1) * 60,
        )
    )


def _serialize_project_response(project: Project) -> ProjectResponse:
    subprojects = list(project.subprojects or [])
    total_weight = sum(_subproject_effective_weight(subproject) for subproject in subprojects)
    weighted_progress = (
        sum(float(subproject.progress) * _subproject_effective_weight(subproject) for subproject in subprojects)
        / total_weight
        if total_weight > 0
        else 0.0
    )
    completed_count = sum(1 for subproject in subprojects if subproject.status == STATUS_COMPLETED)
    in_progress_count = sum(1 for subproject in subprojects if subproject.status == STATUS_IN_PROGRESS)

    return ProjectResponse(
        id=project.id,
        major_project_id=project.major_project_id,
        major_project=project.major_project,
        name=project.name,
        project_type=project.project_type,
        start_date=project.start_date,
        end_date=project.end_date,
        vehicle_sets=project.vehicle_sets,
        created_by=project.created_by,
        created_at=project.created_at,
        participants=list(project.participants or []),
        progress_percent=round(weighted_progress, 2),
        subproject_count=len(subprojects),
        completed_subproject_count=completed_count,
        in_progress_subproject_count=in_progress_count,
    )

