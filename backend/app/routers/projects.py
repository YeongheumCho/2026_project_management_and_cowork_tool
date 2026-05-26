"""
?꾨줈?앺듃/?뚰봽濡쒖젥???몃? ?쒖뒪??REST API.

?붾뱶?ъ씤???붿빟
  # Projects
  POST   /projects                     愿由ъ옄: 理쒖긽???꾨줈?앺듃 ?앹꽦
  GET    /projects                     ?꾩껜 ?ъ슜?? ?꾨줈?앺듃 紐⑸줉
  # SubProjects
  POST   /subprojects                  愿由ъ옄: ?뚰봽濡쒖젥???앹꽦 (?꾨줈?앺듃 ?좏삎???곕씪 ?몃? ?쒖뒪???먮룞 ?앹꽦)
  GET    /subprojects                  荑쇰━: ?project_id, ?assignee_id
  GET    /subprojects/{id}             ?④굔 議고쉶
  PUT    /subprojects/{id}             愿由ъ옄: KEFICO ?꾨뱶 ?ы븿 遺遺??섏젙
  DELETE /subprojects/{id}             愿由ъ옄: 誘몄셿猷??곹깭?먯꽌留???젣
  # SubTasks
  PATCH  /subtasks/{id}                泥댄겕/?댁젣 ???대떦??蹂몄씤 ?먮뒗 愿由ъ옄
"""
import json
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import (
    DEFAULT_SUBTASK_TEMPLATE,
    DEFAULT_PROJECT_TYPES,
    DEFAULT_PROJECT_TYPES_JSON,
    ETC_SUBTASK_TEMPLATE,
    INSPECTION_SUBTASK_TEMPLATE,
    MajorProject,
    STATUS_COMPLETED,
    STATUS_IN_PROGRESS,
    STATUS_PLANNED,
    Project,
    SubProject,
    SubTask,
    project_participants,
    subproject_assignees,
)
from app.models.progress_log import ProgressLog
from app.models.user import User
from app.models.workflow import WORKLOG_RUNNING, ProjectExecutionHistory, WorkLog
from app.schemas.progress_log import ProgressLogCreate, ProgressLogResponse
from app.schemas.project import (
    MajorProjectCreate,
    MajorProjectResponse,
    MajorProjectUpdate,
    ProjectHistoryCreate,
    ProjectHistoryEntry,
    ProjectHistoryMemberSummary,
    ProjectHistorySummary,
    ProjectHistoryUpdate,
    ProjectMemberTimeSummary,
    ProjectCreate,
    ProjectResponse,
    ProjectTimeSummary,
    ProjectUpdate,
    SubProjectCreate,
    SubProjectResponse,
    SubProjectUpdate,
    SubTaskResponse,
    SubTaskUpdate,
)


router = APIRouter(tags=["projects"])


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
    "function_name", "function_owner", "verifier_id", "reviewer_id",
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
) -> list[User]:
    if not assignee_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?대떦?먮? 1紐??댁긽 ?좏깮?댁＜?몄슂.",
        )

    assignees = db.scalars(
        select(User)
        .where(User.id.in_(assignee_ids), User.is_active.is_(True))
        .order_by(User.name.asc())
    ).all()
    if len(assignees) != len(assignee_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?좏슚?섏? ?딆? ?대떦?먭? ?ы븿?섏뼱 ?덉뒿?덈떎.",
        )

    if project and project.participants:
        participant_ids = {member.id for member in project.participants}
        invalid = [user.name for user in assignees if user.id not in participant_ids]
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
) -> list[User]:
    unique_ids = list(dict.fromkeys(participant_ids))
    if not unique_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?꾨줈?앺듃 李몄뿬 ?몄썝??1紐??댁긽 ?좏깮?댁＜?몄슂.",
        )
    major_member_ids = {user.id for user in major_project.members}
    invalid_ids = [user_id for user_id in unique_ids if user_id not in major_member_ids]
    if invalid_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="以묓봽濡쒖젥??李몄뿬?먮뒗 ?좏깮????꾨줈?앺듃 李몄뿬???덉뿉?쒕쭔 ?좏깮?????덉뒿?덈떎.",
        )
    participants = db.scalars(
        select(User)
        .where(User.id.in_(unique_ids), User.is_active.is_(True))
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
    return major_project_ids | participant_project_ids | assigned_project_ids


def _ensure_subproject_access(sp: SubProject, current_user: User) -> None:
    if current_user.role == "admin":
        return
    if current_user.id not in _subproject_assignee_ids(sp):
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


def _serialize_history_entry(
    history: ProjectExecutionHistory,
    user: User | None,
    project: Project | None = None,
    major_project: MajorProject | None = None,
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
    )


def _apply_kefico_fields(sp: SubProject, payload) -> None:
    """payload?먯꽌 KEFICO ?꾨뱶??以?媛믪씠 ?ㅼ뼱??寃껊쭔 sp??諛섏쁺."""
    data = payload.model_dump(exclude_unset=True)
    for fname in _KEFICO_COPY_FIELDS:
        if fname in data:
            setattr(sp, fname, data[fname])
    # 而ㅼ뒪? ?꾨뱶 諛섏쁺
    if "custom_fields" in data and data["custom_fields"] is not None:
        sp.custom_fields = json.dumps(data["custom_fields"], ensure_ascii=False)
    elif "custom_fields" in data and data["custom_fields"] is None:
        sp.custom_fields = None


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


# ========== Major Projects ==========

@router.get("/major-projects", response_model=list[MajorProjectResponse])
def list_major_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(MajorProject)
        .options(selectinload(MajorProject.members), selectinload(MajorProject.projects))
        .order_by(MajorProject.created_at.desc())
    )
    if current_user.role != "admin":
        stmt = stmt.where(MajorProject.members.any(User.id == current_user.id))
    return [_serialize_major_project_response(item) for item in db.scalars(stmt).all()]


@router.post(
    "/major-projects",
    response_model=MajorProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_major_project(
    payload: MajorProjectCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    members = _load_major_project_members(db, payload.member_ids)
    major_project = MajorProject(
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        kickoff_date=payload.kickoff_date,
        project_types=json.dumps(payload.project_types, ensure_ascii=False),
        is_default=False,
    )
    major_project.members = members
    db.add(major_project)
    db.commit()
    db.refresh(major_project)
    major_project = db.scalar(
        select(MajorProject)
        .options(selectinload(MajorProject.members), selectinload(MajorProject.projects))
        .where(MajorProject.id == major_project.id)
    )
    return _serialize_major_project_response(major_project)


@router.put("/major-projects/{major_project_id}", response_model=MajorProjectResponse)
def update_major_project(
    major_project_id: int,
    payload: MajorProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    major_project = db.scalar(
        select(MajorProject)
        .options(
            selectinload(MajorProject.members),
            selectinload(MajorProject.projects).selectinload(Project.participants),
        )
        .where(MajorProject.id == major_project_id)
    )
    if not major_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="??꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    next_project_types = list(dict.fromkeys(payload.project_types))
    project_types_in_use = {
        project.project_type
        for project in major_project.projects
    }
    removed_types_in_use = sorted(project_types_in_use - set(next_project_types))
    if removed_types_in_use:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 해당 유형의 프로젝트가 있어 유형을 삭제할 수 없습니다.",
        )

    # Existing project participants must remain valid members of the major
    # project. Preserve them automatically so name/date/type edits are not
    # blocked by older or partially synced membership data.
    required_member_ids = {
        participant.id
        for project in major_project.projects
        for participant in project.participants
    }
    members = _load_major_project_members(
        db,
        list(dict.fromkeys([*payload.member_ids, *required_member_ids])),
    )

    major_project.name = payload.name
    major_project.start_date = payload.start_date
    major_project.end_date = payload.end_date
    major_project.kickoff_date = payload.kickoff_date
    major_project.project_types = json.dumps(next_project_types, ensure_ascii=False)
    major_project.members = members
    db.commit()
    major_project = db.scalar(
        select(MajorProject)
        .options(selectinload(MajorProject.members), selectinload(MajorProject.projects))
        .where(MajorProject.id == major_project.id)
    )
    return _serialize_major_project_response(major_project)


@router.delete("/major-projects/{major_project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_major_project(
    major_project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    major_project = db.scalar(
        select(MajorProject)
        .options(selectinload(MajorProject.projects))
        .where(MajorProject.id == major_project_id)
    )
    if not major_project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="??꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )
    if major_project.is_default:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="湲곕낯 ??꾨줈?앺듃????젣?????놁뒿?덈떎.",
        )
    if major_project.projects:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?뚯냽 以묓봽濡쒖젥?멸? ?덈뒗 ??꾨줈?앺듃????젣?????놁뒿?덈떎.",
        )
    db.delete(major_project)
    db.commit()
    return None


# ========== Projects ==========

@router.post(
    "/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    major_project = _load_major_project_for_user(db, payload.major_project_id, current_user)
    _ensure_project_type_allowed(major_project, payload.project_type)
    participants = _load_project_participants_for_major(db, major_project, payload.participant_ids)

    project = Project(
        major_project_id=major_project.id,
        name=payload.name,
        project_type=payload.project_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        vehicle_sets=json.dumps(
            [item.model_dump() for item in payload.vehicle_sets],
            ensure_ascii=False,
        ),
        created_by=current_user.id,
    )
    project.participants = participants
    db.add(project)
    db.commit()
    project = db.scalar(
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects).selectinload(SubProject.assignees),
        )
        .where(Project.id == project.id)
    )
    return _serialize_project_response(project)


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects),
        )
        .order_by(Project.created_at.desc())
    )
    if current_user.role != "admin":
        visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
        if not visible_project_ids:
            return []
        stmt = stmt.where(Project.id.in_(visible_project_ids))
    return [_serialize_project_response(project) for project in db.scalars(stmt).all()]


@router.put("/projects/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = db.scalar(
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects).selectinload(SubProject.assignees),
        )
        .where(Project.id == project_id)
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    major_project = _load_major_project_for_user(db, payload.major_project_id, _)
    _ensure_project_type_allowed(major_project, payload.project_type)
    participants = _load_project_participants_for_major(db, major_project, payload.participant_ids)

    participant_id_set = {user.id for user in participants}
    invalid_assignees = [
        subproject.name
        for subproject in project.subprojects
        if any(user_id not in participant_id_set for user_id in _subproject_assignee_ids(subproject))
    ]
    if invalid_assignees:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "?꾩옱 諛곗젙???섏쐞 ?꾨줈?앺듃 ?대떦?먭? ??李몄뿬 ?몄썝???ы븿?섏? ?딆뒿?덈떎: "
                + ", ".join(invalid_assignees[:3])
            ),
        )

    project.name = payload.name
    project.major_project_id = major_project.id
    project.project_type = payload.project_type
    if "start_date" in payload.model_fields_set:
        project.start_date = payload.start_date
    if "end_date" in payload.model_fields_set:
        project.end_date = payload.end_date
    project.vehicle_sets = json.dumps(
        [item.model_dump() for item in payload.vehicle_sets],
        ensure_ascii=False,
    )
    project.participants = participants
    db.commit()
    project = db.scalar(
        select(Project)
        .options(
            selectinload(Project.major_project),
            selectinload(Project.participants),
            selectinload(Project.subprojects),
        )
        .where(Project.id == project.id)
    )
    return _serialize_project_response(project)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    db.delete(project)
    db.commit()
    return None


@router.get("/projects/time-summary", response_model=list[ProjectTimeSummary])
def list_project_time_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
    if current_user.role != "admin" and not visible_project_ids:
        return []
    rows = db.execute(
        select(WorkLog, SubProject, User)
        .join(SubProject, WorkLog.subproject_id == SubProject.id)
        .join(User, WorkLog.user_id == User.id)
    ).all()

    per_project_user: dict[int, dict[int, dict[str, int | str]]] = defaultdict(dict)

    for work_log, subproject, user in rows:
        if current_user.role != "admin" and subproject.project_id not in visible_project_ids:
            continue
        duration_sec = work_log.duration_sec
        if work_log.status == WORKLOG_RUNNING and work_log.current_started_at:
            duration_sec += max(
                0,
                int((now - work_log.current_started_at).total_seconds()),
            )

        project_bucket = per_project_user.setdefault(subproject.project_id, {})
        member_bucket = project_bucket.get(user.id)
        if member_bucket is None:
            project_bucket[user.id] = {
                "user_name": user.name,
                "total_seconds": duration_sec,
            }
        else:
            member_bucket["total_seconds"] = int(member_bucket["total_seconds"]) + duration_sec

    summaries: list[ProjectTimeSummary] = []
    for project_id, members in per_project_user.items():
        member_summaries = sorted(
            [
                ProjectMemberTimeSummary(
                    user_id=user_id,
                    user_name=str(data["user_name"]),
                    total_seconds=int(data["total_seconds"]),
                )
                for user_id, data in members.items()
                if int(data["total_seconds"]) > 0
            ],
            key=lambda item: (-item.total_seconds, item.user_name),
        )

        summaries.append(
            ProjectTimeSummary(
                project_id=project_id,
                total_seconds=sum(member.total_seconds for member in member_summaries),
                members=member_summaries,
            )
        )

    summaries.sort(key=lambda item: item.project_id)
    return summaries


# ========== SubProjects ==========

@router.post(
    "/subprojects",
    response_model=SubProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subproject(
    payload: SubProjectCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.participants))
        .where(Project.id == payload.project_id)
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    _validate_subproject_dates_within_project(
        project,
        payload.start_date,
        payload.end_date,
    )

    assignees = _load_valid_assignees(
        db,
        project,
        _payload_assignee_ids(payload) or [],
    )

    sp = SubProject(
        project_id=project.id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=STATUS_PLANNED,
        progress=0,
    )
    _set_subproject_assignees(sp, assignees)

    # KEFICO ?꾨뱶 蹂듭궗
    _apply_kefico_fields(sp, payload)

    # ?몃? ?쒖뒪?? ?꾨줈?앺듃 ?좏삎蹂?肄붾뱶 ?댁옣 ?쒗뵆由??곸슜
    task_source = [(name, float(w)) for name, w in _TEMPLATE_BY_TYPE.get(project.project_type, DEFAULT_SUBTASK_TEMPLATE)]

    for idx, (task_name, weight) in enumerate(task_source, start=1):
        sp.subtasks.append(
            SubTask(name=task_name, order_index=idx, weight=weight, is_done=False)
        )

    db.add(sp)
    db.commit()

    sp = _load_subproject(db, sp.id)
    return SubProjectResponse.from_orm_with_custom(sp)


@router.get("/subprojects", response_model=list[SubProjectResponse])
def list_subprojects(
    project_id: Optional[int] = Query(default=None),
    assignee_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(SubProject).options(
        selectinload(SubProject.subtasks),
        selectinload(SubProject.assignee),
        selectinload(SubProject.assignees),
        selectinload(SubProject.verifier),
        selectinload(SubProject.reviewer),
    )
    if current_user.role != "admin":
        visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
        if not visible_project_ids:
            return []
        stmt = stmt.where(
            or_(
                SubProject.assignee_id == current_user.id,
                SubProject.id.in_(
                    select(subproject_assignees.c.subproject_id).where(
                        subproject_assignees.c.user_id == current_user.id
                    )
                ),
            ),
            SubProject.project_id.in_(visible_project_ids),
        )
    if project_id is not None:
        stmt = stmt.where(SubProject.project_id == project_id)
    if assignee_id is not None and current_user.role == "admin":
        stmt = stmt.where(
            or_(
                SubProject.assignee_id == assignee_id,
                SubProject.id.in_(
                    select(subproject_assignees.c.subproject_id).where(
                        subproject_assignees.c.user_id == assignee_id
                    )
                ),
            )
        )
    stmt = stmt.order_by(SubProject.start_date.asc())
    return [SubProjectResponse.from_orm_with_custom(sp) for sp in db.scalars(stmt).all()]


@router.get("/subprojects/{subproject_id}", response_model=SubProjectResponse)
def get_subproject(
    subproject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    _ensure_subproject_access(sp, current_user)
    return SubProjectResponse.from_orm_with_custom(sp)


@router.put("/subprojects/{subproject_id}", response_model=SubProjectResponse)
def update_subproject(
    subproject_id: int,
    payload: SubProjectUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    sp = _load_subproject(db, subproject_id)
    project = db.scalar(
        select(Project)
        .options(selectinload(Project.participants))
        .where(Project.id == sp.project_id)
    )

    new_start = payload.start_date or sp.start_date
    new_end = payload.end_date or sp.end_date
    if new_end < new_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="醫낅즺?쇱? ?쒖옉???댄썑?ъ빞 ?⑸땲??",
        )

    _validate_subproject_dates_within_project(project, new_start, new_end)

    if payload.name is not None:
        sp.name = payload.name
    next_assignee_ids = _payload_assignee_ids(payload)
    if next_assignee_ids is not None:
        _set_subproject_assignees(
            sp,
            _load_valid_assignees(db, project, next_assignee_ids),
        )
    if payload.start_date is not None:
        sp.start_date = payload.start_date
    if payload.end_date is not None:
        sp.end_date = payload.end_date

    # KEFICO ?꾨뱶 諛섏쁺
    _apply_kefico_fields(sp, payload)

    # verifier/reviewer FK 寃利?
    for fk_name in ("function_owner", "verifier_id", "reviewer_id"):
        val = getattr(sp, fk_name)
        if val is not None:
            ref = db.get(User, val)
            if not ref:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{fk_name} ?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎.",
                )

    db.flush()
    if _has_subproject_progress_logs(db, sp.id):
        _recalc_status_and_progress_from_logs(db, sp)

    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()
    sp = _load_subproject(db, subproject_id)
    return SubProjectResponse.from_orm_with_custom(sp)


@router.delete(
    "/subprojects/{subproject_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_subproject(
    subproject_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    sp = _load_subproject(db, subproject_id)
    db.delete(sp)
    db.commit()
    return None


# ========== SubTasks ==========

@router.patch("/subtasks/{subtask_id}", response_model=SubTaskResponse)
def update_subtask(
    subtask_id: int,
    payload: SubTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(SubTask, subtask_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?몃? ?쒖뒪?щ? 李얠쓣 ???놁뒿?덈떎.",
        )

    sp = _load_subproject(db, task.subproject_id)
    if current_user.role != "admin" and current_user.id not in _subproject_assignee_ids(sp):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="蹂몄씤???대떦???쒖뒪?щ쭔 蹂寃쏀븷 ???덉뒿?덈떎.",
        )

    if payload.is_done is not None:
        task.is_done = payload.is_done
        task.done_at = datetime.now(timezone.utc) if payload.is_done else None
    if payload.name is not None and current_user.role == "admin":
        task.name = payload.name
    if payload.weight is not None and current_user.role == "admin":
        task.weight = payload.weight

    db.flush()
    if _has_subproject_progress_logs(db, sp.id):
        _recalc_status_and_progress_from_logs(db, sp)
    else:
        _recalc_status_and_progress(sp)
    project = db.get(Project, sp.project_id)
    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()
    db.refresh(task)
    return task


@router.get("/projects/history", response_model=list[ProjectHistoryEntry])
def list_project_execution_history(
    major_project_id: Optional[int] = Query(default=None),
    project_id: Optional[int] = Query(default=None),
    user_id: Optional[int] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
    if current_user.role != "admin" and not visible_project_ids:
        return []
    stmt = (
        select(ProjectExecutionHistory, User, Project, MajorProject)
        .join(User, ProjectExecutionHistory.user_id == User.id)
        .outerjoin(Project, ProjectExecutionHistory.project_id == Project.id)
        .outerjoin(MajorProject, Project.major_project_id == MajorProject.id)
        .order_by(
            ProjectExecutionHistory.ended_on.desc(),
            ProjectExecutionHistory.recorded_at.desc(),
        )
    )
    if current_user.role != "admin":
        stmt = stmt.where(
            ProjectExecutionHistory.project_id.in_(visible_project_ids),
            ProjectExecutionHistory.user_id == current_user.id,
        )
    if major_project_id is not None:
        stmt = stmt.where(Project.major_project_id == major_project_id)
    if project_id is not None:
        stmt = stmt.where(ProjectExecutionHistory.project_id == project_id)
    if user_id is not None and current_user.role == "admin":
        stmt = stmt.where(ProjectExecutionHistory.user_id == user_id)
    if start_date is not None:
        stmt = stmt.where(ProjectExecutionHistory.ended_on >= start_date)
    if end_date is not None:
        stmt = stmt.where(ProjectExecutionHistory.ended_on <= end_date)

    rows = db.execute(stmt).all()
    return [
        _serialize_history_entry(history, user, project, major_project)
        for history, user, project, major_project in rows
    ]


@router.post(
    "/projects/history",
    response_model=ProjectHistoryEntry,
    status_code=status.HTTP_201_CREATED,
)
def create_project_execution_history(
    payload: ProjectHistoryCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.get(User, payload.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?ъ슜?먮? 李얠쓣 ???놁뒿?덈떎.",
        )

    subproject: SubProject | None = None
    project: Project | None = None
    if payload.subproject_id is not None:
        subproject = _load_subproject(db, payload.subproject_id)
        project = db.get(Project, subproject.project_id)
    elif payload.project_id is not None:
        project = db.get(Project, payload.project_id)
    if payload.project_id is not None and not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    project_name = (payload.project_name or (project.name if project else None) or "").strip()
    if not project_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?꾨줈?앺듃紐낆쓣 ?낅젰?댁＜?몄슂.",
        )

    history = ProjectExecutionHistory(
        user_id=user.id,
        project_id=project.id if project else None,
        subproject_id=subproject.id if subproject else None,
        project_name=project_name,
        subproject_name=payload.subproject_name.strip(),
        project_type=project.project_type if project else payload.project_type,
        role_in_project="assignee",
        started_on=payload.started_on or (subproject.start_date if subproject else None),
        ended_on=payload.ended_on
        or (subproject.completed_on if subproject else None)
        or (subproject.end_date if subproject else None),
        worked_minutes=payload.worked_minutes,
        completion_rate=payload.completion_rate,
        keyword_text=payload.keyword_text
        or (_build_history_keywords(project, subproject) if subproject else project_name),
        manual_override=True,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return _serialize_history_entry(history, user)


@router.patch(
    "/projects/history/{history_id}",
    response_model=ProjectHistoryEntry,
)
def update_project_execution_history(
    history_id: int,
    payload: ProjectHistoryUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """愿由ъ옄: ?낅Т ?대젰 ???섎룞 ?몄쭛. ?몄쭛 ??manual_override=True 濡??쒖떆?섏뼱
    ?댄썑 SubProject 蹂寃쎌뿉 ?섑븳 ?먮룞 ?숆린?붽? ???됱쓣 ??뼱?곗? ?딅뒗??
    """
    history = db.get(ProjectExecutionHistory, history_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?낅Т ?대젰??李얠쓣 ???놁뒿?덈떎.",
        )

    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?섏젙???꾨뱶媛 ?놁뒿?덈떎.",
        )

    if "started_on" in data and "ended_on" in data:
        if data["started_on"] and data["ended_on"] and data["started_on"] > data["ended_on"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="?쒖옉?쇱씠 醫낅즺?쇰낫????쓣 ???놁뒿?덈떎.",
            )
    elif "started_on" in data and history.ended_on:
        if data["started_on"] and data["started_on"] > history.ended_on:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="?쒖옉?쇱씠 醫낅즺?쇰낫????쓣 ???놁뒿?덈떎.",
            )
    elif "ended_on" in data and history.started_on:
        if data["ended_on"] and history.started_on > data["ended_on"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="?쒖옉?쇱씠 醫낅즺?쇰낫????쓣 ???놁뒿?덈떎.",
            )

    if "worked_minutes" in data and data["worked_minutes"] is not None and data["worked_minutes"] < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="?뚯슂 ?쒓컙? ?뚯닔?????놁뒿?덈떎.",
        )

    for field, value in data.items():
        setattr(history, field, value)
    history.manual_override = True

    db.commit()
    db.refresh(history)
    user = db.get(User, history.user_id)
    return _serialize_history_entry(history, user)


@router.delete(
    "/projects/history/{history_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_execution_history(
    history_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """愿由ъ옄: ?낅Т ?대젰 ??젣. SubProject媛 ?꾨즺 ?곹깭濡??щ룞湲고솕?섎㈃ ???먮룞 ?됱씠
    ?앹꽦?????덉쑝?? ?섎룞 ?몄쭛???됱? ?ㅼ떆 留뚮뱾?댁?吏 ?딅뒗??
    """
    history = db.get(ProjectExecutionHistory, history_id)
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?낅Т ?대젰??李얠쓣 ???놁뒿?덈떎.",
        )
    db.delete(history)
    db.commit()
    return None


@router.get("/projects/history-summary", response_model=list[ProjectHistorySummary])
def list_project_execution_history_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    visible_project_ids = _get_visible_project_ids_for_user(db, current_user)
    if current_user.role != "admin" and not visible_project_ids:
        return []
    rows = db.execute(
        select(ProjectExecutionHistory, User).join(
            User, ProjectExecutionHistory.user_id == User.id
        )
    ).all()

    grouped: dict[int, dict[int, dict[str, object]]] = defaultdict(dict)
    for history, user in rows:
        if history.project_id is None:
            continue
        if current_user.role != "admin":
            if history.project_id not in visible_project_ids or history.user_id != current_user.id:
                continue
        project_bucket = grouped.setdefault(history.project_id, {})
        member_bucket = project_bucket.get(user.id)
        if member_bucket is None:
            project_bucket[user.id] = {
                "user_name": user.name,
                "completed_count": 1,
                "total_minutes": history.worked_minutes,
                "last_completed_on": history.ended_on,
            }
            continue

        member_bucket["completed_count"] = int(member_bucket["completed_count"]) + 1
        member_bucket["total_minutes"] = int(member_bucket["total_minutes"]) + int(history.worked_minutes)
        last_completed_on = member_bucket.get("last_completed_on")
        if history.ended_on and (
            last_completed_on is None or history.ended_on > last_completed_on
        ):
            member_bucket["last_completed_on"] = history.ended_on

    return [
        ProjectHistorySummary(
            project_id=project_id,
            total_completed_count=sum(
                int(member["completed_count"]) for member in members.values()
            ),
            members=sorted(
                [
                    ProjectHistoryMemberSummary(
                        user_id=user_id,
                        user_name=str(data["user_name"]),
                        completed_count=int(data["completed_count"]),
                        total_minutes=int(data["total_minutes"]),
                        last_completed_on=data["last_completed_on"],
                    )
                    for user_id, data in members.items()
                ],
                key=lambda item: (-item.completed_count, -item.total_minutes, item.user_name),
            ),
        )
        for project_id, members in sorted(grouped.items())
    ]


@router.post("/projects/history/backfill", status_code=status.HTTP_204_NO_CONTENT)
def backfill_project_execution_history(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    subprojects = db.scalars(
        select(SubProject)
        .options(selectinload(SubProject.subtasks))
        .where(SubProject.status == STATUS_COMPLETED)
    ).all()
    projects = {
        project.id: project
        for project in db.scalars(select(Project).where(Project.id.in_([sp.project_id for sp in subprojects]))).all()
    }
    for subproject in subprojects:
        project = projects.get(subproject.project_id)
        if project is None:
            continue
        _sync_subproject_execution_history(db, project, subproject)
    db.commit()
    return None


# ?????????????????????????????????????????????????????????????
#  ProgressLog ?붾뱶?ъ씤??(main_branch?먯꽌 蹂묓빀)
#  ?ъ슜?먭? ?좎쭨蹂꾨줈 吏꾪뻾瑜?%)怨?肄붾찘?몃? 湲곕줉?섎뒗 ?낅Т ?쇱?.
# ?????????????????????????????????????????????????????????????


@router.post(
    "/subprojects/{subproject_id}/progress",
    response_model=ProgressLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_subproject_progress_log(
    subproject_id: int,
    payload: ProgressLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    assignee_ids = _subproject_assignee_ids(sp)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="등록된 프로젝트 참여 인원만 하위 프로젝트 진행률을 기록할 수 있습니다.",
        )

    progress_log = ProgressLog(
        project_id=sp.project_id,
        subproject_id=sp.id,
        user_id=current_user.id,
        progress_percent=payload.progress_percent,
        comment=payload.comment,
        work_date=payload.work_date,
    )
    db.add(progress_log)
    db.flush()
    _recalc_status_and_progress_from_logs(db, sp)
    project = db.get(Project, sp.project_id)
    if project is not None:
        _sync_subproject_execution_history(db, project, sp)
    db.commit()
    db.refresh(progress_log)
    return progress_log


@router.get(
    "/subprojects/{subproject_id}/progress",
    response_model=list[ProgressLogResponse],
)
def list_subproject_progress_logs(
    subproject_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sp = _load_subproject(db, subproject_id)
    if not _can_edit_subproject_progress(db, sp, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="등록된 프로젝트 참여 인원만 하위 프로젝트 진행률 기록을 볼 수 있습니다.",
        )

    stmt = select(ProgressLog).where(ProgressLog.subproject_id == subproject_id)
    if current_user.role != "admin":
        stmt = stmt.where(ProgressLog.user_id == current_user.id)
    logs = db.scalars(
        stmt.order_by(ProgressLog.work_date.desc(), ProgressLog.id.desc())
    ).all()
    return logs


@router.post(
    "/projects/{project_id}/progress",
    response_model=ProgressLogResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_progress_log(
    project_id: int,
    payload: ProgressLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """蹂몄씤???대떦 ?꾨줈?앺듃?먯꽌 ?ㅻ뒛 ???쇱쓽 吏꾪뻾瑜좎쓣 湲곕줉?쒕떎."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    progress_log = ProgressLog(
        project_id=project_id,
        user_id=current_user.id,
        progress_percent=payload.progress_percent,
        comment=payload.comment,
        work_date=payload.work_date,
    )
    db.add(progress_log)
    db.commit()
    db.refresh(progress_log)
    return progress_log


@router.get(
    "/projects/{project_id}/progress",
    response_model=list[ProgressLogResponse],
)
def list_project_progress_logs(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """蹂몄씤?????꾨줈?앺듃???④릿 吏꾪뻾 湲곕줉 紐⑸줉."""
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="?꾨줈?앺듃瑜?李얠쓣 ???놁뒿?덈떎.",
        )

    logs = db.scalars(
        select(ProgressLog)
        .where(
            ProgressLog.project_id == project_id,
            ProgressLog.user_id == current_user.id,
        )
        .order_by(ProgressLog.work_date.desc(), ProgressLog.id.desc())
    ).all()
    return logs
