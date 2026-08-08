"use client";

import { Check, Loader2, Star } from "lucide-react";
import { FormEvent, useState } from "react";

export function ReviewForm({ reviewToken }: { reviewToken: string }) {
  const [displayName, setDisplayName] = useState("");
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [purchaseReason, setPurchaseReason] = useState("");
  const [improvement, setImprovement] = useState("");
  const [publicConsent, setPublicConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewToken,
          displayName,
          rating,
          body,
          purchaseReason: purchaseReason || undefined,
          improvement: improvement || undefined,
          publicConsent,
        }),
      });
      const result = (await response.json()) as {
        saved?: boolean;
        error?: string;
      };
      if (!response.ok || !result.saved) {
        throw new Error(result.error || "Your review could not be saved.");
      }
      setStatus("saved");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Your review could not be saved.",
      );
      setStatus("idle");
    }
  }

  if (status === "saved") {
    return (
      <div className="mt-8 rounded-2xl border border-sage/30 bg-mist/60 px-5 py-6 text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-forest">
          <Check size={17} className="text-sage" />
          Thank you for sharing your experience.
        </span>
        <p className="mt-2 text-xs leading-6 text-forest/60">
          Your verified review now appears on TributeReady.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submitReview}
      className="mt-8 space-y-5 border-t border-forest/10 pt-8 text-left"
    >
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
          Share your experience
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold text-forest">
          Help another family feel confident.
        </h2>
      </div>

      <fieldset>
        <legend className="text-xs font-bold text-forest">Your rating</legend>
        <div className="mt-2 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="rounded-full p-1.5 transition hover:bg-mist"
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
            >
              <Star
                size={25}
                className={
                  value <= rating
                    ? "fill-gold text-gold"
                    : "text-forest/20"
                }
              />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-xs font-bold text-forest">Display name</span>
        <input
          required
          minLength={2}
          maxLength={60}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="First name and last initial"
          className="mt-2 w-full rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest outline-none transition placeholder:text-forest/30 focus:border-sage"
        />
      </label>

      <label className="block">
        <span className="text-xs font-bold text-forest">
          What helped you choose TributeReady?{" "}
          <span className="font-normal text-forest/45">(optional)</span>
        </span>
        <select
          value={purchaseReason}
          onChange={(event) => setPurchaseReason(event.target.value)}
          className="mt-2 w-full rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm text-forest outline-none focus:border-sage"
        >
          <option value="">Choose one</option>
          <option value="ease">It looked easy to use</option>
          <option value="writing">The writing felt careful</option>
          <option value="design">The design</option>
          <option value="privacy">The privacy approach</option>
          <option value="speed">I needed it quickly</option>
          <option value="bundle">Everything was coordinated</option>
          <option value="price">The one-time price</option>
          <option value="other">Something else</option>
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-bold text-forest">
          What could we improve?{" "}
          <span className="font-normal text-forest/45">(optional and private)</span>
        </span>
        <textarea
          maxLength={600}
          rows={3}
          value={improvement}
          onChange={(event) => setImprovement(event.target.value)}
          className="mt-2 w-full resize-none rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm leading-6 text-forest outline-none focus:border-sage"
        />
      </label>

      <label className="flex items-start gap-3 rounded-xl bg-mist/55 p-4 text-xs leading-5 text-forest/65">
        <input
          required
          type="checkbox"
          checked={publicConsent}
          onChange={(event) => setPublicConsent(event.target.checked)}
          className="mt-0.5 size-4 accent-[#173e35]"
        />
        <span>
          I understand my display name, rating, and review will be public. I
          have not included private memorial details or contact information.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-bold text-forest">Your review</span>
        <textarea
          required
          minLength={20}
          maxLength={600}
          rows={4}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What felt most helpful or meaningful?"
          className="mt-2 w-full resize-none rounded-xl border border-forest/15 bg-white px-4 py-3 text-sm leading-6 text-forest outline-none transition placeholder:text-forest/30 focus:border-sage"
        />
        <span className="mt-1 block text-right text-[10px] text-forest/40">
          {body.length}/600
        </span>
      </label>

      {error && (
        <p role="alert" className="text-center text-xs font-semibold text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "saving"}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-forest px-5 py-3.5 text-xs font-bold text-white transition hover:bg-[#245046] disabled:cursor-wait disabled:opacity-70"
      >
        {status === "saving" && <Loader2 size={15} className="animate-spin" />}
        {status === "saving" ? "Saving your review…" : "Publish verified review"}
      </button>
      <p className="text-center text-[10px] leading-5 text-forest/45">
        Reviews are tied to a fulfilled purchase and are never filtered by
        rating. Improvement notes remain private.
      </p>
    </form>
  );
}
