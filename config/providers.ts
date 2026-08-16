import type { Provider } from "../src/providers/types.js";
import { WikimediaPageviewsProvider } from "../src/providers/wikimedia/index.js";

/**
 * Registry of enabled providers.
 *
 * Providers are added here only after their terms-of-use review is recorded
 * in docs/data-sources/ (see docs/IMPLEMENTATION_PLAN.md §4 — a required
 * step, not a convention).
 *
 * Wave 1: wikimedia-pageviews (knowledge) — review: docs/data-sources/wikimedia-pageviews.md
 * Wave 2: search — on hold, see docs/data-sources/google-trends.md
 * Wave 3: travel statistics — planned for M5, see docs/data-sources/travel-statistics.md
 * Wave 4: structural datasets — planned
 */
export const PROVIDERS: readonly Provider[] = [new WikimediaPageviewsProvider()];

export function enabledProviders(): readonly Provider[] {
  return PROVIDERS;
}
