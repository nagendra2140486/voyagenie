export interface Destination {
  id: number;
  city: string;
  country: string;
  summary: string;
  description: string;
  budget_level: 'low' | 'medium' | 'high';
  best_season: string;
  travel_style: string;
  image_url: string;
  attractions: string[];
  travel_tips: string[];
  estimated_budget_usd: number;
}

export interface TravelPackage {
  id: number;
  title: string;
  destination_id: number | null;
  destination_city: string | null;
  destination_country: string | null;
  duration_days: number;
  price_range: string;
  price_from_usd: number;
  travel_style: string;
  highlights: string[];
  image_url: string;
}

export interface Trip {
  id: number;
  title: string;
  destination: string;
  days: number | null;
  budget: string | null;
  travel_type: string | null;
  source: string;
  itinerary_text: string;
  created_at: string;
}

export interface LlmMeta {
  provider: string;
  model: string;
  prompt_chars: number;
  token_estimate: number;
  latency_ms: number;
  max_output_tokens: number;
}

export interface AiResult {
  content: string;
  meta: LlmMeta;
  cached: boolean;
  rateLimit?: RateLimit;
}

export interface RateLimit {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetsAt: string;
}

export interface AuditEntry {
  id: number;
  session_id: string;
  feature: string;
  provider: string;
  model: string;
  status: string;
  detail: string | null;
  prompt_chars: number;
  token_estimate: number;
  latency_ms: number;
  cached: boolean;
  created_at: string;
}

export interface GovernanceView {
  entries: AuditEntry[];
  summary: Record<string, number>;
  rateLimitUsage: Record<string, RateLimit>;
  cacheEntries: number;
  llmConfig: {
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
    timeoutSeconds: number;
    maxInputChars: number;
    cacheEnabled: boolean;
    rateLimitPerHour: Record<string, number>;
  };
}
