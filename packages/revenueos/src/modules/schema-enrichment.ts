/**
 * Schema.org JSON-LD enrichment.
 *
 * Generates Product / FAQ / HowTo / Offer JSON-LD blocks for a topic slug
 * using the LLM to fill in real schema.org fields from BrandConfig. The
 * output is a single `<script type="application/ld+json">…</script>` string
 * that the topic page reads from a disk file, so pages can be enriched
 * without redeploying.
 *
 * Never throws — on any LLM failure returns a deterministic minimal Product
 * schema derived from BrandConfig so the page always has valid JSON-LD.
 */

import { callOpenAI, DEFAULT_MODELS, hasOpenAIKey } from "./openai-client";

export type EnrichBrand = {
  siteId: string;
  displayName: string;
  domain: string;
  supportEmail?: string;
  product: {
    name: string;
    priceUsd: number;
    description?: string;
    bullets?: string[];
  };
};

export type EnrichDoor = {
  slug: string;
  title: string;
  intentQuery?: string;
  body?: string;
};

export type EnrichedSchema = {
  ok: boolean;
  jsonLd: string;
  meta: { title: string; description: string };
  reason?: string;
};

const SCHEMA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["metaTitle", "metaDescription", "faq", "howto"],
  properties: {
    metaTitle: { type: "string" },
    metaDescription: { type: "string" },
    faq: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["q", "a"],
        properties: {
          q: { type: "string" },
          a: { type: "string" },
        },
      },
    },
    howto: {
      type: "object",
      additionalProperties: false,
      required: ["name", "steps"],
      properties: {
        name: { type: "string" },
        steps: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "text"],
            properties: {
              name: { type: "string" },
              text: { type: "string" },
            },
          },
        },
      },
    },
  },
};

function baseProductSchema(brand: EnrichBrand, appUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: brand.product.name,
    description: brand.product.description ?? `${brand.product.name} from ${brand.displayName}`,
    brand: { "@type": "Brand", name: brand.displayName },
    offers: {
      "@type": "Offer",
      url: appUrl,
      priceCurrency: "USD",
      price: brand.product.priceUsd.toFixed(2),
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: brand.displayName },
    },
  };
}

function fallbackJsonLd(input: { brand: EnrichBrand; door: EnrichDoor; appUrl: string }) {
  const productBlock = baseProductSchema(input.brand, input.appUrl);
  const nodes = [productBlock];
  return `<script type="application/ld+json">${JSON.stringify(nodes)}</script>`;
}

export type EnrichPageSchemaInput = {
  brand: EnrichBrand;
  slug: string;
  door: EnrichDoor;
  appUrl?: string;
};

export async function enrichPageSchema(
  input: EnrichPageSchemaInput,
): Promise<EnrichedSchema> {
  const appUrl =
    input.appUrl ?? `https://${input.brand.domain.replace(/^https?:\/\//, "")}`;
  const topicUrl = `${appUrl.replace(/\/$/, "")}/topics/${input.slug}`;
  const fallbackMeta = {
    title: `${input.door.title} — ${input.brand.displayName}`,
    description:
      input.door.body?.slice(0, 155) ??
      `${input.brand.product.name} — ${input.brand.displayName}`,
  };

  if (!hasOpenAIKey()) {
    return {
      ok: true,
      jsonLd: fallbackJsonLd({ brand: input.brand, door: input.door, appUrl }),
      meta: fallbackMeta,
      reason: "no OPENAI_API_KEY (fallback schema used)",
    };
  }

  const system = {
    role: "system" as const,
    content:
      "You produce schema.org JSON-LD content for a specific topic page. Every fact must be inferable from the provided BrandConfig and door — do NOT invent metrics, dates, reviews, ratings, or authors. FAQ answers must be concrete and non-generic. HowTo steps must be actionable and unique to the door topic.",
  };
  const user = {
    role: "user" as const,
    content: `Brand: ${input.brand.displayName}\nProduct: ${input.brand.product.name} — $${input.brand.product.priceUsd}\nDescription: ${input.brand.product.description ?? ""}\nBullets: ${(input.brand.product.bullets ?? []).join("; ")}\n\nTopic slug: ${input.slug}\nTopic title: ${input.door.title}\nIntent query: ${input.door.intentQuery ?? ""}\nBody: ${input.door.body?.slice(0, 800) ?? ""}\nPage URL: ${topicUrl}\n\nReturn metaTitle, metaDescription, FAQ items (3-8), and a HowTo with actionable steps.`,
  };

  try {
    const res = await callOpenAI<{
      metaTitle: string;
      metaDescription: string;
      faq: Array<{ q: string; a: string }>;
      howto: { name: string; steps: Array<{ name: string; text: string }> };
    }>({
      model: DEFAULT_MODELS.strategist,
      messages: [system, user],
      jsonSchema: SCHEMA_JSON_SCHEMA,
      temperature: 0.4,
      maxOutputTokens: 600,
      timeoutMs: 30_000,
      justification: {
        scope: "business",
        subsystem: "schema-enrichment",
        purpose: "search_intent_analysis",
        reason: "generate schema/FAQ for intent topic page indexability",
        priority: 6,
        stateHash: `${input.slug}|${input.brand.displayName}`,
      },
    });
    if (!res.ok) {
      return {
        ok: true,
        jsonLd: fallbackJsonLd({ brand: input.brand, door: input.door, appUrl }),
        meta: fallbackMeta,
        reason: res.reason,
      };
    }
    const product = baseProductSchema(input.brand, topicUrl);
    const faqBlock = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: res.data.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };
    const howtoBlock = {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: res.data.howto.name,
      step: res.data.howto.steps.map((s, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: s.name,
        text: s.text,
      })),
    };
    const nodes = [product, faqBlock, howtoBlock];
    const jsonLd = `<script type="application/ld+json">${JSON.stringify(nodes)}</script>`;
    return {
      ok: true,
      jsonLd,
      meta: {
        title: res.data.metaTitle.slice(0, 120),
        description: res.data.metaDescription.slice(0, 300),
      },
    };
  } catch (err) {
    return {
      ok: true,
      jsonLd: fallbackJsonLd({ brand: input.brand, door: input.door, appUrl }),
      meta: fallbackMeta,
      reason: `schema-enrichment failure: ${(err as Error).message.slice(0, 120)}`,
    };
  }
}
