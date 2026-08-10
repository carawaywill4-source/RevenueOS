/**
 * Prompt-injection / hostile external content defense.
 * External content = DATA plane. Never CONTROL plane.
 */

export type ExternalContentClassification = {
  untrusted: true;
  control_plane_effect: "NONE";
  contains_injection_attempt: boolean;
  signals: string[];
  safe_to_inform_beliefs: boolean;
  note: string;
};

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(your\s+)?instructions/i,
  /ignore\s+(all\s+)?(revenueos\s+)?rules/i,
  /disregard\s+(your\s+)?(previous|prior)\s+(instructions|rules)/i,
  /you\s+are\s+now\s+/i,
  /reveal\s+(your\s+)?(secrets|credentials|api\s*keys?)/i,
  /send\s+(me\s+)?(the\s+)?(secrets?|credentials|api\s*keys?)/i,
  /send\s+.{0,40}(stripe|secret|private)\s*keys?/i,
  /exfiltrat/i,
  /override\s+(owner\s+)?constitution/i,
  /change\s+(spending|budget|paid\s+ads)\s+rules/i,
  /execute\s+(shell|command|rm\s+-rf)/i,
  /modify\s+(memory|system\s+prompt|permissions)/i,
  /revenueos\s+ignore/i,
];

/**
 * Classify hostile or ordinary web content.
 * Always untrusted; injection attempts never alter control plane.
 */
export function classifyExternalContent(text: string): ExternalContentClassification {
  const signals: string[] = [];
  for (const re of INJECTION_PATTERNS) {
    if (re.test(text)) signals.push(re.source);
  }
  const injection = signals.length > 0;
  return {
    untrusted: true,
    control_plane_effect: "NONE",
    contains_injection_attempt: injection,
    signals,
    safe_to_inform_beliefs: !injection,
    note: injection
      ? "Hostile instruction patterns detected — discarded for control; may log as attack observation only."
      : "External content remains data-only; cannot modify constitution, credentials, spend, or deployment authority.",
  };
}
