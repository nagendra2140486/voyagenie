"""Voyagenie AI service: prompt templates, guardrails and provider adapters.

The frontend never calls this service directly - the Node backend proxies to it,
so API keys stay on the server side.
"""

import asyncio
import time
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from . import guardrails, prompts
from .config import get_settings
from .providers import ProviderError, build_provider
from .schemas import AiResponse, BudgetRequest, ChatRequest, ItineraryRequest, LlmMeta

app = FastAPI(title="Voyagenie AI Service", version="1.0.0")


def _error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message})


async def _run(feature: str, system_prompt: str, user_prompt: str, params: dict[str, Any]) -> AiResponse | JSONResponse:
    settings = get_settings()
    max_tokens = settings.max_output_tokens[feature]

    try:
        guardrails.check_feature(feature)
        guardrails.check_prompt_length(user_prompt, settings.max_input_chars)
        guardrails.check_prompt_injection(user_prompt)
    except guardrails.GuardrailError as exc:
        return _error(400, exc.code, exc.message)

    try:
        provider = build_provider(settings)
    except ProviderError as exc:
        return _error(500, exc.code, exc.message)

    started = time.perf_counter()
    try:
        content = await asyncio.wait_for(
            provider.generate(
                feature=feature,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_output_tokens=max_tokens,
                params=params,
            ),
            timeout=settings.timeout_seconds,
        )
    except asyncio.TimeoutError:
        return _error(504, "timeout", "The AI request timed out. Please try again.")
    except ProviderError as exc:
        status = 502 if exc.code != "missing_api_key" else 500
        return _error(status, exc.code, exc.message)

    latency_ms = int((time.perf_counter() - started) * 1000)
    return AiResponse(
        feature=feature,
        content=content,
        meta=LlmMeta(
            provider=provider.name,
            model=settings.model,
            prompt_chars=len(user_prompt),
            token_estimate=guardrails.estimate_tokens(user_prompt) + guardrails.estimate_tokens(content),
            latency_ms=latency_ms,
            max_output_tokens=max_tokens,
        ),
    )


@app.get("/health")
async def health() -> dict[str, Any]:
    settings = get_settings()
    return {
        "status": "ok",
        "provider": settings.provider,
        "model": settings.model,
        "api_key_configured": settings.key_configured,
    }


@app.get("/config")
async def config() -> dict[str, Any]:
    """Non-secret view of the active LLM configuration, for the governance page."""
    settings = get_settings()
    return {
        "provider": settings.provider,
        "model": settings.model,
        "api_key_configured": settings.key_configured,
        "timeout_seconds": settings.timeout_seconds,
        "max_input_chars": settings.max_input_chars,
        "max_output_tokens": settings.max_output_tokens,
    }


@app.post("/generate-itinerary")
async def generate_itinerary(req: ItineraryRequest):
    return await _run(
        "itinerary",
        prompts.ITINERARY_SYSTEM,
        prompts.itinerary_prompt(req),
        req.model_dump(),
    )


@app.post("/travel-chat")
async def travel_chat(req: ChatRequest):
    return await _run(
        "chat",
        prompts.CHAT_SYSTEM,
        prompts.chat_prompt(req),
        req.model_dump(),
    )


@app.post("/budget-optimizer")
async def budget_optimizer(req: BudgetRequest):
    return await _run(
        "budget",
        prompts.BUDGET_SYSTEM,
        prompts.budget_prompt(req),
        req.model_dump(),
    )
