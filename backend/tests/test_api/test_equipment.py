"""장비 현황표: 일반 사용자도 줄·열을 추가·수정·삭제, 동시 수정 충돌, 변경 이력."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.dependencies import get_current_user, get_db
from app.main import app
from app.models import Base
from app.models.equipment import DEFAULT_EQUIPMENT_COLUMNS
from app.models.user import User


@pytest.fixture
def env():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        for idnum, name in [("1", "일반A"), ("2", "일반B")]:
            db.add(User(idnum=idnum, name=name, password_hash="x", role="member", is_active=True))
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


def _cols(client) -> dict[str, str]:
    """열 이름 → 열 id(문자열)"""
    return {c["label"]: str(c["id"]) for c in client.get("/equipment/columns").json()}


def test_default_columns_follow_sheet16(env):
    client, _ = env
    labels = [c["label"] for c in client.get("/equipment/columns").json()]
    assert labels == list(DEFAULT_EQUIPMENT_COLUMNS)


def test_member_can_create_update_delete_and_history(env):
    client, state = env
    c = _cols(client)
    r = client.post("/equipment", json={"values": {c["장비"]: "검증용1", c["IP"]: ".12.123", c["Daas"]: "pw"}})
    assert r.status_code == 201, r.text
    row = r.json()
    assert row["values"][c["Daas"]] == "pw" and row["updated_by_name"] == "일반A"

    state["user"] = "일반B"
    values = {**row["values"], c["사용자"]: "맹구"}
    r = client.put(f"/equipment/{row['id']}", json={"values": values, "version": row["version"]})
    assert r.status_code == 200, r.text
    assert r.json()["version"] == 2 and r.json()["updated_by_name"] == "일반B"

    assert client.delete(f"/equipment/{row['id']}").status_code == 204
    assert client.get("/equipment").json() == []

    history = client.get("/equipment/history").json()
    assert [h["action"] for h in history] == ["delete", "update", "create"]
    assert history[1]["changes"] == {"사용자": [None, "맹구"]}
    assert history[0]["changes"]["Daas"] == ["pw", None]
    assert history[0]["equipment_name"] == "검증용1"


def test_stale_version_is_rejected(env):
    client, state = env
    c = _cols(client)
    row = client.post("/equipment", json={"values": {c["장비"]: "업무용1"}}).json()
    ok = client.put(f"/equipment/{row['id']}", json={"values": {**row["values"], c["PC번호"]: "1"}, "version": 1})
    assert ok.status_code == 200

    state["user"] = "일반B"
    r = client.put(f"/equipment/{row['id']}", json={"values": {**row["values"], c["PC번호"]: "2"}, "version": 1})
    assert r.status_code == 409
    assert "일반A" in r.json()["detail"]


def test_member_can_rename_add_move_delete_columns(env):
    client, _ = env
    c = _cols(client)
    row = client.post("/equipment", json={"values": {c["장비"]: "검증용1", c["582"]: "2"}}).json()

    # 이름 바꾸기: 값은 그대로 따라간다 (열 id 기준)
    r = client.put(f"/equipment/columns/{c['582']}", json={"label": "툴 버전"})
    assert r.status_code == 200 and r.json()["label"] == "툴 버전"
    assert client.get("/equipment").json()[0]["values"][c["582"]] == "2"

    # 같은 이름은 막는다 (이름 변경·추가 모두)
    assert client.put(f"/equipment/columns/{c['IP']}", json={"label": "장비"}).status_code == 400
    assert client.post("/equipment/columns", json={"label": "장비"}).status_code == 400

    # 새 열 추가 후 값 입력
    new_id = str(client.post("/equipment/columns", json={"label": "위치"}).json()["id"])
    r = client.put(f"/equipment/{row['id']}", json={"values": {**row["values"], new_id: "5층"}, "version": 1})
    assert r.status_code == 200 and r.json()["values"][new_id] == "5층"

    # 순서 바꾸기: 새 열을 맨 앞으로
    ids = [col["id"] for col in client.get("/equipment/columns").json()]
    order = [int(new_id)] + [i for i in ids if i != int(new_id)]
    assert client.put("/equipment/columns/order", json={"column_ids": order}).status_code == 200
    assert client.get("/equipment/columns").json()[0]["label"] == "위치"
    # 열 목록이 맞지 않으면 막는다
    assert client.put("/equipment/columns/order", json={"column_ids": order[:-1]}).status_code == 409

    # 열 삭제: 값이 사라지고, 지운 값은 이력에 남는다
    assert client.delete(f"/equipment/columns/{c['582']}").status_code == 204
    assert c["582"] not in client.get("/equipment").json()[0]["values"]
    last = client.get("/equipment/history").json()[0]
    assert last["action"] == "column_delete" and last["equipment_name"] == "열: 툴 버전"
    assert list(last["changes"].values()) == [["2", None]]


def test_default_columns_created_once(env):
    """화면이 열과 줄을 동시에 읽어도 기본 열은 한 번만 생긴다."""
    client, _ = env
    client.get("/equipment")
    client.get("/equipment/columns")
    from app.routers.equipment import _columns

    # 이미 열이 있는데 늦게 온 요청이 다시 만들려 해도 고유 제약에 걸려 그대로다.
    db = next(app.dependency_overrides[get_db]())
    from app.models.equipment import EquipmentColumn

    db.add(EquipmentColumn(label="장비", sort_order=99))
    try:
        db.commit()
        duplicated = True
    except Exception:
        db.rollback()
        duplicated = False
    assert not duplicated
    assert len(_columns(db)) == len(DEFAULT_EQUIPMENT_COLUMNS)
    db.close()


def test_last_column_cannot_be_deleted(env):
    client, _ = env
    ids = [col["id"] for col in client.get("/equipment/columns").json()]
    for column_id in ids[:-1]:
        assert client.delete(f"/equipment/columns/{column_id}").status_code == 204
    assert client.delete(f"/equipment/columns/{ids[-1]}").status_code == 400


def test_bulk_appends_in_order_and_skips_empty_rows(env):
    client, _ = env
    c = _cols(client)
    client.post("/equipment", json={"values": {c["장비"]: "기존"}})
    r = client.post(
        "/equipment/bulk",
        json={"rows": [{"values": {c["장비"]: "a", c["IP"]: "  "}}, {"values": {}}, {"values": {c["장비"]: "b"}}]},
    )
    assert r.status_code == 201, r.text
    names = [row["values"].get(c["장비"]) for row in client.get("/equipment").json()]
    assert names == ["기존", "a", "b"]
    assert c["IP"] not in r.json()[0]["values"]


def test_empty_row_rejected(env):
    client, _ = env
    assert client.post("/equipment", json={"values": {}}).status_code == 400


def test_bulk_delete_logs_each_row(env):
    """C-13: 여러 줄 한꺼번에 삭제. 이미 지워진 줄은 건너뛰고, 줄마다 이력이 남는다."""
    client, _ = env
    c = _cols(client)
    ids = [client.post("/equipment", json={"values": {c["장비"]: f"검증용{i}"}}).json()["id"] for i in range(1, 4)]
    r = client.post("/equipment/bulk-delete", json={"ids": [ids[0], ids[1], 999999]})
    assert r.status_code == 200 and r.json() == {"deleted": 2, "missing": 1}
    names = [row["values"].get(c["장비"]) for row in client.get("/equipment").json()]
    assert names == ["검증용3"]
    deletes = [h for h in client.get("/equipment/history").json() if h["action"] == "delete"]
    assert sorted(h["equipment_name"] for h in deletes) == ["검증용1", "검증용2"]
