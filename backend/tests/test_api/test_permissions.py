"""권한·입력 검사 보완 (2026-10-16 사용성 점검에서 찾은 것들)."""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.dependencies import get_current_user, get_db
from app.main import app
from app.models import Base
from app.models.project import MajorProject, Project, SubProject
from app.models.user import User


@pytest.fixture
def env():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        admin = User(idnum="1", name="관리자", password_hash="x", role="admin", is_active=True)
        member = User(idnum="2", name="담당자", password_hash="x", role="member", is_active=True)
        outsider = User(idnum="3", name="외부인", password_hash="x", role="member", is_active=True)
        db.add_all([admin, member, outsider])
        db.flush()
        major = MajorProject(name="대", project_types='["general"]', is_default=False)
        major.members = [admin, member]
        db.add(major)
        db.flush()
        project = Project(
            name="중",
            major_project_id=major.id,
            project_type="general",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        project.participants = [admin, member]
        db.add(project)
        db.flush()
        assigned = SubProject(
            project_id=project.id, name="담당 있음",
            start_date=date(2026, 2, 1), end_date=date(2026, 2, 28),
        )
        assigned.assignees = [member]
        unassigned = SubProject(
            project_id=project.id, name="담당 없음",
            start_date=date(2026, 2, 1), end_date=date(2026, 2, 28),
        )
        db.add_all([assigned, unassigned])
        db.commit()
        ids = {
            "admin": admin.id, "member": member.id, "outsider": outsider.id,
            "project": project.id, "assigned": assigned.id, "unassigned": unassigned.id,
        }

    state = {"user": "member"}

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    def _user():
        with Session() as db:
            user = db.get(User, ids[state["user"]])
            db.expunge(user)
            return user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = _user
    try:
        yield TestClient(app), state, ids
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_stopwatch_only_on_own_subproject(env):
    client, state, ids = env
    assert client.post("/work-logs/start", json={"subproject_id": ids["assigned"], "task_name": "a"}).status_code == 201

    state["user"] = "outsider"
    r = client.post("/work-logs/start", json={"subproject_id": ids["assigned"], "task_name": "a"})
    assert r.status_code == 403
    # 하위 프로젝트 없이 하는 일(회의 등)은 누구나 잴 수 있다
    assert client.post("/work-logs/start", json={"subproject_id": None, "task_name": "회의"}).status_code == 201


def test_stopwatch_on_missing_subproject_is_404_not_500(env):
    client, _, _ = env
    assert client.post("/work-logs/start", json={"subproject_id": 999999, "task_name": "a"}).status_code == 404


def test_unassigned_subproject_is_not_completed_by_stopwatch(env):
    client, state, ids = env
    state["user"] = "admin"
    log = client.post("/work-logs/start", json={"subproject_id": ids["unassigned"], "task_name": "a"}).json()
    assert client.post(f"/work-logs/{log['id']}/complete", json={"archived_ids": []}).status_code == 200
    sub = client.get(f"/subprojects/{ids['unassigned']}").json()
    assert sub["status"] != "completed" and sub["progress"] < 100


def test_assigned_subproject_completes_when_assignee_finishes(env):
    client, _, ids = env
    log = client.post("/work-logs/start", json={"subproject_id": ids["assigned"], "task_name": "a"}).json()
    client.post(f"/work-logs/{log['id']}/complete", json={"archived_ids": []})
    sub = client.get(f"/subprojects/{ids['assigned']}").json()
    assert sub["status"] == "completed"


def test_project_progress_only_for_participants(env):
    client, state, ids = env
    body = {"progress_percent": 10, "work_date": "2026-03-01"}
    assert client.post(f"/projects/{ids['project']}/progress", json=body).status_code == 201
    state["user"] = "outsider"
    assert client.post(f"/projects/{ids['project']}/progress", json=body).status_code == 403


@pytest.mark.parametrize(
    "path_key,body,needle",
    [
        ("sub", {"first_setup_min": 10**12}, "1000000 이하"),
        ("sub", {"avg_expected_minutes": 3_000_000_000}, "1000000 이하"),
        ("sub", {"etc_days": 100000}, "999.99 이하"),
    ],
)
def test_out_of_range_numbers_are_422_in_korean(env, path_key, body, needle):
    client, state, ids = env
    state["user"] = "admin"
    r = client.put(f"/subprojects/{ids['assigned']}", json=body)
    assert r.status_code == 422
    assert needle in r.json()["detail"][0]["msg"]


def test_progress_comment_and_date_limits(env):
    client, _, ids = env
    path = f"/subprojects/{ids['assigned']}/progress"
    r = client.post(path, json={"progress_percent": 1, "work_date": "1900-01-01"})
    assert r.status_code == 422 and r.json()["detail"][0]["msg"].startswith("날짜:")
    r = client.post(path, json={"progress_percent": 1, "work_date": "2026-03-01", "comment": "가" * 2001})
    assert r.status_code == 422 and "2000자 이하" in r.json()["detail"][0]["msg"]


def test_settings_name_is_trimmed(env):
    client, _, _ = env
    assert client.put("/settings/me", json={"name": "   "}).status_code == 422
    r = client.put("/settings/me", json={"name": "  담당자2  "})
    assert r.status_code == 200 and r.json()["name"] == "담당자2"


def test_stopwatch_completion_writes_one_history_row(env):
    """완료 한 번에 수행 이력이 두 줄씩 쌓이던 문제."""
    client, state, ids = env
    log = client.post("/work-logs/start", json={"subproject_id": ids["assigned"], "task_name": "a"}).json()
    client.post(f"/work-logs/{log['id']}/complete", json={"archived_ids": []})
    state["user"] = "admin"
    rows = [r for r in client.get("/projects/history").json() if r["subproject_id"] == ids["assigned"]]
    assert len(rows) == 1


def test_user_with_records_cannot_be_deleted(env):
    """계정 삭제가 업무 기록까지 지우던 문제: 기록이 있으면 막고 퇴사 처리를 안내한다."""
    client, state, ids = env
    client.post(f"/subprojects/{ids['assigned']}/progress", json={"progress_percent": 10, "work_date": "2026-03-01"})
    state["user"] = "admin"
    r = client.delete("/auth/users/2")
    assert r.status_code == 409 and "퇴사 처리" in r.json()["detail"]
    # 기록이 없는 계정은 지울 수 있다
    assert client.delete("/auth/users/3").status_code == 204


@pytest.mark.parametrize("idnum,expected", [("123456", 201), ("abc", 422), ("12a456789", 422)])
def test_admin_created_idnum_is_digits(env, idnum, expected):
    client, state, _ = env
    state["user"] = "admin"
    r = client.post("/auth/users", json={"idnum": idnum, "name": "새사람", "password": "abcdefgh1"})
    assert r.status_code == expected
    if expected == 201:
        assert r.json()["idnum"] == "000123456"


def test_new_and_reactivated_users_join_default_major_project(env):
    """기본 대프로젝트 구성원을 서버 시작 때만 맞추던 문제."""
    client, state, ids = env
    db = next(app.dependency_overrides[get_db]())
    db.add(MajorProject(name="미분류/기본 대프로젝트", project_types='["general"]', is_default=True))
    db.commit()
    db.close()

    def default_member_ids():
        majors = client.get("/major-projects").json()
        return {m["id"] for m in [mp for mp in majors if mp["is_default"]][0]["members"]}

    state["user"] = "admin"
    created = client.post("/auth/users", json={"idnum": "777", "name": "신규입사", "password": "abcdefgh1"}).json()
    assert created["id"] in default_member_ids()

    client.patch("/auth/users/3/active", json={"is_active": False})
    client.patch("/auth/users/3/active", json={"is_active": True})
    assert ids["outsider"] in default_member_ids()


def test_progress_log_completion_records_completed_on(env):
    """B-104: 진행률 기록으로 100% 가 되면 그 날짜가 완료일. 계획 종료일은 그대로."""
    client, _, ids = env
    path = f"/subprojects/{ids['assigned']}/progress"
    assert client.post(path, json={"progress_percent": 100, "work_date": "2026-02-20"}).status_code == 201
    sub = client.get(f"/subprojects/{ids['assigned']}").json()
    assert sub["status"] == "completed"
    assert sub["completed_on"] == "2026-02-20"
    assert sub["end_date"] == "2026-02-28"

    # 다시 내려가면 완료일도 지운다
    client.post(path, json={"progress_percent": 50, "work_date": "2026-02-21"})
    sub = client.get(f"/subprojects/{ids['assigned']}").json()
    assert sub["status"] != "completed" and sub["completed_on"] is None
