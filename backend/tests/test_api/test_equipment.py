"""장비 현황표: 일반 사용자도 추가·수정·삭제 가능, 동시 수정 충돌, 변경 이력."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.dependencies import get_current_user, get_db
from app.main import app
from app.models import Base
from app.models.user import User


@pytest.fixture
def env():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        for idnum, name, role in [("1", "일반A", "member"), ("2", "일반B", "member")]:
            db.add(User(idnum=idnum, name=name, password_hash="x", role=role, is_active=True))
        db.commit()
        users = {u.name: u.id for u in db.query(User).all()}

    state = {"user": "일반A"}

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    def _user():
        with Session() as db:
            user = db.get(User, users[state["user"]])
            db.expunge(user)
            return user

    app.dependency_overrides[get_db] = _db
    app.dependency_overrides[get_current_user] = _user
    try:
        yield TestClient(app), state
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_member_can_create_update_delete_and_history(env):
    client, state = env
    r = client.post("/equipment", json={"name": "검증용1", "ip": ".12.123", "daas_password": "pw"})
    assert r.status_code == 201, r.text
    row = r.json()
    assert row["daas_password"] == "pw" and row["updated_by_name"] == "일반A"

    state["user"] = "일반B"
    r = client.put(f"/equipment/{row['id']}", json={**row, "user_name": "맹구"})
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 2 and r.json()["updated_by_name"] == "일반B"

    assert client.delete(f"/equipment/{row['id']}").status_code == 204
    assert client.get("/equipment").json() == []

    history = client.get("/equipment/history").json()
    assert [h["action"] for h in history] == ["delete", "update", "create"]
    assert history[1]["changes"] == {"user_name": [None, "맹구"]}
    assert history[0]["changes"]["daas_password"] == ["pw", None]


def test_stale_version_is_rejected(env):
    client, state = env
    row = client.post("/equipment", json={"name": "업무용1"}).json()
    assert client.put(f"/equipment/{row['id']}", json={**row, "pc_no": "1"}).status_code == 200

    state["user"] = "일반B"
    r = client.put(f"/equipment/{row['id']}", json={**row, "pc_no": "2"})
    assert r.status_code == 409
    assert "일반A" in r.json()["detail"]


def test_bulk_appends_in_order_and_blank_becomes_null(env):
    client, _ = env
    client.post("/equipment", json={"name": "기존"})
    r = client.post("/equipment/bulk", json={"rows": [{"name": "a", "ip": "  "}, {"name": "b"}]})
    assert r.status_code == 201, r.text
    names = [row["name"] for row in client.get("/equipment").json()]
    assert names == ["기존", "a", "b"]
    assert r.json()[0]["ip"] is None


def test_name_required(env):
    client, _ = env
    assert client.post("/equipment", json={"name": "  "}).status_code == 422
