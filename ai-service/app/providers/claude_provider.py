"""Anthropic Claude messages-API adapter."""

from typing import Any

import httpx

from .base import LLMProvider, ProviderError

DEFAULT_BASE_URL = "https://api.anthropic.com/v1"
ANTHROPIC_VERSION = "2023-06-01"


class ClaudeProvider(LLMProvider):
    name = "claude"

    def __init__(self, model: str, timeout_seconds: int, api_key: str, base_url: str = "") -> None:
        super().__init__(model, timeout_seconds)
        if not api_key:
            raise ProviderError("missing_api_key", "LLM_API_KEY is not configured for provider 'claude'.")
        self.api_key = api_key
        self.base_url = (base_url or DEFAULT_BASE_URL).rstrip("/")

    async def generate(
        self,
        *,
        feature: str,
        system_prompt: str,
        user_prompt: str,
        max_output_tokens: int,
        params: dict[str, Any],
    ) -> str:
        payload = {
            "model": self.model,
            "max_tokens": max_output_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(
                    f"{self.base_url}/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": ANTHROPIC_VERSION,
                    },
                    json=payload,
                )
        except httpx.TimeoutException as exc:
            raise ProviderError("timeout", "The AI provider took too long to respond. Please retry.") from exc
        except httpx.HTTPError as exc:
            raise ProviderError("provider_unreachable", "Could not reach the AI provider.") from exc

        if response.status_code >= 400:
            raise ProviderError("provider_error", f"AI provider returned {response.status_code}.")

        data = response.json()
        try:
            return "".join(block["text"] for block in data["content"] if block.get("type") == "text")
        except (KeyError, TypeError) as exc:
            raise ProviderError("bad_provider_response", "AI provider returned an unexpected payload.") from exc
