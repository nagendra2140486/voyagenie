"""Provider registry. Selecting an adapter is a configuration change, not a code change."""

from ..config import Settings
from .base import LLMProvider, ProviderError
from .claude_provider import ClaudeProvider
from .mock_provider import MockProvider
from .openai_provider import OpenAIProvider

SUPPORTED_PROVIDERS = ("mock", "openai", "codex", "claude")


def build_provider(settings: Settings) -> LLMProvider:
    provider = settings.provider
    if provider == "mock":
        return MockProvider(settings.model, settings.timeout_seconds)
    if provider in ("openai", "codex"):
        return OpenAIProvider(settings.model, settings.timeout_seconds, settings.api_key, settings.base_url)
    if provider == "claude":
        return ClaudeProvider(settings.model, settings.timeout_seconds, settings.api_key, settings.base_url)
    raise ProviderError(
        "unsupported_provider",
        f"LLM_PROVIDER='{provider}' is not supported. Use one of: {', '.join(SUPPORTED_PROVIDERS)}.",
    )


__all__ = ["LLMProvider", "ProviderError", "build_provider", "SUPPORTED_PROVIDERS"]
