/**
 * Topic taxonomy (fixed list, see docs/IMPLEMENTATION_PLAN.md §3.3).
 *
 * Provider-specific categories (e.g. Wikipedia category trees) are mapped to
 * these ids in each provider's configuration. AI-based topic classification is
 * only introduced where this mapping proves insufficient.
 */
export interface TopicConfig {
  id: string;
  label: string;
}

export const TOPICS: readonly TopicConfig[] = [
  { id: "travel", label: "Travel" },
  { id: "food", label: "Food" },
  { id: "anime", label: "Anime" },
  { id: "culture", label: "Culture" },
  { id: "shopping", label: "Shopping" },
  { id: "technology", label: "Technology" },
  { id: "politics", label: "Politics" },
] as const;

export const TOPIC_IDS: readonly string[] = TOPICS.map((t) => t.id);

export function isKnownTopic(id: string): boolean {
  return TOPIC_IDS.includes(id);
}
