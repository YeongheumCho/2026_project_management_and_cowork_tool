"""B-111: 스톱워치가 잰 시간을 검증 시간(세팅/AUD/작성)에 자동으로 더한다."""
from datetime import date, datetime, timedelta, timezone

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
from app.models.workflow import WorkLog


@pytest.fixture
def env():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        member = User(idnum="1", name="담당자", password_hash="x", role="member", is_active=True)
        db.add(member)
        db.flush()
        major = MajorProject(name="대", project_types='["general"]', is_default=False)
        major.members = [member]
        db.add(major)
        db.flush()
        project = Project(
            name="중", major_project_id=major.id, project_type="general",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        project.participants = [member]
        db.add(project)
        db.flush()
        sp = SubProject(
            project_id=project.id, name="기능A",
            start_date=date(2026, 2, 1), end_date=date(2026, 2, 28),
        )
        sp.assignees = [member]
        sp.verifiers = [member]
        db.add(sp)
        db.commit()
        ids = {"member": member.id, "sp": sp.id}

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    def _user():
        with Session() as db:
            user = db.get(User, ids["member"])
            db.expunge(user)
            return user

    def rewind(log_id: int, seconds: int):
        """스톱워치를 seconds 초 전에 시작한 것처럼 만든다."""
        with Session() as db:
            log = db.get(WorkLog, log_id)
            log.current_started_at = datetime.now(timezone.utc) - timedelta(seconds=seconds)
            db.commit()

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = _user
    try:
        yield TestClient(app), ids, rewind
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def _entries(client, sp_id):
    return client.get(f"/subprojects/{sp_id}/time-entries").json()


def test_stopwatch_time_goes_to_chosen_part(env):
    client, ids, rewind = env
    r = client.post("/work-logs/start", json={
        "subproject_id": ids["sp"], "task_name": "기능A",
        "time_stage": "first_verify", "time_part": "setup",
    })
    assert r.status_code == 201, r.text
    log = r.json()
    assert log["time_stage"] == "first_verify" and log["time_part"] == "setup"

    # 세팅 10분 → AUD 로 바꾸면 그때까지는 세팅에 들어간다.
    rewind(log["id"], 600)
    r = client.put(f"/work-logs/{log['id']}/time-target",
                   json={"time_stage": "first_verify", "time_part": "aud"})
    assert r.status_code == 200 and r.json()["time_part"] == "aud"
    summary = _entries(client, ids["sp"])
    assert len(summary["entries"]) == 1
    entry = summary["entries"][0]
    assert entry["setup_min"] == 10 and entry["aud_min"] is None
    assert entry["role"] == "verifier" and entry["stage"] == "first_verify"

    # AUD 5분 30초 뒤 일시정지: 5분만 들어가고 30초는 남는다.
    rewind(log["id"], 330)
    client.post(f"/work-logs/{log['id']}/pause")
    assert _entries(client, ids["sp"])["entries"][0]["aud_min"] == 5

    # 재개 후 40초 더 재고 완료: 남은 30초 + 40초 = 70초 → 반올림 1분.
    client.post(f"/work-logs/{log['id']}/resume")
    rewind(log["id"], 40)
    client.post(f"/work-logs/{log['id']}/complete", json={"archived_ids": []})
    entry = _entries(client, ids["sp"])["entries"][0]
    assert entry["setup_min"] == 10 and entry["aud_min"] == 6
    assert _entries(client, ids["sp"])["total_min"] == 16


def test_stopwatch_without_target_does_not_touch_verify_time(env):
    client, ids, rewind = env
    log = client.post("/work-logs/start", json={"subproject_id": ids["sp"], "task_name": "기능A"}).json()
    assert log["time_stage"] is None
    rewind(log["id"], 600)
    client.post(f"/work-logs/{log['id']}/pause")
    assert _entries(client, ids["sp"])["entries"] == []

    # 나중에 위치를 골라도 그 전에 잰 10분이 한꺼번에 들어가지 않는다.
    client.put(f"/work-logs/{log['id']}/time-target",
               json={"time_stage": "inreview", "time_part": "work"})
    client.post(f"/work-logs/{log['id']}/resume")
    rewind(log["id"], 120)
    client.post(f"/work-logs/{log['id']}/pause")
    entries = _entries(client, ids["sp"])["entries"]
    assert len(entries) == 1 and entries[0]["stage"] == "inreview" and entries[0]["work_min"] == 2


def test_invalid_time_target_is_rejected(env):
    client, ids, _ = env
    bad = client.post("/work-logs/start", json={
        "subproject_id": ids["sp"], "task_name": "기능A",
        "time_stage": "change", "time_part": "aud",
    })
    assert bad.status_code == 422
    bad = client.post("/work-logs/start", json={
        "subproject_id": ids["sp"], "task_name": "기능A", "time_stage": "first_verify",
    })
    assert bad.status_code == 422
