from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import sys

from sqlalchemy import select


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.security import hash_password
from app.db import SessionLocal
from app.models import Base  # noqa: F401
from app.models.progress_log import ProgressLog
from app.models.project import (
    DEFAULT_SUBTASK_TEMPLATE,
    ETC_SUBTASK_TEMPLATE,
    INSPECTION_SUBTASK_TEMPLATE,
    Project,
    SubProject,
    SubTask,
)
from app.models.user import User


PROJECT_TEMPLATE_BY_TYPE = {
    "general": DEFAULT_SUBTASK_TEMPLATE,
    "official_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "regular_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "change_inspection": INSPECTION_SUBTASK_TEMPLATE,
    "etc_task": ETC_SUBTASK_TEMPLATE,
}


USERS = [
    {
        "idnum": "A1001",
        "name": "김현우",
        "role": "admin",
        "password": "Admin1234!",
    },
    {
        "idnum": "M2001",
        "name": "박지민",
        "role": "member",
        "password": "Member1234!",
    },
    {
        "idnum": "M2002",
        "name": "이서준",
        "role": "member",
        "password": "Member1234!",
    },
    {
        "idnum": "M2003",
        "name": "최민서",
        "role": "member",
        "password": "Member1234!",
    },
    {
        "idnum": "M2004",
        "name": "정하늘",
        "role": "member",
        "password": "Member1234!",
    },
]


PROJECTS = [
    {
        "name": "[Sample] 2026 상반기 일반 협업 개선",
        "project_type": "general",
        "subprojects": [
            {
                "name": "대시보드 KPI 카드 개선",
                "assignee": "M2003",
                "start_offset": -9,
                "end_offset": 4,
                "done_count": 2,
                "fields": {},
            },
            {
                "name": "개인 캘린더 필터 정리",
                "assignee": "M2004",
                "start_offset": -3,
                "end_offset": 7,
                "done_count": 0,
                "fields": {},
            },
        ],
        "logs": [
            {"user": "M2003", "days_ago": 2, "progress": 40, "comment": "대시보드 KPI 카드 정렬 구조 초안 완료"},
            {"user": "M2004", "days_ago": 1, "progress": 15, "comment": "캘린더 필터 요구사항 정리 중"},
        ],
    },
    {
        "name": "[Sample] CN8 공식 검증 4월",
        "project_type": "official_inspection",
        "subprojects": [
            {
                "name": "CN8 LV2 배터리 제어기 공식 검증",
                "assignee": "M2001",
                "start_offset": -12,
                "end_offset": 2,
                "done_count": 3,
                "fields": {
                    "priority": "high",
                    "controller_name": "BMS Main",
                    "controller_version": "v2.4.1",
                    "controller_country": "KR",
                    "to_number": "TO-2404-101",
                    "to_assignee": "김현우",
                    "verification_level": "LV2",
                    "vehicle_type": "CN8 LV2",
                    "function_name": "배터리 보호 로직",
                    "function_owner": "최민서",
                    "verifier": "M2001",
                    "reviewer": "M2002",
                    "seat_no": "LAB-03",
                    "controller_no": "CTRL-BMS-204",
                    "avg_expected_minutes": 420,
                    "issue_note": "저온 시동 조건에서 재현 필요",
                    "upload_done": False,
                    "special_note": "4월 말 고객 리뷰 예정",
                    "first_verify_status": "review_done",
                    "first_setup_min": 60,
                    "first_aud_min": 210,
                    "first_review_min": 45,
                    "inreview_status": "inreview_in_progress",
                    "inreview_setup_min": 25,
                    "inreview_aud_min": 90,
                    "inreview_feedback_min": 35,
                },
            }
        ],
        "logs": [
            {"user": "M2001", "days_ago": 3, "progress": 55, "comment": "1차 검증 완료, 리뷰 문서 작성"},
            {"user": "M2002", "days_ago": 1, "progress": 70, "comment": "InReview 피드백 반영 확인 중"},
        ],
    },
    {
        "name": "[Sample] 정기 검증 주간 운영",
        "project_type": "regular_inspection",
        "subprojects": [
            {
                "name": "PHEV 통합 제어기 정기 검증",
                "assignee": "M2001",
                "start_offset": -6,
                "end_offset": 5,
                "done_count": 1,
                "fields": {
                    "priority": "medium",
                    "controller_name": "HCU",
                    "controller_version": "2026.04",
                    "controller_country": "KR",
                    "to_number": "TO-2404-118",
                    "verification_level": "BSW",
                    "vehicle_type": "PHEV",
                    "function_name": "에너지 매니지먼트",
                    "function_owner": "박지민",
                    "verifier": "M2001",
                    "reviewer": "M2002",
                    "seat_no": "LAB-07",
                    "controller_no": "HCU-7781",
                    "avg_expected_minutes": 300,
                    "first_verify_status": "in_progress",
                    "first_setup_min": 40,
                    "first_aud_min": 120,
                    "first_review_min": 0,
                    "inreview_status": "not_started",
                },
            }
        ],
        "logs": [
            {"user": "M2001", "days_ago": 1, "progress": 30, "comment": "정기 검증 시나리오 1차 수행"},
        ],
    },
    {
        "name": "[Sample] 변경점 검증 CR 묶음",
        "project_type": "change_inspection",
        "subprojects": [
            {
                "name": "CR-2026-0412 회생제동 변경점 검증",
                "assignee": "M2003",
                "start_offset": -8,
                "end_offset": 1,
                "done_count": 4,
                "fields": {
                    "priority": "high",
                    "controller_name": "VCU",
                    "controller_version": "2026.04-hotfix2",
                    "controller_country": "KR",
                    "to_number": "TO-2404-133",
                    "verification_level": "LV3",
                    "vehicle_type": "HEV",
                    "function_name": "회생제동 전환",
                    "function_owner": "최민서",
                    "verifier": "M2003",
                    "reviewer": "M2002",
                    "seat_no": "LAB-11",
                    "controller_no": "VCU-1042",
                    "avg_expected_minutes": 280,
                    "first_verify_status": "uploaded",
                    "first_setup_min": 35,
                    "first_aud_min": 110,
                    "first_review_min": 25,
                    "inreview_status": "inreview_done",
                    "inreview_setup_min": 20,
                    "inreview_aud_min": 60,
                    "inreview_feedback_min": 20,
                    "cr_no": "CR-2026-0412",
                    "ip_addr": "10.20.30.45",
                    "change_feedback_min": 40,
                    "change_revalidate_min": 55,
                    "lin_std_hold_note": "STD 기준 만족, HOLD 없음",
                    "upload_done": True,
                    "completed_on": date.today() - timedelta(days=1),
                },
            }
        ],
        "logs": [
            {"user": "M2003", "days_ago": 2, "progress": 85, "comment": "변경점 검증 업로드 직전 확인 완료"},
        ],
    },
    {
        "name": "[Sample] 기타 업무 운영 패키지",
        "project_type": "etc_task",
        "subprojects": [
            {
                "name": "4월 검증 교육 운영",
                "assignee": "M2004",
                "start_offset": -4,
                "end_offset": 2,
                "done_count": 2,
                "fields": {
                    "etc_category": "education",
                    "etc_month": date.today().strftime("%Y-%m"),
                    "etc_days": 2,
                    "etc_note": "신규 입사자 대상 검증 프로세스 교육",
                },
            },
            {
                "name": "FAIL 유형 분류 정리",
                "assignee": "M2002",
                "start_offset": -2,
                "end_offset": 6,
                "done_count": 1,
                "fields": {
                    "etc_category": "fail_classification",
                    "etc_month": date.today().strftime("%Y-%m"),
                    "etc_days": Decimal("1.5"),
                    "etc_note": "최근 3개월 FAIL 유형 분류 기준 재정리",
                },
            },
        ],
        "logs": [
            {"user": "M2004", "days_ago": 1, "progress": 60, "comment": "교육 자료 배포와 참석자 안내 완료"},
        ],
    },
]


def get_or_create_user(session, spec: dict[str, str]) -> User:
    user = session.scalar(select(User).where(User.idnum == spec["idnum"]))
    if user:
        return user

    user = User(
        idnum=spec["idnum"],
        name=spec["name"],
        role=spec["role"],
        password_hash=hash_password(spec["password"]),
        is_active=True,
    )
    session.add(user)
    session.flush()
    return user


def get_or_create_project(session, name: str, project_type: str, created_by: int) -> Project:
    project = session.scalar(select(Project).where(Project.name == name))
    if project:
        return project

    project = Project(name=name, project_type=project_type, created_by=created_by)
    session.add(project)
    session.flush()
    return project


def apply_done_state(subproject: SubProject, done_count: int) -> None:
    for index, task in enumerate(subproject.subtasks):
        if index < done_count:
            task.is_done = True
            task.done_at = datetime.now(timezone.utc) - timedelta(days=done_count - index)

    total_weight = sum(Decimal(str(task.weight)) for task in subproject.subtasks) or Decimal("1")
    done_weight = sum(
        Decimal(str(task.weight))
        for index, task in enumerate(subproject.subtasks)
        if index < done_count
    )
    subproject.progress = round(float(done_weight / total_weight * Decimal("100")), 2)
    if subproject.progress >= 100:
        subproject.status = "completed"
    elif done_count > 0:
        subproject.status = "in_progress"
    else:
        subproject.status = "planned"


def get_or_create_subproject(
    session,
    project: Project,
    users_by_idnum: dict[str, User],
    spec: dict,
) -> SubProject:
    subproject = session.scalar(
        select(SubProject).where(
            SubProject.project_id == project.id,
            SubProject.name == spec["name"],
        )
    )
    if subproject:
        return subproject

    today = date.today()
    subproject = SubProject(
        project_id=project.id,
        name=spec["name"],
        assignee_id=users_by_idnum[spec["assignee"]].id,
        start_date=today + timedelta(days=spec["start_offset"]),
        end_date=today + timedelta(days=spec["end_offset"]),
        status="planned",
        progress=0,
    )

    fields = dict(spec.get("fields", {}))
    verifier_idnum = fields.pop("verifier", None)
    reviewer_idnum = fields.pop("reviewer", None)
    if verifier_idnum:
        fields["verifier_id"] = users_by_idnum[verifier_idnum].id
    if reviewer_idnum:
        fields["reviewer_id"] = users_by_idnum[reviewer_idnum].id

    for key, value in fields.items():
        setattr(subproject, key, value)

    template = PROJECT_TEMPLATE_BY_TYPE.get(project.project_type, DEFAULT_SUBTASK_TEMPLATE)
    for index, (task_name, weight) in enumerate(template, start=1):
        subproject.subtasks.append(
            SubTask(
                name=task_name,
                order_index=index,
                weight=weight,
                is_done=False,
            )
        )

    apply_done_state(subproject, spec.get("done_count", 0))

    session.add(subproject)
    session.flush()
    return subproject


def create_progress_logs(
    session,
    project: Project,
    users_by_idnum: dict[str, User],
    logs: list[dict],
) -> None:
    for spec in logs:
        work_date = date.today() - timedelta(days=spec["days_ago"])
        existing = session.scalar(
            select(ProgressLog).where(
                ProgressLog.project_id == project.id,
                ProgressLog.user_id == users_by_idnum[spec["user"]].id,
                ProgressLog.work_date == work_date,
                ProgressLog.comment == spec["comment"],
            )
        )
        if existing:
            continue

        session.add(
            ProgressLog(
                project_id=project.id,
                user_id=users_by_idnum[spec["user"]].id,
                progress_percent=spec["progress"],
                comment=spec["comment"],
                work_date=work_date,
            )
        )


def main() -> None:
    session = SessionLocal()
    try:
        users_by_idnum: dict[str, User] = {}
        for user_spec in USERS:
            user = get_or_create_user(session, user_spec)
            users_by_idnum[user_spec["idnum"]] = user

        admin = users_by_idnum["A1001"]
        for project_spec in PROJECTS:
            project = get_or_create_project(
                session,
                name=project_spec["name"],
                project_type=project_spec["project_type"],
                created_by=admin.id,
            )
            for subproject_spec in project_spec["subprojects"]:
                get_or_create_subproject(session, project, users_by_idnum, subproject_spec)
            create_progress_logs(session, project, users_by_idnum, project_spec.get("logs", []))

        session.commit()
        print("Dummy data seeded successfully.")
        print("Sample admin login: A1001 / Admin1234!")
        print("Sample member login: M2001 / Member1234!")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
