"""Runtime configuration for the AI service, sourced from environment variables."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    provider: str
    model: str
    api_key: str
    base_url: str
    timeout_seconds: int
    max_input_chars: int
    max_output_tokens: dict[str, int]

    @property
    def key_configured(self) -> bool:
        return bool(self.api_key)


def get_settings() -> Settings:
    """Read settings on every call so the provider can be switched without a rebuild."""
    return Settings(
        provider=os.getenv("LLM_PROVIDER", "mock").strip().lower(),
        model=os.getenv("LLM_MODEL", "mock-travel-1").strip(),
        api_key=os.getenv("LLM_API_KEY", "").strip(),
        base_url=os.getenv("LLM_BASE_URL", "").strip(),
        timeout_seconds=_int("LLM_TIMEOUT_SECONDS", 60),
        max_input_chars=_int("LLM_MAX_INPUT_CHARS", 2000),
        max_output_tokens={
            "itinerary": _int("LLM_MAX_OUTPUT_TOKENS_ITINERARY", 1000),
            "chat": _int("LLM_MAX_OUTPUT_TOKENS_CHAT", 500),
            "budget": _int("LLM_MAX_OUTPUT_TOKENS_BUDGET", 700),
        },
    )
