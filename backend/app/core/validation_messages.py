"""입력 검사(422) 오류 문구를 한국어로 바꾼다.

FastAPI 는 입력이 규칙에 맞지 않으면 pydantic 의 영어 문구
("Input should be less than or equal to 1000000" 등)를 그대로 돌려주고,
화면은 그 문구를 그대로 보여 줬다. 응답 모양(detail 목록의 loc·msg·type)은 그대로 두고
msg 만 한국어로 바꿔, 화면 코드는 고치지 않아도 되게 한다.
"""
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# 자주 쓰는 입력 칸 이름. 없으면 칸 이름 없이 문구만 보여 준다.
FIELD_LABELS: dict[str, str] = {
    "name": "이름",
    "idnum": "사번",
    "password": "비밀번호",
    "current_password": "현재 비밀번호",
    "new_password": "새 비밀번호",
    "start_date": "시작일",
    "end_date": "종료일",
    "work_date": "날짜",
    "worked_on": "날짜",
    "progress_percent": "진행률",
    "comment": "메모",
    "weight": "가중치",
    "label": "열 이름",
    "section_label": "템플릿 이름",
    "task_name": "작업 이름",
    "participant_ids": "참여 인원",
    "member_ids": "참여 인원",
    "avg_expected_minutes": "평균 소요시간(분)",
    "etc_days": "소요일",
    "worked_minutes": "작업 시간(분)",
    "setup_min": "세팅(분)",
    "aud_min": "AUD(분)",
    "work_min": "작업(분)",
    "first_setup_min": "1차 검증 세팅(분)",
    "first_aud_min": "1차 검증 AUD(분)",
    "first_review_min": "1차 검증 리뷰(분)",
    "inreview_setup_min": "InReview 세팅(분)",
    "inreview_aud_min": "InReview AUD(분)",
    "inreview_feedback_min": "InReview 반영(분)",
    "change_feedback_min": "변경 반영(분)",
    "change_revalidate_min": "재검증(분)",
    "function_name": "기능명",
    "values": "값",
}


def _field_label(loc: tuple[Any, ...]) -> str:
    for part in reversed(loc):
        if isinstance(part, str) and part not in ("body", "query", "path"):
            return FIELD_LABELS.get(part, "")
    return ""


def _message(error: dict[str, Any]) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    if kind == "value_error":
        # 우리가 직접 쓴 한국어 문구는 "Value error, " 만 떼고 그대로 쓴다.
        raw = str(ctx.get("error") or error.get("msg", ""))
        return raw.removeprefix("Value error, ")
    if kind in ("less_than_equal", "less_than"):
        return f"{ctx.get('le', ctx.get('lt'))} 이하로 입력해 주세요."
    if kind in ("greater_than_equal", "greater_than"):
        return f"{ctx.get('ge', ctx.get('gt'))} 이상으로 입력해 주세요."
    if kind == "string_too_long":
        return f"{ctx.get('max_length')}자 이하로 입력해 주세요."
    if kind == "string_too_short":
        return f"{ctx.get('min_length')}자 이상 입력해 주세요."
    if kind == "too_short":
        return "하나 이상 골라 주세요."
    if kind == "too_long":
        return f"{ctx.get('max_length')}개 이하로 골라 주세요."
    if kind == "missing":
        return "꼭 입력해야 합니다."
    if kind.startswith("date") or kind.startswith("datetime"):
        return "날짜 형식이 올바르지 않습니다."
    if kind.startswith("int") or kind.startswith("float") or kind.startswith("decimal"):
        return "숫자를 입력해 주세요."
    if kind == "string_pattern_mismatch":
        return "형식이 올바르지 않습니다."
    if kind in ("literal_error", "enum"):
        return "고를 수 있는 값이 아닙니다."
    return "입력값을 확인해 주세요."


def translate_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    translated = []
    for error in errors:
        label = _field_label(tuple(error.get("loc", ())))
        message = _message(error)
        translated.append({**error, "msg": f"{label}: {message}" if label else message})
    return translated


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": jsonable_encoder(translate_errors(list(exc.errors())))},
    )
