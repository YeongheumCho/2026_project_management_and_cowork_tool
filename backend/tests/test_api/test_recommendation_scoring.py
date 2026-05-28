from types import SimpleNamespace

from app.routers.workflow import (
    _average_history_minutes,
    _history_rows_matching_terms,
    _history_time_score,
    _project_relevance_score,
    _target_standard_minutes,
    _rule_based_clarifying_questions,
    _top_candidates_by_score,
)


def test_average_history_minutes_ignores_empty_worked_minutes():
    rows = [
        SimpleNamespace(worked_minutes=0),
        SimpleNamespace(worked_minutes=None),
        SimpleNamespace(worked_minutes=60),
        SimpleNamespace(worked_minutes=180),
    ]

    assert _average_history_minutes(rows) == 120


def test_history_time_score_rewards_faster_than_baseline():
    assert _history_time_score(60, 120) == 100
    assert _history_time_score(120, 120) == 50
    assert _history_time_score(240, 120) == 0


def test_history_time_score_is_neutral_without_history():
    assert _history_time_score(None, 120) == 50
    assert _history_time_score(120, None) == 50


def test_history_rows_matching_terms_filters_by_detailed_function():
    rows = [
        SimpleNamespace(
            project_name="정기 검증",
            subproject_name="27_Signal_Interface - IS",
            project_type="regular_inspection",
            keyword_text="27 Signal Interface IS",
        ),
        SimpleNamespace(
            project_name="정기 검증",
            subproject_name="Brake 기능 검증",
            project_type="regular_inspection",
            keyword_text="Brake regular inspection",
        ),
    ]

    matched = _history_rows_matching_terms(rows, ["signal", "interface"])

    assert matched == [rows[0]]


def test_target_standard_minutes_prefers_selected_subproject_expected_minutes():
    subproject = SimpleNamespace(avg_expected_minutes=1056, total_minutes=900)
    rows = [SimpleNamespace(worked_minutes=484)]

    assert _target_standard_minutes(subproject, rows) == 1056


def test_top_candidates_by_score_assigns_rank_by_score():
    candidates = [
        SimpleNamespace(user_id=1, score=70, rank=0),
        SimpleNamespace(user_id=2, score=95, rank=0),
        SimpleNamespace(user_id=3, score=80, rank=0),
        SimpleNamespace(user_id=4, score=60, rank=0),
    ]

    top = _top_candidates_by_score(candidates)

    assert [candidate.user_id for candidate in top] == [2, 3, 1]
    assert [candidate.rank for candidate in top] == [1, 2, 3]


def test_project_relevance_score_uses_history_and_work_log_terms():
    history_rows = [
        SimpleNamespace(
            project_name="CN8 LV3 검증",
            subproject_name="Diagnosis 기능 점검",
            project_type="official_inspection",
            keyword_text="CN8 diagnosis LV3 controller",
        )
    ]
    work_logs = [SimpleNamespace(task_name="Diagnosis regression")]

    score, evidence = _project_relevance_score(
        ["cn8", "diagnosis", "lv3", "controller"],
        history_rows,
        work_logs,
    )

    assert score > 75
    assert evidence


def test_clarifying_questions_are_added_when_relevance_is_low():
    candidates = [SimpleNamespace(project_relevance_score=10)]

    questions = _rule_based_clarifying_questions(["general"], candidates)

    assert questions
