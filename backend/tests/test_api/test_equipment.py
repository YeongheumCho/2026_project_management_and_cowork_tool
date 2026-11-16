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
    from app.routers.equipment import _columns, _default_board

    # 이미 열이 있는데 늦게 온 요청이 다시 만들려 해도 고유 제약에 걸려 그대로다.
    # (B-112 부터 열 이름은 한 그룹 안에서 고유하다.)
    db = next(app.dependency_overrides[get_db]())
    from app.models.equipment import EquipmentColumn

    board = _default_board(db)
    db.add(EquipmentColumn(board_id=board.id, label="장비", sort_order=99))
    try:
        db.commit()
        duplicated = True
    except Exception:
        db.rollback()
        duplicated = False
    assert not duplicated
    assert len(_columns(db, _default_board(db))) == len(DEFAULT_EQUIPMENT_COLUMNS)
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


# ── B-109: 칸 서식·열 너비 ───────────────────────────────────────────


def test_b109_cell_formats_and_column_width_are_shared(env):
    client, state = env
    c = _cols(client)
    row = client.post("/equipment", json={"values": {c["장비"]: "검증용1"}}).json()
    assert row["formats"] == {}

    fmt = {c["장비"]: {"bg": "#FFF2CC", "bold": True}, c["IP"]: {"fg": ""}}
    r = client.put(
        f"/equipment/{row['id']}",
        json={"values": row["values"], "formats": fmt, "version": row["version"]},
    )
    assert r.status_code == 200, r.text
    assert r.json()["formats"] == {c["장비"]: {"bg": "#fff2cc", "bold": True}}
    assert r.json()["version"] == 2

    # 다른 사람도 같은 서식을 본다. 서식을 보내지 않고 값만 고치면 서식은 남는다.
    state["user"] = "일반B"
    r = client.put(
        f"/equipment/{row['id']}",
        json={"values": {**row["values"], c["IP"]: "1.2.3.4"}, "version": 2},
    )
    assert r.json()["formats"] == {c["장비"]: {"bg": "#fff2cc", "bold": True}}

    history = client.get("/equipment/history").json()
    assert history[1]["changes"] == {"장비 서식": [None, "칸 색 #fff2cc, 굵게"]}

    bad = client.put(
        f"/equipment/{row['id']}",
        json={"values": row["values"], "formats": {c["장비"]: {"bg": "red"}}, "version": 3},
    )
    assert bad.status_code == 422

    r = client.put(f"/equipment/columns/{c['장비']}/width", json={"width": 240})
    assert r.status_code == 200 and r.json()["width"] == 240
    assert client.get("/equipment/columns").json()[0]["width"] == 240
    assert client.put(f"/equipment/columns/{c['장비']}/width", json={"width": 5}).status_code == 422
    assert client.put(f"/equipment/columns/{c['장비']}/width", json={"width": None}).json()["width"] is None


# ── B-112: 프로젝트별 장비 그룹 ─────────────────────────────────


@pytest.fixture
def board_env():
    from app.models.project import MajorProject

    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    with Session() as db:
        admin = User(idnum="1", name="관리자", password_hash="x", role="admin", is_active=True)
        inside = User(idnum="2", name="참여자", password_hash="x", role="member", is_active=True)
        outside = User(idnum="3", name="외부인", password_hash="x", role="member", is_active=True)
        db.add_all([admin, inside, outside])
        db.flush()
        major = MajorProject(name="ES실 검증", project_types='["general"]', is_default=False)
        major.members = [inside]
        other = MajorProject(name="AS실 검증", project_types='["general"]', is_default=False)
        db.add_all([major, other])
        db.commit()
        ids = {
            "관리자": admin.id, "참여자": inside.id, "외부인": outside.id,
            "major": major.id, "other": other.id,
        }

    state = {"user": "관리자"}

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


def test_b112_boards_are_visible_only_to_linked_project_members(board_env):
    client, state, ids = board_env

    # 기본 그룹은 누구나 본다.
    default = client.get("/equipment/boards").json()
    assert len(default) == 1 and default[0]["is_default"] is True

    r = client.post(
        "/equipment/boards", json={"name": "ES실 dSPACE", "major_project_ids": [ids["major"]]}
    )
    assert r.status_code == 201, r.text
    board = r.json()
    assert [m["name"] for m in board["major_projects"]] == ["ES실 검증"]
    assert client.post("/equipment/boards", json={"name": "ES실 dSPACE"}).status_code == 400

    q = f"?board_id={board['id']}"
    cols = {c["label"]: str(c["id"]) for c in client.get(f"/equipment/columns{q}").json()}
    default_cols = _cols(client)
    assert set(cols.values()).isdisjoint(default_cols.values())  # 그룹마다 열이 따로다

    # 같은 열 이름을 다른 그룹에서 쓸 수 있고, 한쪽만 고쳐도 다른 쪽은 그대로다.
    client.put(f"/equipment/columns/{cols['제어기']}", json={"label": "검증 대상 제어기"})
    assert "제어기" in _cols(client)

    state["user"] = "참여자"
    assert [b["name"] for b in client.get("/equipment/boards").json()][1:] == ["ES실 dSPACE"]
    row = client.post(f"/equipment{q}", json={"values": {cols["장비"]: "dSPACE-1"}})
    assert row.status_code == 201, row.text
    assert len(client.get(f"/equipment{q}").json()) == 1
    assert client.get("/equipment").json() == []  # 기본 그룹에는 들어가지 않는다
    assert len(client.get(f"/equipment/history{q}").json()) >= 1

    # 참여자가 아닌 사람은 목록에서도 안 보이고, 주소를 직접 쳐도 막힌다.
    state["user"] = "외부인"
    assert len(client.get("/equipment/boards").json()) == 1
    assert client.get(f"/equipment{q}").status_code == 403
    assert client.get(f"/equipment/columns{q}").status_code == 403
    assert client.get(f"/equipment/history{q}").status_code == 403
    rid = row.json()["id"]
    assert client.put(f"/equipment/{rid}", json={"values": {}, "version": 1}).status_code == 403
    assert client.delete(f"/equipment/{rid}").status_code == 403
    assert client.post(f"/equipment/bulk-delete{q}", json={"ids": [rid]}).status_code == 403
    # 그룹 만들기·고치기·지우기는 관리자만
    assert client.post("/equipment/boards", json={"name": "x"}).status_code == 403
    assert client.put(f"/equipment/boards/{board['id']}", json={"name": "x"}).status_code == 403
    assert client.delete(f"/equipment/boards/{board['id']}").status_code == 403

    state["user"] = "관리자"
    # 줄이 남아 있으면 못 지운다. 기본 그룹도 못 지운다.
    assert client.delete(f"/equipment/boards/{board['id']}").status_code == 400
    assert client.delete(f"/equipment/boards/{default[0]['id']}").status_code == 400
    # 연결을 다른 대프로젝트로 바꾸면 이전 참여자는 못 본다.
    r = client.put(
        f"/equipment/boards/{board['id']}",
        json={"name": "ES실 dSPACE", "major_project_ids": [ids["other"]]},
    )
    assert r.status_code == 200 and r.json()["row_count"] == 1
    state["user"] = "참여자"
    assert client.get(f"/equipment{q}").status_code == 403

    state["user"] = "관리자"
    assert client.delete(f"/equipment/{rid}").status_code == 204
    assert client.delete(f"/equipment/boards/{board['id']}").status_code == 204
    assert len(client.get("/equipment/boards").json()) == 1


def test_b112_new_board_can_copy_columns(board_env):
    client, _, _ = board_env
    c = _cols(client)
    client.put(f"/equipment/columns/{c['장비']}/width", json={"width": 200})
    client.post("/equipment/columns", json={"label": "위치"})
    default_id = client.get("/equipment/boards").json()[0]["id"]
    board = client.post(
        "/equipment/boards", json={"name": "복사본", "copy_columns_from": default_id}
    ).json()
    copied = client.get(f"/equipment/columns?board_id={board['id']}").json()
    assert [col["label"] for col in copied][-1] == "위치"
    assert copied[0]["width"] == 200
