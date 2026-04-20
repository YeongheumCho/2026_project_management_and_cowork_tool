"""
DB에서 사용자/프로젝트/업무 데이터를 읽어 Claude 시스템 프롬프트용 컨텍스트를 생성합니다.
"""

from sqlalchemy import create_engine, text
from app.core.config import settings


def _get_engine():
    return create_engine(settings.DATABASE_URL, pool_pre_ping=True)


def fetch_context_for_user(user_email: str | None = None) -> str:
    """
    DB에서 현재 데이터를 조회하여 텍스트 컨텍스트를 구성합니다.
    Claude의 system prompt에 주입됩니다.
    """
    engine = _get_engine()
    sections = []

    try:
        with engine.connect() as conn:
            # 1. 전체 사용자 현황
            result = conn.execute(text(
                "SELECT COUNT(*) as total, "
                "COUNT(*) FILTER (WHERE is_active = true) as active "
                "FROM users"
            ))
            row = result.fetchone()
            if row:
                sections.append(
                    f"[사용자 현황]\n"
                    f"- 전체 등록 사용자: {row[0]}명\n"
                    f"- 활성 사용자: {row[1]}명"
                )

            # 2. 사용자 목록 (최근 10명)
            result = conn.execute(text(
                "SELECT name, email, created_at FROM users "
                "WHERE is_active = true ORDER BY created_at DESC LIMIT 10"
            ))
            rows = result.fetchall()
            if rows:
                user_list = "\n".join(
                    f"  - {r[0]} ({r[1]}, 가입: {r[2].strftime('%Y-%m-%d') if r[2] else '알 수 없음'})"
                    for r in rows
                )
                sections.append(f"[최근 가입 사용자]\n{user_list}")

            # 3. 테이블 목록 조회 (프로젝트/태스크 테이블이 있으면 추가 조회)
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' ORDER BY table_name"
            ))
            tables = [r[0] for r in result.fetchall()]
            sections.append(f"[DB 테이블 목록]\n- {', '.join(tables)}")

            # 4. projects 테이블이 있으면 조회
            if "projects" in tables:
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM projects"
                ))
                count = result.scalar()
                sections.append(f"[프로젝트 현황]\n- 총 프로젝트 수: {count}")

                result = conn.execute(text(
                    "SELECT * FROM projects ORDER BY created_at DESC LIMIT 5"
                ))
                rows = result.fetchall()
                if rows:
                    cols = result.keys()
                    project_lines = []
                    for r in rows:
                        row_dict = dict(zip(cols, r))
                        name = row_dict.get("name", row_dict.get("title", "이름 없음"))
                        status = row_dict.get("status", "알 수 없음")
                        project_lines.append(f"  - {name} (상태: {status})")
                    sections.append(
                        f"[최근 프로젝트]\n" + "\n".join(project_lines)
                    )

            # 5. tasks 테이블이 있으면 조회
            if "tasks" in tables:
                result = conn.execute(text(
                    "SELECT COUNT(*) FROM tasks"
                ))
                count = result.scalar()
                sections.append(f"[업무 현황]\n- 총 업무 수: {count}")

                # 상태별 집계 시도
                try:
                    result = conn.execute(text(
                        "SELECT status, COUNT(*) FROM tasks GROUP BY status"
                    ))
                    status_rows = result.fetchall()
                    if status_rows:
                        status_lines = [f"  - {r[0]}: {r[1]}건" for r in status_rows]
                        sections.append(
                            f"[업무 상태별 현황]\n" + "\n".join(status_lines)
                        )
                except Exception:
                    pass

    except Exception as e:
        sections.append(f"[데이터 조회 오류]\n- DB 연결 또는 조회 중 오류 발생: {str(e)[:200]}")

    if not sections:
        return "\n[현재 데이터]\n데이터가 아직 없습니다."

    return "\n[현재 데이터]\n" + "\n\n".join(sections)
