"""편집 창을 연 뒤 다른 사람이 먼저 저장했으면 덮어쓰지 않는다 (하위 프로젝트·프로젝트)."""
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
        db.add(admin)
        db.flush()
        major = MajorProject(name="대", project_types='["general"]', is_default=False)
        major.members = [admin]
        db.add(major)
        db.flush()
        project = Project(
            name="중",
            major_project_id=major.id,
            project_type="general",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            created_by=admin.id,
        )
        project.participants = [admin]
        db.add(project)
        db.flush()
        sub = SubProject(
            project_id=project.id,
            name="하위",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 2, 28),
            created_by=admin.id,
        )
        db.add(sub)
        db.commit()
        ids = {"admin": admin.id, "major": major.id, "project": project.id, "sub": sub.id}

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    def _user():
        with Session() as db:
            user = db.get(User, ids["admin"])
            db.expunge(user)
            return user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = _user
    try:
        yield TestClient(app), ids
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_subproject_stale_edit_is_rejected(env):
    client, ids = env
    opened = client.get(f"/subprojects/{ids['sub']}").json()
    assert opened["edit_version"] == 1

    # 먼저 연 사람이 저장
    r = client.put(f"/subprojects/{ids['sub']}", json={"name": "A가 고침", "edit_version": 1})
    assert r.status_code == 200, r.text
    assert r.json()["edit_version"] == 2

    # 같은 버전으로 연 다른 사람의 저장은 막힌다
    r = client.put(f"/subprojects/{ids['sub']}", json={"name": "B가 고침", "edit_version": 1})
    assert r.status_code == 409
    assert "다른 사람이 먼저" in r.json()["detail"]
    assert client.get(f"/subprojects/{ids['sub']}").json()["name"] == "A가 고침"

    # 버전을 보내지 않는 예전 화면은 그대로 동작한다
    assert client.put(f"/subprojects/{ids['sub']}", json={"name": "옛 화면"}).status_code == 200


def test_project_stale_edit_is_rejected(env):
    client, ids = env
    body = {
        "major_project_id": ids["major"],
        "name": "중",
        "project_type": "general",
        "participant_ids": [ids["admin"]],
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
    }
    r = client.put(f"/projects/{ids['project']}", json={**body, "name": "A", "edit_version": 1})
    assert r.status_code == 200, r.text
    assert r.json()["edit_version"] == 2
    r = client.put(f"/projects/{ids['project']}", json={**body, "name": "B", "edit_version": 1})
    assert r.status_code == 409


def test_template_stale_edit_is_rejected(env):
    client, _ = env
    key = "major_project_1_template_9"
    body = {"project_type": key, "section_label": "템플릿", "fields": [], "weight": 5}
    created = client.put(f"/field-schemas/{key}", json=body)
    assert created.status_code == 200 and created.json()["edit_version"] == 1

    r = client.put(f"/field-schemas/{key}", json={**body, "section_label": "A", "edit_version": 1})
    assert r.status_code == 200 and r.json()["edit_version"] == 2
    r = client.put(f"/field-schemas/{key}", json={**body, "section_label": "B", "edit_version": 1})
    assert r.status_code == 409
    assert client.get(f"/field-schemas/{key}").json()["section_label"] == "A"
