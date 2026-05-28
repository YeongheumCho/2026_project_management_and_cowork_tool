"""
Builds database context for the AI chatbot.

The chatbot sends this context as part of Claude's system prompt so users can ask
about project status, subproject notes, issues, and progress history.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from typing import Any

from sqlalchemy import create_engine, text

from app.core.config import settings


MAX_TEXT_LENGTH = 600
MAX_CONTEXT_ROWS = 30
SEARCH_STOPWORDS = {
    "관련",
    "내용",
    "이력",
    "조회",
    "찾아줘",
    "찾아",
    "알려줘",
    "어떻게",
    "무엇",
    "뭐야",
    "있는",
    "없는",
    "프로젝트",
    "하위",
    "진행",
    "상황",
    "기록",
    "특이",
    "사항",
    "이슈",
}


def _get_engine():
    return create_engine(settings.DATABASE_URL, pool_pre_ping=True)


def _clip(value: Any, limit: int = MAX_TEXT_LENGTH) -> str:
    text_value = str(value or "").strip()
    if len(text_value) <= limit:
        return text_value
    return f"{text_value[:limit].rstrip()}..."


def _format_date(value: Any) -> str:
    if value is None:
        return "-"
    text_value = str(value)
    return text_value[:10] if len(text_value) >= 10 else text_value


def _extract_search_terms(query: str | None) -> list[str]:
    if not query:
        return []
    terms: list[str] = []
    for raw in re.split(r"[\s,.;:!?()\[\]{}\"'`~|/\\]+", query):
        term = raw.strip()
        if len(term) < 2 or term in SEARCH_STOPWORDS:
            continue
        if term not in terms:
            terms.append(term)
        if len(terms) >= 8:
            break
    return terms


def _has_table(tables: Iterable[str], table_name: str) -> bool:
    return table_name in set(tables)


def _search_clause(columns: list[str], terms: list[str]) -> tuple[str, dict[str, str]]:
    if not terms:
        return "", {}

    params: dict[str, str] = {}
    term_clauses: list[str] = []
    for index, term in enumerate(terms):
        param = f"term_{index}"
        params[param] = f"%{term}%"
        term_clauses.append(
            "(" + " OR ".join(f"{column} ILIKE :{param}" for column in columns) + ")"
        )
    return " AND (" + " OR ".join(term_clauses) + ")", params


def _fetch_basic_summary(conn, tables: list[str]) -> list[str]:
    sections: list[str] = []

    if _has_table(tables, "users"):
        row = conn.execute(
            text(
                "SELECT COUNT(*) AS total, "
                "COUNT(*) FILTER (WHERE is_active = true) AS active "
                "FROM users"
            )
        ).fetchone()
        if row:
            sections.append(
                "[사용자 현황]\n"
                f"- 전체 등록 사용자: {row[0]}명\n"
                f"- 활성 사용자: {row[1]}명"
            )

    if _has_table(tables, "projects"):
        count = conn.execute(text("SELECT COUNT(*) FROM projects")).scalar()
        sections.append(f"[프로젝트 현황]\n- 총 프로젝트 수: {count}")

        rows = conn.execute(
            text(
                "SELECT name, project_type, created_at "
                "FROM projects ORDER BY created_at DESC LIMIT 5"
            )
        ).fetchall()
        if rows:
            sections.append(
                "[최근 프로젝트]\n"
                + "\n".join(
                    f"  - {row[0]} (유형: {row[1]}, 생성일: {_format_date(row[2])})"
                    for row in rows
                )
            )

    return sections


def _fetch_subproject_note_context(conn, tables: list[str], terms: list[str]) -> str | None:
    if not _has_table(tables, "subprojects") or not _has_table(tables, "projects"):
        return None

    search_sql, params = _search_clause(
        [
            "p.name",
            "sp.name",
            "COALESCE(sp.function_name, '')",
            "COALESCE(sp.special_note, '')",
            "COALESCE(sp.issue_note, '')",
        ],
        terms,
    )
    rows = conn.execute(
        text(
            f"""
            SELECT
                mp.name AS major_project_name,
                p.name AS project_name,
                p.project_type AS project_type,
                sp.id AS subproject_id,
                sp.name AS subproject_name,
                sp.function_name AS function_name,
                sp.status AS status,
                sp.progress AS progress,
                sp.special_note AS special_note,
                sp.issue_note AS issue_note,
                sp.updated_at AS updated_at
            FROM subprojects sp
            JOIN projects p ON p.id = sp.project_id
            LEFT JOIN major_projects mp ON mp.id = p.major_project_id
            WHERE (
                NULLIF(TRIM(COALESCE(sp.special_note, '')), '') IS NOT NULL
                OR NULLIF(TRIM(COALESCE(sp.issue_note, '')), '') IS NOT NULL
            )
            {search_sql}
            ORDER BY sp.updated_at DESC, sp.id DESC
            LIMIT :limit
            """
        ),
        {**params, "limit": MAX_CONTEXT_ROWS},
    ).mappings().all()

    if not rows:
        return None

    lines = []
    for row in rows:
        text_bits = []
        if row["special_note"]:
            text_bits.append(f"특이사항: {_clip(row['special_note'])}")
        if row["issue_note"]:
            text_bits.append(f"이슈/진행 상황: {_clip(row['issue_note'])}")
        lines.append(
            "  - "
            f"{row['major_project_name'] or '-'} > {row['project_name']} > {row['subproject_name']} "
            f"(ID: {row['subproject_id']}, 기능명: {row['function_name'] or '-'}, "
            f"상태: {row['status']}, 진행률: {float(row['progress'] or 0):.0f}%, "
            f"수정일: {_format_date(row['updated_at'])})\n"
            f"    {' / '.join(text_bits)}"
        )

    return "[하위 프로젝트 특이사항/이슈 이력]\n" + "\n".join(lines)


def _fetch_progress_log_context(conn, tables: list[str], terms: list[str]) -> str | None:
    required = {"progress_logs", "projects", "users"}
    if not required.issubset(set(tables)):
        return None

    has_subprojects = _has_table(tables, "subprojects")
    subproject_join = (
        "LEFT JOIN subprojects sp ON sp.id = pl.subproject_id"
        if has_subprojects
        else ""
    )
    subproject_name = "sp.name" if has_subprojects else "NULL"
    subproject_filter_column = "COALESCE(sp.name, '')" if has_subprojects else "''"
    search_sql, params = _search_clause(
        [
            "p.name",
            subproject_filter_column,
            "u.name",
            "COALESCE(pl.comment, '')",
        ],
        terms,
    )

    rows = conn.execute(
        text(
            f"""
            SELECT
                p.name AS project_name,
                {subproject_name} AS subproject_name,
                u.name AS user_name,
                pl.progress_percent AS progress_percent,
                pl.comment AS comment,
                pl.work_date AS work_date,
                pl.created_at AS created_at
            FROM progress_logs pl
            JOIN projects p ON p.id = pl.project_id
            JOIN users u ON u.id = pl.user_id
            {subproject_join}
            WHERE NULLIF(TRIM(COALESCE(pl.comment, '')), '') IS NOT NULL
            {search_sql}
            ORDER BY pl.work_date DESC, pl.created_at DESC, pl.id DESC
            LIMIT :limit
            """
        ),
        {**params, "limit": MAX_CONTEXT_ROWS},
    ).mappings().all()

    if not rows:
        return None

    lines = [
        "  - "
        f"{row['project_name']} > {row['subproject_name'] or '-'} "
        f"({row['work_date']}, 작성자: {row['user_name']}, 진행률: {row['progress_percent']}%)\n"
        f"    기록: {_clip(row['comment'])}"
        for row in rows
    ]
    return "[진행률 기록 이력]\n" + "\n".join(lines)


def fetch_context_for_user(
    user_email: str | None = None,
    query: str | None = None,
) -> str:
    """
    Reads current DB data and builds system-prompt context for Claude.

    `query` is the user's latest message. When present, note/history sections are
    narrowed with keyword matching so the chatbot can answer "find related issue
    history" questions without sending the whole database.
    """
    engine = _get_engine()
    sections: list[str] = []
    terms = _extract_search_terms(query)

    try:
        with engine.connect() as conn:
            tables = [
                row[0]
                for row in conn.execute(
                    text(
                        "SELECT table_name FROM information_schema.tables "
                        "WHERE table_schema = 'public' ORDER BY table_name"
                    )
                ).fetchall()
            ]

            sections.extend(_fetch_basic_summary(conn, tables))

            if terms:
                sections.append("[검색 키워드]\n- " + ", ".join(terms))

            note_context = _fetch_subproject_note_context(conn, tables, terms)
            if note_context:
                sections.append(note_context)

            progress_context = _fetch_progress_log_context(conn, tables, terms)
            if progress_context:
                sections.append(progress_context)

            sections.append(
                "[챗봇 답변 지침]\n"
                "- 하위 프로젝트 특이사항, 이슈/진행 상황, 진행률 기록에서 찾은 내용은 프로젝트명, 하위 프로젝트명, 날짜/작성자 등 출처를 함께 답합니다.\n"
                "- 관련 기록이 이 컨텍스트에 없으면 확인 가능한 이력이 없다고 답합니다.\n"
                "- 같은 내용이 여러 곳에 있으면 가장 최근 기록을 먼저 요약합니다."
            )

    except Exception as exc:
        sections.append(
            "[데이터 조회 오류]\n"
            f"- DB 연결 또는 조회 중 오류 발생: {_clip(str(exc), 200)}"
        )

    if not sections:
        return "\n[현재 데이터]\n데이터가 아직 없습니다."

    return "\n[현재 데이터]\n" + "\n\n".join(sections)
