import type { Provider } from "../src/providers/types.js";

/**
 * Registry of enabled providers.
 *
 * Empty at M0. Providers are added here as they are implemented, and only
 * after their terms-of-use review is recorded in docs/data-sources/
 * (see docs/IMPLEMENTATION_PLAN.md §4 — this is a required step, not a
 * convention).
 *
 * Wave 1: wikimedia-pageviews (knowledge)
 * Wave 2: search (pending terms review)
 * Wave 3: travel statistics
 * Wave 4: structural datasets
 */
export const PROVIDERS: readonly Provider[] = [];

export function enabledProviders(): readonly Provider[] {
  return PROVIDERS;
}
