"""Input guardrails applied before any prompt reaches a provider adapter."""

import re

INJECTION_PATTERNS = [
    r"ignore (all |any |the )?(previous|prior|above) instructions",
    r"disregard (all |any |the )?(previous|prior|above)",
    r"reveal (the |your )?(system|hidden) prompt",
    r"show (me )?(the |your )?(system prompt|api[ _-]?key|secret|credentials)",
    r"print (the |your )?(api[ _-]?key|env|environment variables)",
    r"you are (now|no longer) (a|an|bound)",
    r"developer mode",
    r"jailbreak",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]

ALLOWED_FEATURES = {"itinerary", "chat", "budget"}


class GuardrailError(Exception):
    """Raised when a request violates a guardrail. `code` is a stable machine key."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def check_prompt_length(text: str, max_chars: int) -> None:
    if len(text) > max_chars:
        raise GuardrailError(
            "prompt_too_long",
            f"Your input is {len(text)} characters. Please shorten it to {max_chars} characters or fewer.",
        )


def check_prompt_injection(text: str) -> None:
    for pattern in _COMPILED:
        if pattern.search(text):
            raise GuardrailError(
                "prompt_injection_blocked",
                "This request looks like a prompt-injection attempt and was blocked. "
                "Please rephrase it as a travel question.",
            )


def check_feature(feature: str) -> None:
    if feature not in ALLOWED_FEATURES:
        raise GuardrailError("unknown_feature", f"Unknown feature '{feature}'.")


def estimate_tokens(text: str) -> int:
    """Rough 4-chars-per-token estimate, used for audit logging only."""
    return max(1, len(text) // 4)
