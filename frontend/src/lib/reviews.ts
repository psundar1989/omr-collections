/**
 * Customer reviews, keyed by product id.
 *
 * Source: `src/data/reviews.json` – `{ "<product id>": Review[] }`. It is empty because no
 * real customer reviews have been collected yet. Only add reviews customers actually
 * gave for that exact product; never copy a review to another product.
 *
 * Keys: catalogue products use their catalogue id ("product-001"); API products use
 * `api-<numeric id>`, so the two catalogues can never collide.
 */
import data from "@/data/reviews.json";

export type Review = {
  /** Customer's display name as they agreed to be shown, e.g. "Priya S." */
  author: string;
  /** 1–5 */
  rating: number;
  text: string;
  /** ISO date the review was received. */
  date: string;
  location?: string;
};

const REVIEWS = data as Record<string, Review[]>;

export function catalogReviewKey(productId: string): string {
  return productId;
}

export function apiReviewKey(productId: number): string {
  return `api-${productId}`;
}

export function getReviews(key: string): Review[] {
  return REVIEWS[key] ?? [];
}

export function reviewSummary(reviews: Review[]): { count: number; average: number | null } {
  if (reviews.length === 0) return { count: 0, average: null };
  const average = reviews.reduce((n, r) => n + r.rating, 0) / reviews.length;
  return { count: reviews.length, average: Math.round(average * 10) / 10 };
}
