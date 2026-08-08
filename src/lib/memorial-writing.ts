export type MemorialInput = {
  name: string;
  birthYear?: string;
  passingYear?: string;
  relationship?: string;
  qualities?: string;
  memories?: string;
  saying?: string;
  serviceDetails?: string;
  programFormat?: "bifold" | "keepsake";
  serviceTitle?: string;
  serviceDate?: string;
  serviceLocation?: string;
  orderOfService?: string;
  readingOrPoem?: string;
  acknowledgments?: string;
  theme?: string;
};

export type MemorialDraft = {
  heading: string;
  obituary: string;
  remembrance: string;
  closing: string;
};

const GENERIC_HEADING_PATTERNS = [
  /^a life held close/i,
  /^forever in our hearts/i,
  /^gone but not forgotten/i,
  /^in loving memory$/i,
  /^remembering .+$/i,
  /^celebrating the life of/i,
  /^a life well lived/i,
  /^rest in peace$/i,
];

const BANNED_PHRASES = [
  "passed away peacefully",
  "surrounded by family",
  "touched so many lives",
  "empty chair",
  "shining star",
  "legacy will live on",
  "journey has ended",
  "called home",
  "gained their wings",
  "forever in our hearts",
  "gone too soon",
  "will be deeply missed",
  "leaves behind a legacy",
  "computer-generated",
  "in conclusion",
  "it is with heavy hearts",
];

export const MEMORIAL_EDITOR_INSTRUCTIONS = [
  "You are a senior memorial editor at a fine letterpress studio. Families trust you to honor someone they love—not to produce template copy or AI-sounding prose.",
  "Write with quiet dignity, emotional restraint, and specific detail drawn only from the family's answers.",
  "Never invent dates, relationships, accomplishments, relatives, beliefs, events, or personality traits.",
  "Do not use clichés about death, angels, heaven, or religion unless the family supplied that belief.",
  "Do not exaggerate grief or use language intended to pressure a purchase.",
  "HEADING: One short, image-led line (5–14 words). Draw it from a memory, quality, or saying they provided.",
  "Never use the person's name plus years alone (e.g. 'Jane Doe (1940–2024)'). Never use stock memorial slogans.",
  "OBITUARY: Two or three short paragraphs (120–320 words). Open with who they were to the people who knew them. Weave in one concrete memory. Mix short and longer sentences. Refer to them by name.",
  "REMEMBRANCE: One focused paragraph centered on the supplied memory—sensory, grounded, no preamble like 'We remember when'.",
  "CLOSING: A single inscription line (4–12 words)—dignified, printable, not a marketing slogan. Echo their saying if one was provided.",
  "Avoid: beloved (overused), peaceful passing, fought bravely, journey, legacy, touched countless lives, forever in our hearts, gone but not forgotten.",
].join(" ");

export function polishMemorialDraft(
  draft: MemorialDraft,
  input: MemorialInput,
  options: { preserveRemembrance?: boolean } = {},
): MemorialDraft {
  const cleaned = {
    // A weak heading or closing is regenerated below, so emptying one is safe.
    heading: scrubText(draft.heading, { allowEmpty: true }),
    obituary: scrubText(draft.obituary),
    remembrance: options.preserveRemembrance
      ? draft.remembrance.replace(/\s+/g, " ").trim()
      : scrubText(draft.remembrance),
    closing: scrubText(draft.closing, { allowEmpty: true }),
  };

  if (isWeakHeading(cleaned.heading, input.name)) {
    cleaned.heading = craftHeading(input);
  }

  if (isWeakClosing(cleaned.closing)) {
    cleaned.closing = craftClosing(input);
  }

  return cleaned;
}

export function createLocalDraft(input: MemorialInput): MemorialDraft {
  const qualities = input.qualities?.trim() || "kindness and steady presence";
  const relationship = input.relationship?.trim().toLowerCase();
  const saying = input.saying?.trim();

  const relationshipLine = relationship
    ? `As a ${relationship}, ${input.name} was known for ${qualities.toLowerCase()}.`
    : `${input.name} was known for ${qualities.toLowerCase()}.`;

  const sayingLine = saying
    ? ` The words “${saying}” stayed with those who loved them.`
    : "";

  return polishMemorialDraft(
    {
      heading: craftHeading(input),
      obituary: `${relationshipLine} The truest portrait of ${input.name} lives in the moments shared—the ordinary days that became treasured memory.${sayingLine}`,
      remembrance: input.memories?.trim()
        ? input.memories.trim()
        : `The small moments and familiar qualities that made ${input.name} unmistakably themselves remain part of their story.`,
      closing: craftClosing(input),
    },
    input,
    // The remembrance is the family's own wording here. Editing what they wrote
    // about their own dead is not ours to do.
    { preserveRemembrance: Boolean(input.memories?.trim()) },
  );
}

// Deleting a phrase where it sits leaves wreckage behind — "she will be deeply
// missed by her students" becomes "she by her students" — so an offending
// sentence is dropped whole. Losing every sentence would be worse than printing
// a cliché, so that only happens where a replacement is generated afterwards.
function scrubText(value: string, { allowEmpty = false } = {}) {
  const text = value.replace(/\s+/g, " ").trim();
  const sentences = text.match(/[^.!?]+[.!?]*/g);
  if (!sentences) return text;

  const kept = sentences.filter((sentence) => !containsBannedPhrase(sentence));
  if (kept.length === sentences.length) return text;
  if (kept.length === 0) return allowEmpty ? "" : text;

  return kept.join(" ").replace(/\s{2,}/g, " ").trim();
}

function containsBannedPhrase(sentence: string) {
  const lowered = sentence.toLowerCase();
  return BANNED_PHRASES.some((phrase) => lowered.includes(phrase));
}

function isWeakHeading(heading: string, name: string) {
  const trimmed = heading.trim();
  if (trimmed.length < 8) return true;
  if (GENERIC_HEADING_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return true;
  }
  const yearsPattern = new RegExp(
    `^${escapeRegExp(name)}\\s*\\(?\\d{4}\\s*[–-]\\s*\\d{4}\\)?$`,
    "i",
  );
  if (yearsPattern.test(trimmed)) return true;
  if (/^\d{4}\s*[–-]\s*\d{4}$/.test(trimmed)) return true;
  return false;
}

function isWeakClosing(closing: string) {
  const trimmed = closing.trim().toLowerCase();
  return (
    trimmed.length < 4 ||
    trimmed.includes("loved beyond words") ||
    trimmed.includes("remembered beyond measure") ||
    trimmed.includes("forever in our hearts")
  );
}

function craftHeading(input: MemorialInput) {
  const memoryLead = firstMemoryPhrase(input.memories || "");
  if (memoryLead.length >= 12 && memoryLead.length <= 72) {
    return capitalizeFirst(memoryLead);
  }

  const qualities = input.qualities?.trim();
  if (qualities) {
    const firstQuality = qualities.split(/[,;]/)[0]?.trim();
    if (firstQuality) {
      return `Marked by ${firstQuality.toLowerCase()}, always`;
    }
  }

  if (input.saying?.trim()) {
    const saying = input.saying.trim();
    return saying.length <= 72 ? saying : `${saying.slice(0, 69).trim()}…`;
  }

  return `Held close in memory, always`;
}

function craftClosing(input: MemorialInput) {
  if (input.saying?.trim()) {
    const saying = input.saying.trim();
    return saying.length <= 80 ? saying : `${saying.slice(0, 77).trim()}…`;
  }
  return "With love, always remembered";
}

function firstMemoryPhrase(memories: string) {
  const sentence = memories
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!sentence) {
    return memories.trim().split(/\s+/).slice(0, 10).join(" ");
  }
  return sentence.replace(/^["'“”]+|["'“”]+$/g, "");
}

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
