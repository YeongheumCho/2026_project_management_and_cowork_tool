"""AI 업무 배정: Claude 에 연결할 수 없으면 오래 기다리지 않고 규칙 기반 추천으로 넘어간다."""
import time

import pytest

from app.core.config import settings
from app.routers import workflow


@pytest.fixture(autouse=True)
def _reset_cache():
    workflow._claude_availability.update(checked_at=0.0, ok=False)
    yield
    workflow._claude_availability.update(checked_at=0.0, ok=False)


@pytest.mark.asyncio
async def test_unreachable_chatbot_is_unavailable_quickly(monkeypatch):
    monkeypatch.setattr(settings, "AI_CHATBOT_URL", "http://127.0.0.1:9/api/chat/")
    started = time.monotonic()
    assert await workflow._claude_available() is False
    assert time.monotonic() - started < 6


@pytest.mark.asyncio
async def test_availability_is_cached(monkeypatch):
    calls = []

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def get(self, url):
            calls.append(url)
            raise OSError("no network")

    monkeypatch.setattr(workflow.httpx, "AsyncClient", FakeClient)
    assert await workflow._claude_available() is False
    assert await workflow._claude_available() is False
    assert len(calls) == 1
