from app.services.context import _clip, _extract_search_terms


def test_extract_search_terms_keeps_specific_keywords():
    terms = _extract_search_terms("27_Signal_Interface 관련 이슈 / 진행 상황 찾아줘")

    assert "27_Signal_Interface" in terms
    assert "관련" not in terms
    assert "이슈" not in terms


def test_clip_truncates_long_text():
    text = "가" * 605

    assert _clip(text, 10) == "가" * 10 + "..."
