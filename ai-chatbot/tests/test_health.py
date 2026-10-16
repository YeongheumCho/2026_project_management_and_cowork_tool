"""챗봇 상태 확인: 키와 외부 연결이 모두 있어야 화면에 버튼을 보여 준다."""
import pytest

from app.api.endpoints import chat as chat_endpoint
from app.core.config import settings


@pytest.fixture(autouse=True)
def _reset_cache():
    chat_endpoint._reachability.update(checked_at=0.0, ok=False)
    yield
    chat_endpoint._reachability.update(checked_at=0.0, ok=False)


@pytest.mark.asyncio
async def test_unavailable_without_key(client, monkeypatch):
    monkeypatch.setattr(settings, "CLAUDE_API_KEY", "")
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    body = (await client.get("/api/chat/health")).json()
    assert body["api_key_configured"] is False and body["available"] is False


@pytest.mark.asyncio
async def test_unavailable_when_offline(client, monkeypatch):
    monkeypatch.setattr(settings, "CLAUDE_API_KEY", "dummy")

    async def offline():
        return False

    monkeypatch.setattr(chat_endpoint, "_claude_reachable", offline)
    body = (await client.get("/api/chat/health")).json()
    assert body["api_key_configured"] is True and body["available"] is False


@pytest.mark.asyncio
async def test_available_when_key_and_reachable(client, monkeypatch):
    monkeypatch.setattr(settings, "CLAUDE_API_KEY", "dummy")

    async def online():
        return True

    monkeypatch.setattr(chat_endpoint, "_claude_reachable", online)
    body = (await client.get("/api/chat/health")).json()
    assert body["available"] is True


@pytest.mark.asyncio
async def test_reachability_is_cached(monkeypatch):
    calls = []

    async def fake_open(host, port):
        calls.append(host)
        raise OSError("no network")

    monkeypatch.setattr(chat_endpoint.asyncio, "open_connection", fake_open)
    assert await chat_endpoint._claude_reachable() is False
    assert await chat_endpoint._claude_reachable() is False
    assert calls == ["api.anthropic.com"]
