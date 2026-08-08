"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { memorialThemes, resolveMemorialTheme } from "@/lib/memorial-themes";
import {
  getFirstTouchAttribution,
  getGrowthSessionId,
  submitCustomerFeedback,
  trackGrowthEvent,
} from "@/lib/growth-client";

type MemorialDraft = {
  heading: string;
  obituary: string;
  remembrance: string;
  closing: string;
};

const initialDraft: MemorialDraft = {
  heading: "Held close in memory, always",
  obituary:
    "Their story will appear here—shaped carefully from the details and memories you choose to share.",
  remembrance:
    "A specific memory you provide will anchor this tribute and keep it unmistakably theirs.",
  closing: "With love, always remembered",
};

const steps = ["About them", "Their story", "Design", "Preview"];
const DRAFT_STORAGE_KEY = "tributeready:draft:v1";
const DRAFT_LIFETIME = 7 * 24 * 60 * 60 * 1000;

export function MemorialBuilder() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [checkoutCancelled, setCheckoutCancelled] = useState(false);
  const [cancellationFeedbackSent, setCancellationFeedbackSent] =
    useState(false);
  const [draftFeedbackSent, setDraftFeedbackSent] = useState(false);
  const builderStarted = useRef(false);
  const [photo, setPhoto] = useState<string>("");
  const [draft, setDraft] = useState<MemorialDraft>(initialDraft);
  const [form, setForm] = useState({
    name: "",
    birthYear: "",
    passingYear: "",
    relationship: "",
    qualities: "",
    memories: "",
    saying: "",
    serviceDetails: "",
    programFormat: "bifold",
    serviceTitle: "",
    serviceDate: "",
    serviceLocation: "",
    orderOfService: "",
    readingOrPoem: "",
    acknowledgments: "",
    theme: "garden",
  });

  const years = useMemo(() => {
    if (!form.birthYear && !form.passingYear) return "Years to be added";
    return `${form.birthYear || "—"} — ${form.passingYear || "—"}`;
  }, [form.birthYear, form.passingYear]);

  const themeStyle = useMemo(
    () => resolveMemorialTheme(form.theme),
    [form.theme],
  );

  useEffect(() => {
    let restored:
      | {
          expiresAt?: number;
          step?: number;
          form?: typeof form;
          draft?: MemorialDraft;
          photo?: string;
        }
      | undefined;
    let restorationNotice = "";
    try {
      const saved = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const value = JSON.parse(saved) as typeof restored;
        if (value?.expiresAt && value.expiresAt > Date.now()) {
          restored = value;
          restorationNotice =
            "Your private draft was restored from this browser.";
        } else {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      }
      if (new URLSearchParams(window.location.search).get("checkout") === "cancelled") {
        restorationNotice =
          "Checkout was canceled. Nothing was charged, and your draft is still here.";
        void trackGrowthEvent({
          name: "checkout_cancelled",
          metadata: { stage: "checkout" },
        });
      }
    } catch {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
    const timer = window.setTimeout(() => {
      if (restored?.form?.name !== undefined) setForm(restored.form);
      if (restored?.draft?.heading) setDraft(restored.draft);
      if (typeof restored?.photo === "string") setPhoto(restored.photo);
      if (typeof restored?.step === "number") {
        setStep(Math.min(3, Math.max(0, restored.step)));
      }
      if (restorationNotice) setNotice(restorationNotice);
      if (
        new URLSearchParams(window.location.search).get("checkout") ===
        "cancelled"
      ) {
        setCheckoutCancelled(true);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || !form.name.trim()) return;
    const value = JSON.stringify({
      expiresAt: Date.now() + DRAFT_LIFETIME,
      step,
      form,
      draft,
      photo,
    });
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, value);
    } catch {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          expiresAt: Date.now() + DRAFT_LIFETIME,
          step,
          form,
          draft,
          photo: "",
        }),
      );
    }
  }, [draft, form, hydrated, photo, step]);

  function clearDraft() {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    router.replace("/#create");
    window.location.reload();
  }

  function advanceStep() {
    const completed = step === 0 ? "details" : "memories";
    void trackGrowthEvent({
      name: "builder_step_completed",
      metadata: { step: completed },
    });
    setStep((current) => current + 1);
  }

  async function sendCancellationReason(
    reason:
      | "too_expensive"
      | "not_ready"
      | "technical_issue"
      | "privacy_concern"
      | "other_no_comment",
  ) {
    await submitCustomerFeedback({ type: "cancellation", reason });
    setCancellationFeedbackSent(true);
  }

  async function sendDraftFeedback(
    rating: 1 | 2 | 3 | 4 | 5,
    reason: "too_generic" | "inaccurate" | "tone" | "missing_details" | "good",
  ) {
    await submitCustomerFeedback({ type: "draft_quality", rating, reason });
    setDraftFeedbackSent(true);
  }

  function update(field: keyof typeof form, value: string) {
    if (!builderStarted.current) {
      builderStarted.current = true;
      void trackGrowthEvent({
        name: "builder_started",
        metadata: { entry: form.name ? "restart" : "home" },
      });
    }
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setNotice("Please choose an image smaller than 8 MB.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice("Please choose a JPG, PNG, or WebP image.");
      return;
    }
    try {
      const optimized = await optimizePhoto(file);
      if (optimized.length > 2_500_000) {
        throw new Error("The optimized photo is still too large.");
      }
      setPhoto(optimized);
      setNotice("");
    } catch {
      setNotice("We could not prepare that photo. Please try another image.");
    }
  }

  async function generateTribute() {
    setIsGenerating(true);
    setNotice("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create draft");
      setDraft(data.draft);
      setStep(3);
      void trackGrowthEvent({
        name: "draft_generated",
        metadata: { theme: form.theme as "garden" | "classic" | "sky" },
      });
      void trackGrowthEvent({
        name: "builder_step_completed",
        metadata: { step: "preview" },
      });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We could not create the draft. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function checkout() {
    setIsCheckingOut(true);
    setNotice("");
    void trackGrowthEvent({
      name: "checkout_started",
      metadata: {
        theme: form.theme as "garden" | "classic" | "sky",
        hasPhoto: Boolean(photo),
      },
    });
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          details: form,
          draft,
          photoData: photo,
          growth: {
            sessionId: getGrowthSessionId(),
            attribution: getFirstTouchAttribution(),
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Checkout is not ready");
      if (data.url) window.location.href = data.url;
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Checkout is not ready yet. Your draft is safe in this browser.",
      );
    } finally {
      setIsCheckingOut(false);
    }
  }

  const canContinue =
    step === 0 ? form.name.trim().length > 1 : form.memories.trim().length > 15;

  return (
    <section id="create" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <span className="mb-3 block text-xs font-bold uppercase tracking-[0.24em] text-gold">
            Create their tribute
          </span>
          <h2 className="font-display text-4xl font-semibold leading-none text-forest sm:text-6xl">
            Begin with what you remember.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-forest/65">
            There is no perfect way to tell a life story. Share what feels
            right, skip what does not, and edit every word before anything is
            published.
          </p>
          {hydrated && form.name ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-forest/50">
              <span>Private browser draft · expires after 7 days</span>
              <button
                type="button"
                onClick={clearDraft}
                className="font-bold text-forest underline underline-offset-4"
              >
                Clear this draft
              </button>
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-forest/10 bg-paper paper-shadow">
          <div className="border-b border-forest/10 px-5 py-5 sm:px-8">
            <div className="flex items-center justify-between gap-2">
              {steps.map((label, index) => (
                <div
                  key={label}
                  className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${
                    index <= step ? "text-forest" : "text-forest/35"
                  }`}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full border text-[11px] ${
                      index < step
                        ? "border-forest bg-forest text-white"
                        : index === step
                          ? "border-gold bg-gold/10 text-forest"
                          : "border-forest/15"
                    }`}
                  >
                    {index < step ? <Check size={13} /> : index + 1}
                  </span>
                  <span className="hidden md:inline">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid min-h-[620px] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="border-b border-forest/10 p-6 sm:p-10 lg:border-r lg:border-b-0">
              {step === 0 && (
                <div className="space-y-6">
                  <BuilderHeading
                    eyebrow="Step one"
                    title="Tell us about them"
                    copy="Just the essentials for now. You can refine everything later."
                  />
                  <label className="group block">
                    <span className="field-label">Their full name</span>
                    <input
                      value={form.name}
                      onChange={(event) => update("name", event.target.value)}
                      className="field-input"
                      placeholder="e.g. Eleanor Rose Bennett"
                      autoFocus
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label>
                      <span className="field-label">Year born</span>
                      <input
                        value={form.birthYear}
                        onChange={(event) =>
                          update("birthYear", event.target.value)
                        }
                        className="field-input"
                        placeholder="1942"
                        inputMode="numeric"
                        maxLength={4}
                      />
                    </label>
                    <label>
                      <span className="field-label">Year remembered</span>
                      <input
                        value={form.passingYear}
                        onChange={(event) =>
                          update("passingYear", event.target.value)
                        }
                        className="field-input"
                        placeholder="2025"
                        inputMode="numeric"
                        maxLength={4}
                      />
                    </label>
                  </div>
                  <label>
                    <span className="field-label">Your relationship</span>
                    <select
                      value={form.relationship}
                      onChange={(event) =>
                        update("relationship", event.target.value)
                      }
                      className="field-input"
                    >
                      <option value="">Choose one</option>
                      <option>Parent</option>
                      <option>Grandparent</option>
                      <option>Spouse or partner</option>
                      <option>Sibling</option>
                      <option>Friend</option>
                      <option>Other loved one</option>
                    </select>
                  </label>
                  <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-forest/25 bg-mist/30 p-4 transition hover:border-sage hover:bg-mist/60">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-forest shadow-sm">
                      <ImagePlus size={19} />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-forest">
                        Add a favorite photo
                      </span>
                      <span className="text-xs text-forest/50">
                        JPG or PNG, up to 8 MB
                      </span>
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={handlePhoto}
                    />
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <BuilderHeading
                    eyebrow="Step two"
                    title="What made them, them?"
                    copy="Fragments are enough. A few honest details make a tribute feel true."
                  />
                  <label>
                    <span className="field-label">
                      Three words that describe them
                    </span>
                    <input
                      value={form.qualities}
                      onChange={(event) =>
                        update("qualities", event.target.value)
                      }
                      className="field-input"
                      placeholder="Warm, quick-witted, generous"
                    />
                  </label>
                  <label>
                    <span className="field-label">
                      A memory you return to
                    </span>
                    <textarea
                      value={form.memories}
                      onChange={(event) =>
                        update("memories", event.target.value)
                      }
                      className="field-input min-h-32 resize-y"
                      placeholder="Sunday dinners, the roses they grew, the way they made everyone feel welcome..."
                    />
                  </label>
                  <label>
                    <span className="field-label">
                      Something they often said
                      <span className="ml-1 font-normal text-forest/40">
                        (optional)
                      </span>
                    </span>
                    <input
                      value={form.saying}
                      onChange={(event) => update("saying", event.target.value)}
                      className="field-input"
                      placeholder="A familiar phrase or piece of advice"
                    />
                  </label>
                  <fieldset>
                    <legend className="field-label">
                      What would you like to print?
                    </legend>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        ["bifold", "Bifold program", "Four panels with an order of service"],
                        ["keepsake", "Memorial sheet", "A simple one-page remembrance"],
                      ].map(([value, title, copy]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => update("programFormat", value)}
                          className={`rounded-2xl border p-4 text-left transition ${
                            form.programFormat === value
                              ? "border-gold bg-gold/5 ring-2 ring-gold/15"
                              : "border-forest/10 hover:border-sage"
                          }`}
                        >
                          <span className="block text-xs font-bold text-forest">
                            {title}
                          </span>
                          <span className="mt-1 block text-[10px] leading-4 text-forest/45">
                            {copy}
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  {form.programFormat === "bifold" ? (
                    <div className="space-y-4 rounded-2xl bg-mist/45 p-4">
                      <p className="text-xs font-bold text-forest">
                        Program details{" "}
                        <span className="font-normal text-forest/45">(optional)</span>
                      </p>
                      <input
                        value={form.serviceTitle}
                        onChange={(event) =>
                          update("serviceTitle", event.target.value)
                        }
                        className="field-input"
                        aria-label="Service title"
                        placeholder="Service title, e.g. A celebration of life"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={form.serviceDate}
                          onChange={(event) =>
                            update("serviceDate", event.target.value)
                          }
                          className="field-input"
                          aria-label="Service date and time"
                          placeholder="Date and time"
                        />
                        <input
                          value={form.serviceLocation}
                          onChange={(event) =>
                            update("serviceLocation", event.target.value)
                          }
                          className="field-input"
                          aria-label="Venue or location"
                          placeholder="Venue or location"
                        />
                      </div>
                      <textarea
                        value={form.orderOfService}
                        onChange={(event) =>
                          update("orderOfService", event.target.value)
                        }
                        className="field-input min-h-28 resize-y"
                        aria-label="Order of service, one item per line"
                        placeholder={"Order of service, one item per line\nWelcome\nReading\nWords of remembrance\nClosing music"}
                      />
                      <textarea
                        value={form.readingOrPoem}
                        onChange={(event) =>
                          update("readingOrPoem", event.target.value)
                        }
                        className="field-input min-h-20 resize-y"
                        aria-label="Short reading or poem (optional)"
                        placeholder="Short reading or poem (optional)"
                      />
                      <textarea
                        value={form.acknowledgments}
                        onChange={(event) =>
                          update("acknowledgments", event.target.value)
                        }
                        className="field-input min-h-20 resize-y"
                        aria-label="Family acknowledgment (optional)"
                        placeholder="Family acknowledgment (optional)"
                      />
                    </div>
                  ) : (
                    <label>
                      <span className="field-label">
                        Service details{" "}
                        <span className="font-normal text-forest/40">(optional)</span>
                      </span>
                      <textarea
                        value={form.serviceDetails}
                        onChange={(event) =>
                          update("serviceDetails", event.target.value)
                        }
                        className="field-input min-h-24 resize-y"
                        placeholder="Date, time, place, or a short note"
                      />
                    </label>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-7">
                  <BuilderHeading
                    eyebrow="Step three"
                    title="Choose a feeling"
                    copy="Each design is quiet, printable, and easy to read. Your words stay at the center."
                  />
                  <div className="grid gap-3">
                    {Object.values(memorialThemes).map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => update("theme", theme.id)}
                        className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition ${
                          form.theme === theme.id
                            ? "border-gold bg-gold/5 ring-2 ring-gold/15"
                            : "border-forest/10 hover:border-sage"
                        }`}
                      >
                        <span className="flex -space-x-2">
                          {theme.swatches.map((color) => (
                            <span
                              key={color}
                              className="size-8 rounded-full border-2 border-white"
                              style={{ background: color }}
                            />
                          ))}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm font-bold text-forest">
                            {theme.name}
                          </span>
                          <span className="text-xs text-forest/50">
                            {theme.copy}
                          </span>
                        </span>
                        <span
                          className={`grid size-5 place-items-center rounded-full border ${
                            form.theme === theme.id
                              ? "border-gold bg-gold text-white"
                              : "border-forest/20"
                          }`}
                        >
                          {form.theme === theme.id && <Check size={12} />}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-mist/55 p-4">
                    <div className="flex gap-3">
                      <Sparkles className="mt-0.5 shrink-0 text-gold" size={18} />
                      <p className="text-xs leading-5 text-forest/65">
                        TributeReady uses assisted writing to shape only the
                        facts and memories you provide. It never publishes
                        automatically, and you can change every word.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-7">
                  <BuilderHeading
                    eyebrow="Your preview"
                    title="Their story, in your hands"
                    copy="Read it slowly. Edit anything that does not sound like them before continuing."
                  />
                  <div className="space-y-3">
                    <PreviewField
                      label="Opening"
                      value={draft.heading}
                      onEdited={() =>
                        void trackGrowthEvent({
                          name: "draft_edited",
                          metadata: { section: "heading" },
                        })
                      }
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          heading: value,
                        }))
                      }
                    />
                    <PreviewField
                      label="Life story"
                      value={draft.obituary}
                      multiline
                      onEdited={() =>
                        void trackGrowthEvent({
                          name: "draft_edited",
                          metadata: { section: "obituary" },
                        })
                      }
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          obituary: value,
                        }))
                      }
                    />
                    <PreviewField
                      label="Remembrance"
                      value={draft.remembrance}
                      multiline
                      onEdited={() =>
                        void trackGrowthEvent({
                          name: "draft_edited",
                          metadata: { section: "remembrance" },
                        })
                      }
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          remembrance: value,
                        }))
                      }
                    />
                    <PreviewField
                      label="Closing"
                      value={draft.closing}
                      onEdited={() =>
                        void trackGrowthEvent({
                          name: "draft_edited",
                          metadata: { section: "closing" },
                        })
                      }
                      onChange={(value) =>
                        setDraft((current) => ({
                          ...current,
                          closing: value,
                        }))
                      }
                    />
                  </div>
                  <div className="rounded-2xl bg-mist/55 p-4 text-center">
                    {draftFeedbackSent ? (
                      <p className="text-xs font-bold text-forest">
                        Thank you. Your private feedback helps improve the
                        writing.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-forest">
                          Does this draft feel true to them?
                        </p>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {[
                            [5, "good", "Yes"],
                            [3, "too_generic", "Too generic"],
                            [2, "inaccurate", "Something is inaccurate"],
                            [3, "tone", "Tone feels off"],
                            [3, "missing_details", "Missing details"],
                          ].map(([rating, reason, label]) => (
                            <button
                              key={String(reason)}
                              type="button"
                              onClick={() =>
                                void sendDraftFeedback(
                                  rating as 1 | 2 | 3 | 4 | 5,
                                  reason as Parameters<typeof sendDraftFeedback>[1],
                                )
                              }
                              className="rounded-full border border-forest/15 bg-white px-3 py-2 text-[10px] font-bold text-forest"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="rounded-2xl border border-forest/10 bg-white p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-forest">
                          Complete memorial collection
                        </p>
                        <p className="mt-1 text-xs leading-5 text-forest/50">
                          {form.programFormat === "bifold"
                            ? "Four-panel print-ready program, memorial card, thank-you card, and private memorial page."
                            : "One-page memorial sheet, memorial card, thank-you card, and private memorial page."}
                        </p>
                      </div>
                      <p className="font-display text-2xl font-semibold text-forest">
                        $34.99
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={checkout}
                      disabled={isCheckingOut}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-forest px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#235448] disabled:opacity-60"
                    >
                      {isCheckingOut ? (
                        <LoaderCircle className="animate-spin" size={17} />
                      ) : (
                        <LockKeyhole size={16} />
                      )}
                      Continue to Stripe checkout
                    </button>
                    <p className="mt-3 text-center text-[11px] text-forest/40">
                      One-time $34.99 payment · Review the total before paying
                    </p>
                    <a
                      href="/api/sample"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-forest underline decoration-forest/25 underline-offset-4"
                    >
                      <Download size={12} />
                      View a fictional sample PDF
                    </a>
                  </div>
                </div>
              )}

              {notice && (
                <p
                  role="status"
                  className="mt-5 rounded-xl bg-[#f5e9df] px-4 py-3 text-xs leading-5 text-[#794e32]"
                >
                  {notice}
                </p>
              )}
              {checkoutCancelled && !cancellationFeedbackSent ? (
                <div className="mt-4 rounded-2xl border border-forest/10 bg-mist/45 p-4">
                  <p className="text-xs font-bold text-forest">
                    What stopped you today?{" "}
                    <span className="font-normal text-forest/45">Optional</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      ["too_expensive", "Price"],
                      ["not_ready", "Not ready"],
                      ["technical_issue", "Technical issue"],
                      ["privacy_concern", "Privacy concern"],
                      ["other_no_comment", "Something else"],
                    ].map(([reason, label]) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() =>
                          void sendCancellationReason(
                            reason as Parameters<
                              typeof sendCancellationReason
                            >[0],
                          )
                        }
                        className="rounded-full border border-forest/15 bg-white px-3 py-2 text-[10px] font-bold text-forest"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {isGenerating ? (
                <p
                  role="status"
                  className="mt-6 rounded-2xl bg-forest/5 px-4 py-3 text-sm text-forest/70"
                >
                  Writing their tribute usually takes up to a minute. Please
                  keep this page open—nothing is lost while you wait.
                </p>
              ) : null}

              <div className="mt-8 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep((current) => Math.max(0, current - 1))}
                  className={`flex items-center gap-2 text-sm font-bold text-forest/60 transition hover:text-forest ${
                    step === 0 ? "invisible" : ""
                  }`}
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                {step < 2 && (
                  <button
                    type="button"
                    disabled={!canContinue}
                    onClick={advanceStep}
                    className="flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-white transition hover:bg-[#235448] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Continue
                    <ArrowRight size={16} />
                  </button>
                )}
                {step === 2 && (
                  <button
                    type="button"
                    disabled={isGenerating}
                    onClick={() => {
                      void trackGrowthEvent({
                        name: "builder_step_completed",
                        metadata: { step: "style" },
                      });
                      void generateTribute();
                    }}
                    className="flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-sm font-bold text-white transition hover:bg-[#235448] disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <LoaderCircle className="animate-spin" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    {isGenerating ? "Writing with care…" : "Create preview"}
                  </button>
                )}
              </div>
            </div>

            <div className="botanical-glow soft-grid relative flex items-center justify-center overflow-hidden p-6 sm:p-10">
              <span className="absolute left-8 top-8 size-28 rounded-full border border-forest/8" />
              <span className="absolute bottom-10 right-10 size-44 rounded-full border border-gold/12" />
              <div className="relative w-full max-w-md">
                <div className="absolute -left-8 -top-5 hidden rotate-[-8deg] rounded-xl bg-forest px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white shadow-lg sm:block">
                  Live preview
                </div>
                <article
                  className="paper-shadow relative aspect-[0.72] overflow-hidden rounded-sm px-7 py-9 text-center sm:px-10 sm:py-12"
                  style={{
                    backgroundColor: themeStyle.paper,
                    color: themeStyle.ink,
                    borderTop: `7px solid ${themeStyle.rule}`,
                    boxShadow:
                      "0 28px 60px rgba(23, 62, 53, 0.14), inset 0 0 0 1px rgba(23, 62, 53, 0.05)",
                  }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-4 rounded-[2px] border"
                    style={{ borderColor: themeStyle.frame }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-10 top-16 h-px"
                    style={{ backgroundColor: `${themeStyle.gold}55` }}
                  />
                  <div className="relative mx-auto mb-5 flex size-[5.75rem] items-center justify-center overflow-hidden rounded-full sm:size-[6.5rem]">
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `linear-gradient(145deg, ${themeStyle.accent}, ${themeStyle.gold})`,
                      }}
                    />
                    <span
                      className="relative flex size-[calc(100%-6px)] items-center justify-center overflow-hidden rounded-full"
                      style={{ backgroundColor: themeStyle.paper }}
                    >
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          className="font-display text-3xl"
                          style={{ color: `${themeStyle.ink}40` }}
                        >
                          {form.name
                            ? form.name
                                .split(" ")
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join("")
                            : "TR"}
                        </span>
                      )}
                    </span>
                  </div>
                  <p
                    className="text-[8px] font-bold uppercase tracking-[0.32em]"
                    style={{ color: themeStyle.gold }}
                  >
                    In loving memory
                  </p>
                  <h3
                    className="mt-3 font-display text-[2rem] font-semibold leading-[0.95] sm:text-[2.35rem]"
                    style={{ color: themeStyle.ink }}
                  >
                    {form.name || "Their name"}
                  </h3>
                  <p
                    className="mt-2 text-[9px] font-medium tracking-[0.22em]"
                    style={{ color: themeStyle.inkMuted }}
                  >
                    {years}
                  </p>
                  <div
                    className="mx-auto my-5 h-px w-14"
                    style={{ backgroundColor: `${themeStyle.gold}88` }}
                  />
                  <p
                    className="mx-auto max-w-[16rem] font-display text-[1.15rem] italic leading-7 sm:text-[1.25rem]"
                    style={{ color: themeStyle.ink }}
                  >
                    “{draft.heading}”
                  </p>
                  <p
                    className="mx-auto mt-4 max-w-[15rem] line-clamp-4 text-[10px] leading-[1.85] sm:text-[11px]"
                    style={{ color: themeStyle.inkMuted }}
                  >
                    {draft.obituary}
                  </p>
                  <p
                    className="mx-auto mt-4 max-w-[14rem] line-clamp-3 font-display text-[11px] italic leading-6"
                    style={{ color: themeStyle.ink }}
                  >
                    {draft.remembrance}
                  </p>
                  <div className="absolute inset-x-0 bottom-8 px-8">
                    <div
                      className="mx-auto mb-3 h-px w-10"
                      style={{ backgroundColor: `${themeStyle.gold}66` }}
                    />
                    <p
                      className="font-display text-sm italic leading-6"
                      style={{ color: themeStyle.ink }}
                    >
                      {draft.closing}
                    </p>
                  </div>
                </article>
                <div className="absolute -bottom-4 -right-3 flex items-center gap-2 rounded-full border border-forest/10 bg-white px-4 py-2 text-[10px] font-bold text-forest shadow-md">
                  <Download size={12} />
                  Print-ready
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuilderHeading({
  eyebrow,
  title,
  copy,
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">
        {eyebrow}
      </p>
      <h3 className="mt-2 font-display text-3xl font-semibold text-forest sm:text-4xl">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-forest/55">{copy}</p>
    </div>
  );
}

function PreviewField({
  label,
  value,
  onChange,
  onEdited,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEdited?: () => void;
  multiline?: boolean;
}) {
  return (
    <label className="block rounded-xl border border-forest/10 bg-white p-3 transition focus-within:border-sage">
      <span className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-forest/40">
        <PencilLine size={11} />
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onEdited}
          className="min-h-24 w-full resize-y bg-transparent text-base leading-6 text-forest outline-none sm:text-sm"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onEdited}
          className="w-full bg-transparent py-1 text-base text-forest outline-none sm:text-sm"
        />
      )}
    </label>
  );
}

async function optimizePhoto(file: File) {
  const image = await createImageBitmap(file);
  const maxDimension = 1200;
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    image.close();
    throw new Error("Canvas is unavailable");
  }
  context.fillStyle = "#fffdf8";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  image.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}
