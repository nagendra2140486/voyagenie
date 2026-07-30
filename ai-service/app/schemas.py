"""Request/response contracts for the AI service."""

from typing import Literal

from pydantic import BaseModel, Field


class ItineraryRequest(BaseModel):
    destination: str = Field(min_length=2, max_length=120)
    days: int = Field(ge=1, le=30)
    budget: Literal["low", "medium", "high"] = "medium"
    travel_type: str = Field(default="solo", max_length=60)
    interests: list[str] = Field(default_factory=list)
    # Above LLM_MAX_INPUT_CHARS on purpose: the length guardrail owns the rejection message.
    constraints: str = Field(default="", max_length=8000)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    history: list[ChatMessage] = Field(default_factory=list)


class BudgetRequest(BaseModel):
    destination: str = Field(min_length=2, max_length=120)
    days: int = Field(ge=1, le=30)
    budget_amount: float = Field(gt=0, le=1_000_000)
    currency: str = Field(default="USD", max_length=8)
    travellers: int = Field(default=1, ge=1, le=20)
    travel_style: str = Field(default="balanced", max_length=60)


class LlmMeta(BaseModel):
    provider: str
    model: str
    prompt_chars: int
    token_estimate: int
    latency_ms: int
    max_output_tokens: int


class AiResponse(BaseModel):
    feature: str
    content: str
    structured: dict | None = None
    meta: LlmMeta
