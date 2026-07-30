import type { LlmMeta } from '../types';

interface Props {
  meta: LlmMeta;
  cached: boolean;
  remaining?: number;
  limit?: number;
}

/** Makes the guardrail/provider behaviour visible in the UI, as required for demos. */
export const AiMetaBar = ({ meta, cached, remaining, limit }: Props) => (
  <div className="meta-bar">
    <span className="chip">provider: {meta.provider}</span>
    <span className="chip chip--grey">model: {meta.model}</span>
    <span className="chip chip--grey">max output: {meta.max_output_tokens} tokens</span>
    <span className="chip chip--grey">~{meta.token_estimate} tokens used</span>
    <span className="chip chip--grey">{meta.latency_ms} ms</span>
    {cached && <span className="chip chip--amber">served from cache</span>}
    {remaining !== undefined && limit !== undefined && (
      <span className="chip chip--amber">
        {remaining} / {limit} calls left this hour
      </span>
    )}
  </div>
);
