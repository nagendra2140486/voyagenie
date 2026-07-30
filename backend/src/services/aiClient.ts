import { config } from '../config.js';

export interface AiServiceMeta {
  provider: string;
  model: string;
  prompt_chars: number;
  token_estimate: number;
  latency_ms: number;
  max_output_tokens: number;
}

export interface AiServiceSuccess {
  ok: true;
  content: string;
  meta: AiServiceMeta;
}

export interface AiServiceFailure {
  ok: false;
  status: number;
  code: string;
  message: string;
}

export type AiServiceResult = AiServiceSuccess | AiServiceFailure;

/** Single egress point to the Python AI service; enforces the request timeout. */
export const callAiService = async (path: string, body: unknown): Promise<AiServiceResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llm.timeoutSeconds * 1000);
  try {
    const response = await fetch(`${config.aiServiceUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        code: String(payload.code ?? 'ai_service_error'),
        message: String(payload.message ?? 'The AI service rejected the request.'),
      };
    }
    return { ok: true, content: String(payload.content ?? ''), meta: payload.meta as AiServiceMeta };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return aborted
      ? { ok: false, status: 504, code: 'timeout', message: 'The AI request timed out. Please try again.' }
      : {
          ok: false,
          status: 503,
          code: 'ai_service_unavailable',
          message: 'The AI service is not reachable. Please try again shortly.',
        };
  } finally {
    clearTimeout(timer);
  }
};
