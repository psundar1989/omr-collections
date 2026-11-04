import { MessageSquareHeart, Star } from "lucide-react";
import { getReviews, reviewSummary } from "@/lib/reviews";
import { whatsappLink } from "@/lib/format";
import { WhatsAppIcon } from "@/components/ui/Icons";

/**
 * Reviews for one product. Shows only reviews stored for this product's key – with none
 * stored, an empty state (no placeholder ratings or sample reviews).
 */
export default function ProductReviews({ reviewKey, productName, whatsappNumber }: { reviewKey: string; productName: string; whatsappNumber?: string | null }) {
  const reviews = getReviews(reviewKey);
  const { count, average } = reviewSummary(reviews);
  const shareLink = whatsappNumber ? whatsappLink(whatsappNumber, `Hello! I'd like to share a review of ${productName}.`) : null;

  return (
    <section className="container-x mt-14" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
        <div>
          <p className="eyebrow">Customer reviews</p>
          <h2 id="reviews-heading" className="heading-display mt-1 text-3xl">Reviews</h2>
        </div>
        {average != null && (
          <p className="flex items-center gap-2 text-sm text-ink/80">
            <Stars rating={average} /> <span className="font-medium">{average.toFixed(1)}</span> · {count} review{count === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {count === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-10 text-center">
          <MessageSquareHeart className="h-9 w-9 text-sand" strokeWidth={1.3} />
          <p className="heading-display text-2xl">No reviews yet</p>
          <p className="max-w-md text-sm text-muted">Bought this piece? We would love to hear what you think – your review will appear here.</p>
          {shareLink && (
            <a href={shareLink} target="_blank" rel="noopener noreferrer" className="btn-outline mt-1">
              <WhatsAppIcon className="h-4 w-4 text-whatsapp" /> Share your review
            </a>
          )}
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {reviews.map((r, i) => (
            <li key={`${r.author}-${r.date}-${i}`} className="card p-5">
              <Stars rating={r.rating} />
              <p className="mt-3 text-[15px] leading-relaxed text-ink/85">“{r.text}”</p>
              <p className="mt-3 text-sm text-muted">
                — {r.author}{r.location ? `, ${r.location}` : ""} · {new Date(r.date).toLocaleDateString("en-IN", { dateStyle: "medium" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5 text-gold" aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }).map((_, k) => <Star key={k} className={`h-4 w-4 ${k < Math.round(rating) ? "fill-current" : ""}`} />)}
    </span>
  );
}
