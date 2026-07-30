"""Provider adapter contract. Every adapter must be swappable via LLM_PROVIDER."""

from abc import ABC, abstractmethod
from typing import Any


class ProviderError(Exception):
    """Raised for provider-side failures (auth, timeout, upstream error)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class LLMProvider(ABC):
    name: str

    def __init__(self, model: str, timeout_seconds: int) -> None:
        self.model = model
        self.timeout_seconds = timeout_seconds

    @abstractmethod
    async def generate(
        self,
        *,
        feature: str,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int,
        params: dict[str, Any],
    ) -> str:
        """Return the model completion as plain markdown text."""
