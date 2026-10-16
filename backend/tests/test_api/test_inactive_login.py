"""퇴사(비활성) 계정은 로그인할 수 없고, 로그인한 뒤 비활성 처리되면 남은 토큰도 쓰지 못한다."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import hash_password
from app.dependencies import get_db
from app.main import app
from app.models import Base
from app.models.user import User

PASSWORD = "test-pass-1234"


@pytest.fixture
def env():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        db.add(User(idnum="100", name="재직자", password_hash=hash_password(PASSWORD), role="member", is_active=True))
        db.add(User(idnum="200", name="퇴사자", password_hash=hash_password(PASSWORD), role="member", is_active=False))
        db.commit()

    def _db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _db
    try:
        yield TestClient(app), Session
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def _login(client, idnum, password=PASSWORD):
    return client.post("/auth/login", data={"username": idnum, "password": password})


def test_active_user_can_login(env):
    client, _ = env
    r = _login(client, "100")
    assert r.status_code == 200
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
    assert me.status_code == 200 and me.json()["name"] == "재직자"


def test_inactive_user_cannot_login(env):
    client, _ = env
    r = _login(client, "200")
    assert r.status_code == 403
    assert "퇴사" in r.json()["detail"]


def test_inactive_status_not_revealed_without_password(env):
    client, _ = env
    r = _login(client, "200", "wrong")
    assert r.status_code == 401
    assert "퇴사" not in r.json()["detail"]


def test_token_stops_working_after_deactivation(env):
    client, Session = env
    token = _login(client, "100").json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/auth/me", headers=headers).status_code == 200

    with Session() as db:
        db.query(User).filter(User.idnum == "100").update({"is_active": False})
        db.commit()

    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 401
    assert "퇴사" in r.json()["detail"]


def test_signup_is_closed(env):
    """계정은 인원 동기화로만 만든다. 회원가입으로 관리자 계정을 만들던 길을 막았다."""
    client, _ = env
    r = client.post(
        "/auth/signup",
        json={"idnum": "300", "name": "가입시도", "password": PASSWORD, "role": "admin"},
    )
    assert r.status_code in (404, 405)


def test_auth_errors_are_korean(env):
    client, Session = env
    r = client.get("/auth/me", headers={"Authorization": "Bearer broken"})
    assert r.status_code == 401 and "다시 로그인" in r.json()["detail"]

    token = _login(client, "100").json()["access_token"]
    with Session() as db:
        db.query(User).filter(User.idnum == "100").delete()
        db.commit()
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401 and "계정을 찾을 수 없습니다" in r.json()["detail"]


def test_missing_token_message_is_korean(env):
    client, _ = env
    r = client.get("/auth/me")
    assert r.status_code == 401 and r.json()["detail"] == "로그인이 필요합니다."
