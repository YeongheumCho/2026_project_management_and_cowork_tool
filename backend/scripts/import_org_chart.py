"""
Import the organization chart CSV into the users table.

Usage:
    python backend/scripts/import_org_chart.py <CSV path>

When no CSV path is provided, the bundled org chart CSV is used.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Iterable

from sqlalchemy import delete, select


CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.security import hash_password  # noqa: E402
from app.db import SessionLocal  # noqa: E402
from app.models import Base  # noqa: E402,F401
from app.models.project import Project  # noqa: E402
from app.models.user import User  # noqa: E402


DEFAULT_CSV_PATH = CURRENT_DIR / "data" / "사번포함조직도.csv"
DEFAULT_PASSWORD = "00000000"
LEGACY_DUMMY_IDNUMS = {"A1001", "M2001", "M2002", "M2003", "M2004"}
SERVICE_DEVELOPER_NAMES = {"조영흠", "박상호", "유현지", "김수결"}


def determine_role(rel: str, name: str) -> str:
    if rel.strip().upper() == "MASTER":
        return "admin"
    if name.strip() in SERVICE_DEVELOPER_NAMES:
        return "admin"
    return "member"


def parse_org_fields(org_path_raw: str) -> tuple[str | None, str | None, str | None]:
    segments = [segment.strip() for segment in org_path_raw.split(">") if segment.strip()]

    center = next((segment for segment in segments if segment.endswith("센터")), None)
    office = next((segment for segment in segments if segment.endswith("실")), None)
    team = next((segment for segment in reversed(segments) if segment.endswith("팀")), None)

    return center, office, team


def read_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        required_cols = {"조직경로", "이름", "직급", "이메일", "휴대전화", "사번", "rel"}
        missing = required_cols - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f"CSV is missing required columns: {missing}")

        for raw in reader:
            idnum = (raw.get("사번") or "").strip()
            name = (raw.get("이름") or "").strip()
            if not idnum or not name:
                continue

            center, office, team = parse_org_fields(raw.get("조직경로") or "")

            rows.append(
                {
                    "idnum": idnum,
                    "name": name,
                    "center": center,
                    "office": office,
                    "team": team,
                    "position": (raw.get("직급") or "").strip() or None,
                    "email": (raw.get("이메일") or "").strip() or None,
                    "phone": (raw.get("휴대전화") or "").strip() or None,
                    "role": determine_role(raw.get("rel") or "", name),
                }
            )
    return rows


def purge_legacy(session) -> tuple[int, int]:
    sample_projects = session.scalars(
        select(Project).where(Project.name.like("[Sample]%"))
    ).all()
    removed_projects = len(sample_projects)
    for project in sample_projects:
        session.delete(project)

    removed_users = session.execute(
        delete(User).where(User.idnum.in_(LEGACY_DUMMY_IDNUMS))
    ).rowcount or 0

    session.flush()
    return removed_users, removed_projects


def upsert_users(session, rows: Iterable[dict]) -> tuple[int, int]:
    created, updated = 0, 0
    default_hash = hash_password(DEFAULT_PASSWORD)

    for row in rows:
        user = session.scalar(select(User).where(User.idnum == row["idnum"]))
        if user is None:
            user = User(
                idnum=row["idnum"],
                name=row["name"],
                password_hash=default_hash,
                role=row["role"],
                center=row["center"],
                office=row["office"],
                team=row["team"],
                position=row["position"],
                email=row["email"],
                phone=row["phone"],
                is_active=True,
            )
            session.add(user)
            created += 1
        else:
            user.name = row["name"]
            user.role = row["role"]
            user.center = row["center"]
            user.office = row["office"]
            user.team = row["team"]
            user.position = row["position"]
            user.email = row["email"]
            user.phone = row["phone"]
            user.is_active = True
            updated += 1

    session.flush()
    return created, updated


def resolve_csv_path(argv: list[str]) -> Path:
    if len(argv) > 1:
        return Path(argv[1]).expanduser().resolve()
    return DEFAULT_CSV_PATH


def main() -> None:
    csv_path = resolve_csv_path(sys.argv)
    if not csv_path.is_file():
        raise SystemExit(f"CSV file not found: {csv_path}")

    rows = read_rows(csv_path)
    admin_count = sum(1 for row in rows if row["role"] == "admin")
    team_count = len({row["team"] for row in rows if row["team"]})
    print(f"[parse] {csv_path.name}: users={len(rows)}, teams={team_count}, admin={admin_count}")

    session = SessionLocal()
    try:
        removed_users, removed_projects = purge_legacy(session)
        print(f"[purge] users={removed_users}, sample_projects={removed_projects}")

        created, updated = upsert_users(session, rows)
        print(f"[upsert] created={created}, updated={updated}")

        session.commit()
        print(f"[commit] org chart imported. default password={DEFAULT_PASSWORD}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
