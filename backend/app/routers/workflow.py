import json
from datetime import date, datetime, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.dependencies import get_current_user, get_db, require_admin
from app.models.project import PROJECT_TYPES, STATUS_COMPLETED, MajorProject, Project, SubProject, SubTask
from app.models.user import User
from app.models.workflow import (
    ProjectExecutionHistory,
    ProjectTemplate,
    UserSetting,
    WorkLog,
    WORKLOG_COMPLETED,
    WORKLOG_PAUSED,
    WORKLOG_RUNNING,
)
from app.schemas.workflow import (
    AssignmentRequest,
    AssignmentResponse,
    RecommendationCandidate,
    RecommendationRequest,
    RecommendationResponse,
    TemplateCreate,
    TemplateResponse,
    TemplateTaskItem,
    UserSettingsResponse,
    UserSettingsUpdate,
    WorkLogComplete,
    WorkLogResponse,
    WorkLogStart,
    WorkLogUserSummary,
    WorkQueueItem,
)


router = APIRouter(tags=["workflow"])
SERVICE_DEVELOPER_NAMES = {"조영흠", "박상은", "신현지", "김한결"}

# ---------------------------------------------------------------------------
# 업무 가용성 / 역량 추천 알고리즘 상수
# ---------------------------------------------------------------------------

# 1일 최대 업무 적재량(분). 40시간 기준: 40h × 60min = 2400.
# 이 값에서 현재 잔여 업무량을 빼 예상 가용 시간을 산출한다.
MAX_DAILY_WORKLOAD_MINUTES = 2400

# 가용성 점수 계산 분모.
# availability_score = 100 − (remaining_minutes / AVAILABILITY_SCALE)
# 즉, AVAILABILITY_SCALE 분(24분)마다 점수 1점 감소.
AVAILABILITY_SCALE = 24

# 담당자 예상 소요 시간이 미입력됐을 때 사용하는 기본값(분).
DEFAULT_TASK_MINUTES = 120

# 역량 점수 계산에 사용하는 가중치
# (값 조정 시 _recommendation_reasons 문자열도 함께 검토할 것)
SCORE_WEIGHT_SAME_TYPE = 12       # 현재 동일 유형 진행 중인 소프로젝트당 가중치
SCORE_WEIGHT_LOG_KEYWORD = 10     # 완료 WorkLog 키워드 일치건당 가중치
SCORE_WEIGHT_HISTORY_TYPE = 14    # 이력(ProjectExecutionHistory) 유형 일치건당 가중치
SCORE_WEIGHT_HISTORY_KEYWORD = 16 # 이력 키워드 일치건당 가중치 (최고 신뢰도)
SCORE_WEIGHT_RECENT_HISTORY = 6   # 최근 RECENT_HISTORY_DAYS 이내 이력건당 가중치
SCORE_WEIGHT_COMPLETION_RATE = 0.2  # 평균 완료율 반영 비율 (0~100점 → 최대 20점 기여)
SCORE_WEIGHT_HISTORY_TIME = 0.25  # 과거 평균 수행시간 효율 점수 반영 비율 (0~100점 → 최대 25점 기여)
SCORE_WEIGHT_PROJECT_RELEVANCE = 0.25  # 신규 업무와 과거 업무의 연관성 점수 반영 비율
SCORE_BASE = 20                   # 모든 후보에게 부여하는 기본 점수 (0점 방지용)

# 최근 이력으로 간주할 기간(일). 6개월 ≒ 180일.
RECENT_HISTORY_DAYS = 180


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _deserialize_tasks(template: ProjectTemplate) -> list[dict]:
    return json.loads(template.tasks_json)


def _default_major_project_id(db: Session) -> int | None:
    return db.scalar(select(MajorProject.id).where(MajorProject.is_default.is_(True)))


def _serialize_template_response(template: ProjectTemplate) -> TemplateResponse:
    return TemplateResponse(
        id=template.id,
        name=template.name,
        project_type=template.project_type,
        trigger_keyword=template.trigger_keyword,
        is_default=template.is_default,
        tasks=[TemplateTaskItem(**item) for item in _deserialize_tasks(template)],
        created_by=template.created_by,
        created_at=template.created_at,
    )


def _recommendation_reasons(
    user: User,
    availability_score: float,
    capability_score: float,
    remaining_minutes: int,
    keyword_hits: int,
    history_hits: int,
    average_history_minutes: int | None,
    history_time_score: float,
    history_time_sample_count: int,
    project_relevance_score: float,
    project_relevance_evidence: list[str],
) -> list[str]:
    free_minutes = max(0, MAX_DAILY_WORKLOAD_MINUTES - remaining_minutes)
    if average_history_minutes is None:
        time_reason = "과거 수행시간 이력이 없어 전체 평균 대비 중립 점수로 반영했습니다."
    else:
        time_reason = (
            f"과거 {history_time_sample_count}건의 평균 수행시간은 "
            f"{average_history_minutes}분이며 시간 효율 점수 {history_time_score:.0f}점이 반영됐습니다."
        )
    relevance_reason = (
        f"신규 업무와 과거 업무 연관성 점수는 {project_relevance_score:.0f}점입니다."
    )
    if project_relevance_evidence:
        relevance_reason += f" 근거: {'; '.join(project_relevance_evidence[:2])}"
    return [
        f"예상 가용 시간이 약 {free_minutes}분으로 계산되어 가용성 점수가 {availability_score:.0f}점입니다.",
        f"유사 업무 경험치 {keyword_hits}건과 누적 수행 이력 {history_hits}건이 반영되어 역량 점수가 {capability_score:.0f}점입니다.",
        relevance_reason,
        time_reason,
        f"{user.name}님의 현재 잔여 업무량은 약 {remaining_minutes}분입니다.",
    ]


def _average_history_minutes(rows: list[ProjectExecutionHistory]) -> int | None:
    values = [int(row.worked_minutes) for row in rows if int(row.worked_minutes or 0) > 0]
    if not values:
        return None
    return round(sum(values) / len(values))


def _history_time_score(
    average_minutes: int | None,
    baseline_minutes: int | None,
) -> float:
    if average_minutes is None or baseline_minutes is None or baseline_minutes <= 0:
        return 50.0

    ratio = average_minutes / baseline_minutes
    if ratio <= 1:
        return max(50.0, min(100.0, 50 + (1 - ratio) * 100))
    return max(0.0, 50 - (ratio - 1) * 50)


def _positive_minutes(value: object) -> int | None:
    try:
        minutes = int(value or 0)
    except (TypeError, ValueError):
        return None
    return minutes if minutes > 0 else None


def _history_row_search_text(row: ProjectExecutionHistory) -> str:
    return " ".join(
        str(value).lower()
        for value in (
            row.project_name,
            row.subproject_name,
            row.project_type,
            row.keyword_text,
        )
        if value
    )


def _normalize_relevance_terms(*values: object) -> list[str]:
    terms: list[str] = []
    for value in values:
        if value is None:
            continue
        text = str(value).strip().lower()
        if not text:
            continue
        for token in text.replace("/", " ").replace("_", " ").replace("-", " ").split():
            token = token.strip(".,()[]{}:;")
            if len(token) >= 2:
                terms.append(token)
    return list(dict.fromkeys(terms))


def _history_time_match_terms(
    payload: RecommendationRequest,
    subproject: SubProject | None,
) -> list[str]:
    values: list[object] = []
    if subproject is not None:
        values.extend(
            [
                subproject.function_name,
                subproject.name,
                subproject.controller_name,
                subproject.controller_version,
                subproject.controller_country,
                subproject.vehicle_type,
                subproject.verification_level,
                subproject.priority,
                subproject.cr_no,
                subproject.etc_category,
                subproject.etc_note,
            ]
        )
    else:
        values.append(payload.project_name)
    return _normalize_relevance_terms(*values)


def _history_rows_matching_terms(
    rows: list[ProjectExecutionHistory],
    target_terms: list[str],
) -> list[ProjectExecutionHistory]:
    if not target_terms:
        return []
    required_matches = 2 if len(target_terms) >= 2 else 1
    return [
        row
        for row in rows
        if sum(
            1
            for term in target_terms
            if term in _history_row_search_text(row)
        )
        >= required_matches
    ]


def _target_standard_minutes(
    subproject: SubProject | None,
    relevant_rows: list[ProjectExecutionHistory],
) -> int | None:
    if subproject is not None:
        for value in (
            subproject.avg_expected_minutes,
            subproject.total_minutes,
        ):
            minutes = _positive_minutes(value)
            if minutes is not None:
                return minutes
    return _average_history_minutes(relevant_rows)


def _subproject_relevance_terms(
    payload: RecommendationRequest,
    subproject: SubProject | None,
) -> list[str]:
    values: list[object] = [
        payload.project_name,
        payload.project_type,
    ]
    if subproject is not None:
        values.extend(
            [
                subproject.name,
                subproject.function_name,
                subproject.controller_name,
                subproject.controller_version,
                subproject.controller_country,
                subproject.vehicle_type,
                subproject.verification_level,
                subproject.priority,
                subproject.cr_no,
                subproject.etc_category,
                subproject.etc_note,
            ]
        )
    return _normalize_relevance_terms(*values)


def _project_relevance_score(
    target_terms: list[str],
    history_rows: list[ProjectExecutionHistory],
    work_logs: list[WorkLog],
) -> tuple[float, list[str]]:
    if not target_terms:
        return 0.0, []

    evidence: list[str] = []
    matched_terms: set[str] = set()
    for row in history_rows:
        haystack = " ".join(
            str(value).lower()
            for value in (
                row.project_name,
                row.subproject_name,
                row.project_type,
                row.keyword_text,
            )
            if value
        )
        row_matches = [term for term in target_terms if term in haystack]
        if row_matches:
            matched_terms.update(row_matches)
            if len(evidence) < 3:
                evidence.append(
                    f"{row.subproject_name}: {', '.join(row_matches[:3])}"
                )

    for log in work_logs:
        haystack = (log.task_name or "").lower()
        log_matches = [term for term in target_terms if term in haystack]
        if log_matches:
            matched_terms.update(log_matches)
            if len(evidence) < 3:
                evidence.append(f"{log.task_name}: {', '.join(log_matches[:3])}")

    coverage_score = len(matched_terms) / len(target_terms) * 100
    evidence_bonus = min(20, len(evidence) * 5)
    return min(100.0, coverage_score + evidence_bonus), evidence


def _rule_based_clarifying_questions(
    target_terms: list[str],
    candidates: list[RecommendationCandidate],
) -> list[str]:
    questions: list[str] = []
    if len(target_terms) < 3:
        questions.append("신규 업무의 기능명, 차종, 제어기명, 검증 레벨 중 추가로 확정된 정보가 있나요?")
    top_relevance = max((candidate.project_relevance_score for candidate in candidates), default=0.0)
    if top_relevance < 35:
        questions.append("과거 이력과 직접 매칭되는 키워드가 적습니다. 유사 업무로 봐야 할 기준 키워드가 따로 있나요?")
    return questions[:2]


def _top_candidates_by_score(
    candidates: list[RecommendationCandidate],
    limit: int = 3,
) -> list[RecommendationCandidate]:
    top_candidates = sorted(candidates, key=lambda item: item.score, reverse=True)[:limit]
    for index, candidate in enumerate(top_candidates, start=1):
        candidate.rank = index
    return top_candidates


def _is_excluded_assignment_position(position: str | None) -> bool:
    normalized = (position or "").strip()
    if not normalized:
        return False
    excluded_titles = ("센터장", "실장", "팀장")
    return any(title in normalized for title in excluded_titles)


def _should_exclude_from_assignment(user: User) -> bool:
    if user.name in SERVICE_DEVELOPER_NAMES:
        return False
    if user.role == "admin":
        return True
    return _is_excluded_assignment_position(user.position)


def _matches_org_scope(
    user: User,
    office: str | None,
    team: str | None,
) -> bool:
    normalized_office = (office or "").strip()
    normalized_team = (team or "").strip()
    if normalized_office and (user.office or "").strip() != normalized_office:
        return False
    if normalized_team and (user.team or "").strip() != normalized_team:
        return False
    return True


def _extract_json_block(text: str) -> dict | list | None:
    text = text.strip()
    candidates = [text]

    if "```json" in text:
        start = text.index("```json") + len("```json")
        end = text.find("```", start)
        if end != -1:
            candidates.append(text[start:end].strip())
    elif "```" in text:
        start = text.index("```") + len("```")
        end = text.find("```", start)
        if end != -1:
            candidates.append(text[start:end].strip())

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


async def _rerank_candidates_with_claude(
    payload: RecommendationRequest,
    candidates: list[RecommendationCandidate],
    target_terms: list[str],
) -> tuple[list[RecommendationCandidate], bool, list[str]]:
    if not settings.AI_ASSIGNMENT_USE_CLAUDE or not candidates:
        return candidates, False, []

    shortlist = [
        {
            "user_id": candidate.user_id,
            "name": candidate.name,
            "role": candidate.role,
            "position": candidate.position,
            "score": candidate.score,
            "availability_score": candidate.availability_score,
            "capability_score": candidate.capability_score,
            "remaining_minutes": candidate.remaining_minutes,
            "average_history_minutes": candidate.average_history_minutes,
            "history_time_score": candidate.history_time_score,
            "history_time_sample_count": candidate.history_time_sample_count,
            "project_relevance_score": candidate.project_relevance_score,
            "project_relevance_evidence": candidate.project_relevance_evidence,
            "keyword_experience_count": candidate.keyword_experience_count,
            "history_experience_count": candidate.history_experience_count,
            "reasons": candidate.reasons,
        }
        for candidate in sorted(candidates, key=lambda item: item.score, reverse=True)[:5]
    ]

    prompt = (
        "당신은 프로젝트 업무 배정 추천을 돕는 분석가입니다.\n"
        "주어진 후보 5명 안에서 상위 3명을 다시 고르고, 각 사람의 추천 이유를 한국어로 3개씩 작성하세요.\n"
        "project_relevance_score/evidence와 신규 업무 판단 키워드를 보고 과거 업무 연관성을 판단하세요.\n"
        "연관성을 확신하기 어려우면 clarifying_questions에 관리자에게 물어볼 질문을 최대 2개 작성하세요.\n"
        "반드시 JSON만 반환하세요.\n"
        '{'
        '"candidates": ['
        '{"user_id": 1, "rank": 1, "reasons": ["...", "...", "..."]}'
        "],"
        '"clarifying_questions": ["..."]'
        '}\n\n'
        f"요청 정보: {json.dumps(payload.model_dump(mode='json'), ensure_ascii=False)}\n"
        f"신규 업무 판단 키워드: {json.dumps(target_terms, ensure_ascii=False)}\n"
        f"후보 정보: {json.dumps(shortlist, ensure_ascii=False)}"
    )

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                settings.AI_CHATBOT_URL,
                json={
                    "messages": [{"role": "user", "content": prompt}],
                    "system_prompt": "프로젝트 업무 배정 추천 결과를 JSON으로만 반환하세요.",
                },
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text
            try:
                payload = exc.response.json()
                if isinstance(payload, dict) and payload.get("detail"):
                    detail = str(payload["detail"])
            except Exception:
                pass
            raise ValueError(f"Claude 호출 실패: {detail}") from exc

        data = response.json()

    parsed = _extract_json_block(data.get("message", ""))
    if not isinstance(parsed, dict):
        raise ValueError("Claude 응답에서 JSON을 해석할 수 없습니다.")

    rows = parsed.get("candidates")
    if not isinstance(rows, list):
        raise ValueError("Claude 응답에 candidates 배열이 없습니다.")

    by_id = {candidate.user_id: candidate for candidate in candidates}
    reranked: list[RecommendationCandidate] = []

    for row in rows:
        if not isinstance(row, dict):
            continue
        user_id = row.get("user_id")
        if not isinstance(user_id, int) or user_id not in by_id:
            continue
        candidate = by_id[user_id]
        reasons = row.get("reasons")
        if isinstance(reasons, list) and reasons:
            candidate.reasons = [str(reason) for reason in reasons[:3]]
        candidate.recommendation_source = "claude"
        reranked.append(candidate)

    if not reranked:
        raise ValueError("Claude 응답에 유효한 추천 후보가 없습니다.")

    used_ids = {candidate.user_id for candidate in reranked}
    remaining = [
        candidate
        for candidate in sorted(candidates, key=lambda item: item.score, reverse=True)
        if candidate.user_id not in used_ids
    ]
    ordered = (reranked + remaining)[:3]
    for index, candidate in enumerate(ordered, start=1):
        candidate.rank = index
    questions = parsed.get("clarifying_questions")
    clarifying_questions = (
        [str(question) for question in questions[:2]]
        if isinstance(questions, list)
        else []
    )
    return ordered, True, clarifying_questions


@router.get("/work-queue/today", response_model=list[WorkQueueItem])
def get_today_work_queue(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    subprojects = db.scalars(
        select(SubProject)
        .where(
            SubProject.assignee_id == current_user.id,
            SubProject.start_date <= today,
            SubProject.end_date >= today,
        )
        .order_by(SubProject.start_date.asc(), SubProject.id.asc())
    ).all()

    projects = (
        {
            project.id: project
            for project in db.scalars(
                select(Project).where(
                    Project.id.in_([subproject.project_id for subproject in subprojects])
                )
            ).all()
        }
        if subprojects
        else {}
    )

    return [
        WorkQueueItem(
            id=subproject.id,
            project_id=subproject.project_id,
            project_name=projects.get(subproject.project_id).name
            if projects.get(subproject.project_id)
            else "프로젝트",
            subproject_id=subproject.id,
            subproject_name=subproject.name,
            start_date=subproject.start_date,
            end_date=subproject.end_date,
            progress=float(subproject.progress),
            priority_hint="마감 임박" if subproject.end_date <= today else "오늘 진행",
        )
        for subproject in subprojects
    ]


@router.get("/work-logs", response_model=list[WorkLogResponse])
def list_work_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.scalars(
        select(WorkLog)
        .where(WorkLog.user_id == current_user.id)
        .order_by(WorkLog.created_at.desc(), WorkLog.id.desc())
    ).all()


@router.get("/work-logs/admin-summary", response_model=list[WorkLogUserSummary])
def list_work_log_admin_summary(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    now = _utcnow()
    users = db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.name.asc())
    ).all()
    logs = db.scalars(select(WorkLog).order_by(WorkLog.created_at.desc())).all()

    buckets: dict[int, dict[str, object]] = {
        user.id: {
            "user": user,
            "total_seconds": 0,
            "running_seconds": 0,
            "paused_seconds": 0,
            "completed_seconds": 0,
            "log_count": 0,
            "running_count": 0,
            "last_task_name": None,
            "last_logged_at": None,
        }
        for user in users
    }

    for log in logs:
        bucket = buckets.get(log.user_id)
        if bucket is None:
            continue
        log_time = (
            now
            if log.status == WORKLOG_RUNNING
            else log.ended_at or log.current_started_at or log.started_at or log.created_at
        )
        log_date = log_time.date()
        if start_date is not None and log_date < start_date:
            continue
        if end_date is not None and log_date > end_date:
            continue
        elapsed = log.duration_sec
        if log.status == WORKLOG_RUNNING and log.current_started_at:
            elapsed += max(0, int((now - log.current_started_at).total_seconds()))
            bucket["running_seconds"] = int(bucket["running_seconds"]) + elapsed
            bucket["running_count"] = int(bucket["running_count"]) + 1
        elif log.status == WORKLOG_PAUSED:
            bucket["paused_seconds"] = int(bucket["paused_seconds"]) + elapsed
        elif log.status == WORKLOG_COMPLETED:
            bucket["completed_seconds"] = int(bucket["completed_seconds"]) + elapsed

        bucket["total_seconds"] = int(bucket["total_seconds"]) + elapsed
        bucket["log_count"] = int(bucket["log_count"]) + 1
        last_logged_at = bucket["last_logged_at"]
        if last_logged_at is None or log_time > last_logged_at:
            bucket["last_task_name"] = log.task_name
            bucket["last_logged_at"] = log_time

    return [
        WorkLogUserSummary(
            user_id=user.id,
            user_name=user.name,
            center=user.center,
            office=user.office,
            team=user.team,
            total_seconds=int(bucket["total_seconds"]),
            running_seconds=int(bucket["running_seconds"]),
            paused_seconds=int(bucket["paused_seconds"]),
            completed_seconds=int(bucket["completed_seconds"]),
            log_count=int(bucket["log_count"]),
            running_count=int(bucket["running_count"]),
            last_task_name=bucket["last_task_name"],
            last_logged_at=bucket["last_logged_at"],
        )
        for user_id, bucket in buckets.items()
        for user in [bucket["user"]]
    ]


@router.post("/work-logs/start", response_model=WorkLogResponse, status_code=status.HTTP_201_CREATED)
def start_work_log(
    payload: WorkLogStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = _utcnow()
    running_logs = db.scalars(
        select(WorkLog).where(
            WorkLog.user_id == current_user.id,
            WorkLog.status == WORKLOG_RUNNING,
        )
    ).all()

    for running_log in running_logs:
        if running_log.id in payload.continue_with_ids:
            continue
        if running_log.current_started_at:
            running_log.duration_sec += int(
                (now - running_log.current_started_at).total_seconds()
            )
        running_log.current_started_at = None
        running_log.status = WORKLOG_PAUSED

    resumable_log = db.scalar(
        select(WorkLog)
        .where(
            WorkLog.user_id == current_user.id,
            WorkLog.status == WORKLOG_PAUSED,
            WorkLog.subproject_id == payload.subproject_id,
            WorkLog.task_name == payload.task_name,
        )
        .order_by(WorkLog.created_at.desc(), WorkLog.id.desc())
    )
    if resumable_log:
        resumable_log.status = WORKLOG_RUNNING
        resumable_log.current_started_at = now
        db.commit()
        db.refresh(resumable_log)
        return resumable_log

    log = WorkLog(
        user_id=current_user.id,
        subproject_id=payload.subproject_id,
        task_name=payload.task_name,
        started_at=now,
        current_started_at=now,
        duration_sec=0,
        status=WORKLOG_RUNNING,
        session_group_id=uuid4().hex,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.post("/work-logs/{log_id}/pause", response_model=WorkLogResponse)
def pause_work_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="작업 기록을 찾을 수 없습니다.")
    if log.status != WORKLOG_RUNNING:
        return log

    now = _utcnow()
    if log.current_started_at:
        log.duration_sec += int((now - log.current_started_at).total_seconds())
    log.current_started_at = None
    log.status = WORKLOG_PAUSED
    db.commit()
    db.refresh(log)
    return log


@router.post("/work-logs/{log_id}/resume", response_model=WorkLogResponse)
def resume_work_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="작업 기록을 찾을 수 없습니다.")
    if log.status == WORKLOG_COMPLETED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="완료된 작업은 다시 시작할 수 없습니다.")

    log.status = WORKLOG_RUNNING
    log.current_started_at = _utcnow()
    db.commit()
    db.refresh(log)
    return log


def _subproject_assignee_ids(subproject: SubProject) -> set[int]:
    ids = {user.id for user in (subproject.assignees or [])}
    if subproject.assignee_id is not None:
        ids.add(subproject.assignee_id)
    return ids


def _estimate_worked_minutes(db: Session, subproject_id: int, assignee_id: int) -> int:
    logs = db.scalars(
        select(WorkLog).where(
            WorkLog.subproject_id == subproject_id,
            WorkLog.user_id == assignee_id,
        )
    ).all()
    total_seconds = sum(log.duration_sec for log in logs)
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
    return " ".join(str(token).strip() for token in tokens if token and str(token).strip())


def _sync_completed_subproject_history(
    db: Session,
    project: Project,
    subproject: SubProject,
    completed_user_ids: set[int] | None = None,
) -> None:
    assignee_ids = sorted(_subproject_assignee_ids(subproject))
    if not assignee_ids:
        return
    target_user_ids = (
        sorted(set(assignee_ids) & completed_user_ids)
        if completed_user_ids is not None
        else assignee_ids
    )
    if not target_user_ids:
        return

    existing_rows = db.scalars(
        select(ProjectExecutionHistory).where(
            ProjectExecutionHistory.subproject_id == subproject.id
        )
    ).all()
    auto_by_user = {
        row.user_id: row for row in existing_rows if not row.manual_override
    }
    if completed_user_ids is None:
        for row in auto_by_user.values():
            if row.user_id not in target_user_ids:
                db.delete(row)

    fallback_minutes = (
        subproject.total_minutes
        or subproject.avg_expected_minutes
        or max(1, (subproject.end_date - subproject.start_date).days + 1) * 60
    )

    for assignee_id in target_user_ids:
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
        history.completion_rate = 100
        history.keyword_text = _build_history_keywords(project, subproject)


def _complete_linked_subproject(
    db: Session,
    subproject_id: int | None,
    completed_at: datetime,
    completed_user_ids: set[int],
) -> None:
    if subproject_id is None:
        return

    subproject = db.scalar(
        select(SubProject)
        .options(
            selectinload(SubProject.subtasks),
            selectinload(SubProject.assignees),
        )
        .where(SubProject.id == subproject_id)
    )
    if subproject is None:
        return

    assignee_ids = _subproject_assignee_ids(subproject)
    completed_assignee_ids = set[int]()
    if assignee_ids:
        completed_assignee_ids = set(
            db.scalars(
                select(WorkLog.user_id).where(
                    WorkLog.subproject_id == subproject.id,
                    WorkLog.status == WORKLOG_COMPLETED,
                    WorkLog.user_id.in_(assignee_ids),
                )
            ).all()
        ) | (completed_user_ids & assignee_ids)
        project = db.get(Project, subproject.project_id)
        if project is not None:
            _sync_completed_subproject_history(
                db,
                project,
                subproject,
                completed_user_ids=completed_user_ids,
            )
        if not assignee_ids.issubset(completed_assignee_ids):
            return

    if subproject.status != STATUS_COMPLETED:
        for task in subproject.subtasks:
            task.is_done = True
            if task.done_at is None:
                task.done_at = completed_at

        subproject.progress = 100
        subproject.status = STATUS_COMPLETED
        if subproject.completed_on is None:
            subproject.completed_on = completed_at.date()

    project = db.get(Project, subproject.project_id)
    if project is not None:
        _sync_completed_subproject_history(
            db,
            project,
            subproject,
            completed_user_ids=completed_assignee_ids or completed_user_ids,
        )


@router.post("/work-logs/{log_id}/complete", response_model=WorkLogResponse)
def complete_work_log(
    log_id: int,
    payload: WorkLogComplete,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="작업 기록을 찾을 수 없습니다.")

    now = _utcnow()
    if log.status == WORKLOG_RUNNING and log.current_started_at:
        log.duration_sec += int((now - log.current_started_at).total_seconds())
    log.current_started_at = None
    log.ended_at = now
    log.status = WORKLOG_COMPLETED
    completed_subproject_user_ids: dict[int | None, set[int]] = {
        log.subproject_id: {current_user.id}
    }

    for archive_id in payload.archived_ids:
        archived = db.get(WorkLog, archive_id)
        if not archived or archived.user_id != current_user.id:
            continue
        if archived.current_started_at:
            archived.duration_sec += int(
                (now - archived.current_started_at).total_seconds()
            )
        archived.current_started_at = None
        archived.ended_at = now
        archived.status = WORKLOG_COMPLETED
        completed_subproject_user_ids.setdefault(archived.subproject_id, set()).add(
            current_user.id
        )

    for subproject_id, user_ids in completed_subproject_user_ids.items():
        _complete_linked_subproject(db, subproject_id, now, user_ids)

    db.commit()
    db.refresh(log)
    return log


@router.delete("/work-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    log = db.get(WorkLog, log_id)
    if not log or log.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="작업 기록을 찾을 수 없습니다.")
    db.delete(log)
    db.commit()
    return None


@router.post("/ai/recommendations", response_model=RecommendationResponse)
async def recommend_assignees(
    payload: RecommendationRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    project_participant_ids: set[int] | None = None
    selected_subproject: SubProject | None = None
    if payload.project_id is not None:
        project = db.scalar(
            select(Project)
            .options(selectinload(Project.participants))
            .where(Project.id == payload.project_id)
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="프로젝트를 찾을 수 없습니다.",
            )
        project_participant_ids = {participant.id for participant in project.participants}

    if payload.subproject_id is not None:
        selected_subproject = db.get(SubProject, payload.subproject_id)
        if not selected_subproject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="하위 프로젝트를 찾을 수 없습니다.",
            )
        if payload.project_id is not None and selected_subproject.project_id != payload.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="선택한 하위 프로젝트가 프로젝트에 속하지 않습니다.",
            )

    users = db.scalars(
        select(User).where(User.is_active.is_(True)).order_by(User.name.asc())
    ).all()
    active_subprojects = db.scalars(
        select(SubProject)
        .options(selectinload(SubProject.assignees))
        .where(SubProject.status != "completed")
    ).all()
    all_projects = {project.id: project for project in db.scalars(select(Project)).all()}
    completed_logs = db.scalars(
        select(WorkLog).where(WorkLog.status == WORKLOG_COMPLETED)
    ).all()
    history_rows = db.scalars(select(ProjectExecutionHistory)).all()
    history_by_user: dict[int, list[ProjectExecutionHistory]] = {}
    for row in history_rows:
        history_by_user.setdefault(row.user_id, []).append(row)
    completed_logs_by_user: dict[int, list[WorkLog]] = {}
    for log in completed_logs:
        completed_logs_by_user.setdefault(log.user_id, []).append(log)
    target_terms = _subproject_relevance_terms(payload, selected_subproject)
    history_time_terms = _history_time_match_terms(payload, selected_subproject)
    relevant_history_rows = _history_rows_matching_terms(history_rows, history_time_terms)
    baseline_history_minutes = _target_standard_minutes(
        selected_subproject,
        relevant_history_rows,
    )

    keyword = payload.project_name.strip().lower()
    recent_history_cutoff = date.fromordinal(max(1, date.today().toordinal() - RECENT_HISTORY_DAYS))
    candidates: list[RecommendationCandidate] = []

    for user in users:
        if _should_exclude_from_assignment(user):
            continue
        if project_participant_ids is not None and user.id not in project_participant_ids:
            continue
        if not _matches_org_scope(user, payload.office, payload.team):
            continue
        assigned_subprojects = [
            subproject
            for subproject in active_subprojects
            if user.id in _subproject_assignee_ids(subproject)
        ]
        remaining_minutes = sum(
            subproject.total_minutes or subproject.avg_expected_minutes or DEFAULT_TASK_MINUTES
            for subproject in assigned_subprojects
        )
        availability_score = max(0.0, min(100.0, 100 - (remaining_minutes / AVAILABILITY_SCALE)))

        same_type_count = sum(
            1
            for subproject in assigned_subprojects
            if all_projects.get(subproject.project_id)
            and all_projects[subproject.project_id].project_type == payload.project_type
        )
        keyword_hits = sum(
            1
            for log in completed_logs
            if log.user_id == user.id and keyword and keyword[:6] in log.task_name.lower()
        )
        history_for_user = history_by_user.get(user.id, [])
        relevant_history_for_user = _history_rows_matching_terms(
            history_for_user,
            history_time_terms,
        )
        average_history_minutes = _average_history_minutes(relevant_history_for_user)
        history_time_sample_count = len(
            [row for row in relevant_history_for_user if int(row.worked_minutes or 0) > 0]
        )
        history_time_score = _history_time_score(
            average_history_minutes,
            baseline_history_minutes,
        )
        project_relevance_score, project_relevance_evidence = _project_relevance_score(
            target_terms,
            history_for_user,
            completed_logs_by_user.get(user.id, []),
        )
        history_type_count = sum(
            1 for row in history_for_user if row.project_type == payload.project_type
        )
        history_keyword_hits = sum(
            1
            for row in history_for_user
            if keyword and keyword[:6] in (row.keyword_text or "").lower()
        )
        recent_history_count = sum(
            1
            for row in history_for_user
            if row.ended_on and row.ended_on >= recent_history_cutoff
        )
        average_completion_rate = (
            sum(float(row.completion_rate) for row in history_for_user) / len(history_for_user)
            if history_for_user
            else 0.0
        )
        history_experience_count = history_type_count + history_keyword_hits + recent_history_count
        capability_signal_score = min(
            50.0,
            same_type_count * SCORE_WEIGHT_SAME_TYPE
            + keyword_hits * SCORE_WEIGHT_LOG_KEYWORD
            + history_type_count * SCORE_WEIGHT_HISTORY_TYPE
            + history_keyword_hits * SCORE_WEIGHT_HISTORY_KEYWORD
            + recent_history_count * SCORE_WEIGHT_RECENT_HISTORY
            + average_completion_rate * SCORE_WEIGHT_COMPLETION_RATE
            + SCORE_BASE,
        )
        capability_score = min(
            100.0,
            capability_signal_score
            + history_time_score * SCORE_WEIGHT_HISTORY_TIME
            + project_relevance_score * SCORE_WEIGHT_PROJECT_RELEVANCE,
        )
        final_score = (
            payload.availability_weight * availability_score
            + payload.capability_weight * capability_score
        )

        candidates.append(
            RecommendationCandidate(
                user_id=user.id,
                name=user.name,
                role=user.role,
                position=user.position,
                rank=0,
                score=round(final_score, 2),
                availability_score=round(availability_score, 2),
                capability_score=round(capability_score, 2),
                remaining_minutes=remaining_minutes,
                average_history_minutes=average_history_minutes,
                history_time_score=round(history_time_score, 2),
                history_time_sample_count=history_time_sample_count,
                project_relevance_score=round(project_relevance_score, 2),
                project_relevance_evidence=project_relevance_evidence,
                keyword_experience_count=keyword_hits + same_type_count,
                history_experience_count=history_experience_count,
                recommendation_source="rule",
                reasons=_recommendation_reasons(
                    user=user,
                    availability_score=availability_score,
                    capability_score=capability_score,
                    remaining_minutes=remaining_minutes,
                    keyword_hits=keyword_hits + same_type_count,
                    history_hits=history_experience_count,
                    average_history_minutes=average_history_minutes,
                    history_time_score=history_time_score,
                    history_time_sample_count=history_time_sample_count,
                    project_relevance_score=project_relevance_score,
                    project_relevance_evidence=project_relevance_evidence,
                ),
            )
        )

    ranked_candidates = sorted(candidates, key=lambda item: item.score, reverse=True)
    top_candidates = _top_candidates_by_score(ranked_candidates)

    claude_used = False
    claude_error: str | None = None
    clarifying_questions = _rule_based_clarifying_questions(target_terms, top_candidates)
    try:
        top_candidates, claude_used, claude_questions = await _rerank_candidates_with_claude(
            payload,
            ranked_candidates,
            target_terms,
        )
        if claude_questions:
            clarifying_questions = claude_questions
    except Exception as exc:
        claude_error = str(exc)

    top_candidates = _top_candidates_by_score(ranked_candidates)

    return RecommendationResponse(
        request=payload,
        candidates=top_candidates,
        clarifying_questions=clarifying_questions,
        claude_used=claude_used,
        claude_error=claude_error,
    )


@router.post("/ai/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
def assign_recommended_work(
    payload: AssignmentRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    assignee = db.get(User, payload.assignee_id)
    if not assignee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="담당자를 찾을 수 없습니다.")

    if payload.subproject_id is not None:
        subproject = db.scalar(
            select(SubProject)
            .options(selectinload(SubProject.assignees))
            .where(SubProject.id == payload.subproject_id)
        )
        if not subproject:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="하위 프로젝트를 찾을 수 없습니다.",
            )
        if payload.project_id is not None and subproject.project_id != payload.project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="선택한 하위 프로젝트가 프로젝트에 속하지 않습니다.",
            )

        project = db.scalar(
            select(Project)
            .options(selectinload(Project.participants))
            .where(Project.id == subproject.project_id)
        )
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="프로젝트를 찾을 수 없습니다.",
            )
        participant_ids = {user.id for user in project.participants}
        if assignee.id not in participant_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="선택한 프로젝트 참여 인원만 배정할 수 있습니다.",
            )

        if assignee.id not in {user.id for user in subproject.assignees}:
            subproject.assignees.append(assignee)
        if subproject.assignee_id is None:
            subproject.assignee_id = assignee.id

        db.commit()
        db.refresh(subproject)
        return AssignmentResponse(
            project_id=project.id,
            subproject_id=subproject.id,
            assignee_id=assignee.id,
            assigned_member_name=assignee.name,
        )

    project = Project(
        major_project_id=_default_major_project_id(db),
        name=payload.project_name,
        project_type=payload.project_type if payload.project_type in PROJECT_TYPES else "general",
        created_by=admin.id,
    )
    db.add(project)
    db.flush()

    subproject = SubProject(
        project_id=project.id,
        name=payload.subproject_name,
        assignee_id=assignee.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="planned",
        progress=0,
    )
    db.add(subproject)
    db.flush()

    if payload.apply_template:
        template = db.scalar(
            select(ProjectTemplate).where(
                ProjectTemplate.project_type == project.project_type,
                ProjectTemplate.is_default.is_(True),
            )
        )
        if template:
            for index, item in enumerate(_deserialize_tasks(template), start=1):
                db.add(
                    SubTask(
                        subproject_id=subproject.id,
                        name=item["name"],
                        order_index=index,
                        weight=item["weight"],
                        is_done=False,
                    )
                )

    db.commit()
    db.refresh(subproject)
    return AssignmentResponse(
        project_id=project.id,
        subproject_id=subproject.id,
        assignee_id=assignee.id,
        assigned_member_name=assignee.name,
    )


@router.get("/settings/me", response_model=UserSettingsResponse)
def get_my_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings_row = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.id))
    if not settings_row:
        settings_row = UserSetting(user_id=current_user.id)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)

    return UserSettingsResponse(
        id=current_user.id,
        idnum=current_user.idnum,
        name=current_user.name,
        role=current_user.role,
        default_calendar_view=settings_row.default_calendar_view,
        notifications_enabled=settings_row.notifications_enabled,
    )


@router.put("/settings/me", response_model=UserSettingsResponse)
def update_my_settings(
    payload: UserSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings_row = db.scalar(select(UserSetting).where(UserSetting.user_id == current_user.id))
    if not settings_row:
        settings_row = UserSetting(user_id=current_user.id)
        db.add(settings_row)
        db.flush()

    if payload.name is not None:
        current_user.name = payload.name
    if payload.new_password is not None:
        if not payload.current_password or not verify_password(
            payload.current_password, current_user.password_hash
        ):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="현재 비밀번호가 올바르지 않습니다.")
        current_user.password_hash = hash_password(payload.new_password)
    if payload.default_calendar_view is not None:
        settings_row.default_calendar_view = payload.default_calendar_view
    if payload.notifications_enabled is not None:
        settings_row.notifications_enabled = payload.notifications_enabled

    db.commit()
    db.refresh(settings_row)

    return UserSettingsResponse(
        id=current_user.id,
        idnum=current_user.idnum,
        name=current_user.name,
        role=current_user.role,
        default_calendar_view=settings_row.default_calendar_view,
        notifications_enabled=settings_row.notifications_enabled,
    )


@router.get("/templates", response_model=list[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    templates = db.scalars(
        select(ProjectTemplate).order_by(ProjectTemplate.created_at.desc())
    ).all()
    return [_serialize_template_response(template) for template in templates]


@router.post("/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    template = ProjectTemplate(
        name=payload.name,
        project_type=payload.project_type,
        trigger_keyword=payload.trigger_keyword,
        is_default=payload.is_default,
        tasks_json=json.dumps([item.model_dump() for item in payload.tasks]),
        created_by=admin.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return _serialize_template_response(template)


@router.put("/templates/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    payload: TemplateCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(ProjectTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="템플릿을 찾을 수 없습니다.")

    template.name = payload.name
    template.project_type = payload.project_type
    template.trigger_keyword = payload.trigger_keyword
    template.is_default = payload.is_default
    template.tasks_json = json.dumps([item.model_dump() for item in payload.tasks])
    db.commit()
    db.refresh(template)
    return _serialize_template_response(template)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    template = db.get(ProjectTemplate, template_id)
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="템플릿을 찾을 수 없습니다.")
    db.delete(template)
    db.commit()
    return None
