"""
E-모빌리티센터 조직도 CSV → users 테이블 일괄 등록 스크립트.

사용법:
    python backend/scripts/import_org_chart.py <CSV 경로>
    # 경로 생략 시 기본값: backend/scripts/data/사번포함조직도.csv

동작:
    1. 기존 더미 시드 사용자 (A1001, M2001~M2004)와 [Sample] 로 시작하는 프로젝트 삭제
       (prog_logs, work_logs, user_workflow_state 는 CASCADE 로 함께 정리됨)
    2. CSV 의 104명 일괄 등록 — 이미 존재하는 사번은 업데이트 (upsert)
    3. role 매핑 규칙:
       - rel == "MASTER"                                → admin (팀장/실장/센터장)
       - 이름이 {조영흠, 박상은, 신현지, 김한결} 중 하나 → admin (서비스 개발자)
       - 그 외                                           → member
    4. 초기 비밀번호는 전원 "00000000" (bcrypt 해시 저장)

멱등성: 재실행해도 같은 결과가 나오도록 설계됨.
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
from app.models import Base  # noqa: E402,F401 — metadata registration
from app.models.project import Project  # noqa: E402
from app.models.user import User  # noqa: E402


# ────────────────────────────────────────────────────────────────────
# 설정
# ────────────────────────────────────────────────────────────────────

DEFAULT_CSV_PATH = CURRENT_DIR / "data" / "사번포함조직도.csv"
DEFAULT_PASSWORD = "00000000"

# 기존 시드 더미 사용자 사번 — 조직도 반영 시 제거 대상
LEGACY_DUMMY_IDNUMS = {"A1001", "M2001", "M2002", "M2003", "M2004"}

# 서비스 개발자 — rel 이 MEMBER 여도 admin 으로 승격
SERVICE_DEVELOPER_NAMES = {"조영흠", "박상은", "신현지", "김한결"}


def determine_role(rel: str, name: str) -> str:
    """조직도 rel 과 이름 기반으로 role 결정."""
    if rel.strip().upper() == "MASTER":
        return "admin"
    if name.strip() in SERVICE_DEVELOPER_NAMES:
        return "admin"
    return "member"


def normalize_team(team_raw: str) -> str:
    """CSV 의 '팀' 컬럼은 '팀장/실장/센터장' 같은 직책 표시가 붙는 경우가 있어
    소속 팀명만 깔끔하게 뽑아낸다.

    예:
        "Automotive검증1팀 팀장"     → "Automotive검증1팀"
        "Automotive검증1팀 선임연구원" → "Automotive검증1팀"
        "E-모빌리티센터 센터장"       → "E-모빌리티센터"
    """
    team = team_raw.strip()
    if not team:
        return team
    # 공백 뒤에 직책이 붙어 있으면 제거
    parts = team.split(" ", 1)
    return parts[0]


# ────────────────────────────────────────────────────────────────────
# CSV 파싱
# ────────────────────────────────────────────────────────────────────

def read_rows(csv_path: Path) -> list[dict]:
    """CSV 에서 필요한 컬럼만 뽑아 dict 리스트로 반환."""
    rows: list[dict] = []
    with csv_path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        required_cols = {"팀", "이름", "직급", "이메일", "휴대전화", "사번", "rel"}
        missing = required_cols - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f"CSV 에 필요한 컬럼이 없음: {missing}")

        for raw in reader:
            idnum = (raw.get("사번") or "").strip()
            name = (raw.get("이름") or "").strip()
            if not idnum or not name:
                continue  # 빈 행 스킵
            rows.append(
                {
                    "idnum": idnum,
                    "name": name,
                    "team": normalize_team(raw.get("팀") or ""),
                    "position": (raw.get("직급") or "").strip() or None,
                    "email": (raw.get("이메일") or "").strip() or None,
                    "phone": (raw.get("휴대전화") or "").strip() or None,
                    "role": determine_role(raw.get("rel") or "", name),
                }
            )
    return rows


# ────────────────────────────────────────────────────────────────────
# DB 처리
# ────────────────────────────────────────────────────────────────────

def purge_legacy(session) -> tuple[int, int]:
    """기존 시드 더미 사용자와 [Sample] 프로젝트를 정리.

    Returns:
        (삭제된 사용자 수, 삭제된 샘플 프로젝트 수)
    """
    # [Sample] 프로젝트 먼저 삭제 — subprojects / subtasks / progress_logs 는
    # 프로젝트 쪽 cascade 로 함께 정리됨 (project.py 의 relationship 설정 기준)
    sample_projects = session.scalars(
        select(Project).where(Project.name.like("[Sample]%"))
    ).all()
    removed_projects = len(sample_projects)
    for project in sample_projects:
        session.delete(project)

    # 더미 사용자 삭제 — progress_logs / work_logs / user_workflow_state 는
    # users 쪽 CASCADE 로 함께 정리됨
    removed_users = session.execute(
        delete(User).where(User.idnum.in_(LEGACY_DUMMY_IDNUMS))
    ).rowcount or 0

    session.flush()
    return removed_users, removed_projects


def upsert_users(session, rows: Iterable[dict]) -> tuple[int, int]:
    """조직도 행을 users 테이블에 upsert.

    기존 사용자는 team/position/email/phone/role/name 을 덮어쓰되,
    비밀번호는 건드리지 않는다 (이미 로그인한 사용자 보호).
    신규 사용자는 DEFAULT_PASSWORD 해시로 등록.

    Returns:
        (생성된 수, 갱신된 수)
    """
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
            user.team = row["team"]
            user.position = row["position"]
            user.email = row["email"]
            user.phone = row["phone"]
            user.is_active = True
            updated += 1

    session.flush()
    return created, updated


# ────────────────────────────────────────────────────────────────────
# 엔트리 포인트
# ────────────────────────────────────────────────────────────────────

def resolve_csv_path(argv: list[str]) -> Path:
    if len(argv) > 1:
        return Path(argv[1]).expanduser().resolve()
    return DEFAULT_CSV_PATH


def main() -> None:
    csv_path = resolve_csv_path(sys.argv)
    if not csv_path.is_file():
        raise SystemExit(f"CSV 를 찾을 수 없음: {csv_path}")

    rows = read_rows(csv_path)
    admin_count = sum(1 for r in rows if r["role"] == "admin")
    team_count = len({r["team"] for r in rows if r["team"]})
    print(f"[parse] {csv_path.name} — {len(rows)}명 / 팀 {team_count}개 / admin {admin_count}명")

    session = SessionLocal()
    try:
        removed_users, removed_projects = purge_legacy(session)
        print(f"[purge] 더미 사용자 {removed_users}명 / 샘플 프로젝트 {removed_projects}건 삭제")

        created, updated = upsert_users(session, rows)
        print(f"[upsert] 신규 {created}명 / 갱신 {updated}명")

        session.commit()
        print("[commit] 조직도 임포트 완료. 초기 비밀번호: 00000000")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
