/**
 * Execute CAE acquisition_asset experiments as real free utilities
 * (interactive tools), NOT thin owned intent SEO stubs.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import { buildBuyerHabitat } from "../acquisitionos/buyer-habitat.js";
import { writeDistributionReceipt } from "../acquisitionos/receipts.js";
import { saveCommercialLesson } from "../titan-world-store.js";
import { recordCommercialFailure } from "./failure-intelligence.js";
import { recordCommercialProgress } from "./progress.js";

type Logger = (
  level: "info" | "warn" | "error",
  event: string,
  meta?: Record<string, unknown>,
) => void;

function hostingRoot(): string {
  return process.env.HOSTING_DATA_DIR || "/opt/revenueos/data/hosting-plane";
}

/** Live storefront files are served from artifacts/<site>/current */
function artifactCurrent(businessId: string): string {
  return path.join(hostingRoot(), "artifacts", businessId, "current");
}

function publicBase(businessId: string): string {
  const host =
    process.env.HOSTING_PUBLIC_BASE_HOST ||
    process.env.REVENUEOS_PUBLIC_BASE_HOST ||
    "130.131.15.68.sslip.io";
  return `https://${businessId}.${host}`;
}

function utilitySpec(businessId: string): {
  slug: string;
  title: string;
  prompt: string;
  sections: string[];
} {
  const h = buildBuyerHabitat(businessId);
  const q = (h.searchQueries[0] ?? `${businessId} template`).toLowerCase();
  if (businessId === "deckready" || /pitch|deck/.test(q)) {
    return {
      slug: "pitch-deck-outline-generator",
      title: "Free Pitch Deck Outline Generator",
      prompt: "Describe your startup in one sentence",
      sections: [
        "Problem",
        "Solution",
        "Why now",
        "Market",
        "Product",
        "Business model",
        "Go-to-market",
        "Traction",
        "Team",
        "Ask",
      ],
    };
  }
  if (businessId === "rfpstrike" || /rfp/.test(q)) {
    return {
      slug: "rfp-response-outline",
      title: "Free RFP Response Outline",
      prompt: "Paste the RFP title / scope one-liner",
      sections: [
        "Understanding",
        "Approach",
        "Workplan",
        "Team",
        "Pricing structure",
        "Risks",
        "Differentiators",
      ],
    };
  }
  const label = q.replace(/[^a-z0-9]+/g, " ").trim() || businessId;
  return {
    slug: `${businessId}-free-utility`,
    title: `Free ${label} helper`,
    prompt: `Describe your ${h.buyerPersona.replace(/_/g, " ")} situation`,
    sections: ["Context", "Checklist", "Next actions", "Risks", "Output"],
  };
}

function buildUtilityHtml(input: {
  businessId: string;
  title: string;
  prompt: string;
  sections: string[];
  homeTrack: string;
  canonical: string;
}): string {
  const sectionsJson = JSON.stringify(input.sections);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${input.title} — ${input.businessId}</title>
<meta name="description" content="${input.title}. Free interactive tool — no signup."/>
<link rel="canonical" href="${input.canonical}"/>
<style>
  :root { color-scheme: light; --ink:#14110f; --muted:#5c534c; --line:#d9d0c5; --bg:#f7f3ec; --card:#fffdf8; --accent:#0f3d2e; }
  body{margin:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;background:linear-gradient(180deg,#efe8dc,#f7f3ec 40%,#f7f3ec);color:var(--ink);}
  main{max-width:44rem;margin:0 auto;padding:2rem 1.1rem 4rem;}
  h1{font-size:1.75rem;line-height:1.2;margin:0 0 .5rem;}
  .sub{color:var(--muted);margin:0 0 1.5rem;}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.15rem;}
  label{display:block;font-size:.85rem;font-weight:600;margin-bottom:.4rem;}
  textarea{width:100%;min-height:6rem;border:1px solid var(--line);border-radius:10px;padding:.75rem;font:inherit;box-sizing:border-box;}
  button{margin-top:.85rem;background:var(--accent);color:#f4f1ea;border:0;border-radius:999px;padding:.7rem 1.15rem;font-weight:650;cursor:pointer;}
  button:hover{filter:brightness(1.08);}
  #out{margin-top:1.1rem;white-space:pre-wrap;line-height:1.55;}
  .note{margin-top:1.4rem;font-size:.92rem;color:var(--muted);}
  a{color:var(--accent);}
  .badge{display:inline-block;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--line);padding:.25rem .55rem;border-radius:999px;margin-bottom:.9rem;}
</style>
</head>
<body>
<main data-ros-cae-utility="1" data-ros-business="${input.businessId}">
  <div class="badge">Free utility · no signup</div>
  <h1>${input.title}</h1>
  <p class="sub">Interactive outline helper for ${input.businessId} buyers. Runs in your browser. Nothing is uploaded.</p>
  <div class="card">
    <label for="brief">${input.prompt}</label>
    <textarea id="brief" placeholder="e.g. B2B workflow tool for ops teams who hate spreadsheet chaos"></textarea>
    <button type="button" id="go">Generate outline</button>
    <div id="out" aria-live="polite"></div>
  </div>
  <p class="note">Useful? Continue to the full pack: <a href="/?${input.homeTrack}#buy">${input.businessId}</a></p>
</main>
<script>
(function(){
  var sections = ${sectionsJson};
  var btn = document.getElementById('go');
  var brief = document.getElementById('brief');
  var out = document.getElementById('out');
  btn.addEventListener('click', function(){
    var text = (brief.value || '').trim() || 'your offer';
    var lines = ['Outline for: ' + text, ''];
    for (var i=0;i<sections.length;i++){
      lines.push((i+1) + '. ' + sections[i]);
      lines.push('   - Hook: how this relates to \"' + text.slice(0,80) + '\"');
      lines.push('   - Proof to gather:');
      lines.push('   - One sentence claim:');
      lines.push('');
    }
    lines.push('Next: tighten claims, attach evidence, then open the full pack.');
    out.textContent = lines.join('\\n');
    try {
      navigator.sendBeacon && navigator.sendBeacon('/api/beacon', JSON.stringify({
        kind: 'cae_utility_use',
        businessId: '${input.businessId}',
        utility: ${JSON.stringify(input.title)},
        at: new Date().toISOString()
      }));
    } catch (e) {}
  });
})();
</script>
</body>
</html>`;
}

export async function executeAcquisitionAsset(input: {
  pool: pg.Pool;
  businessId: string;
  hypothesis: string;
  logger: Logger;
}): Promise<{
  ok: boolean;
  alreadyPresent: boolean;
  publicUrl: string | null;
  detail: string;
}> {
  const spec = utilitySpec(input.businessId);
  const base = publicBase(input.businessId);
  const publicUrl = `${base}/tools/${spec.slug}/`;
  const root = path.join(artifactCurrent(input.businessId), "tools", spec.slug);
  const indexPath = path.join(root, "index.html");
  // Ensure artifact tree exists (storefront must already be deployed)
  if (!existsSync(artifactCurrent(input.businessId))) {
    return {
      ok: false,
      alreadyPresent: false,
      publicUrl: null,
      detail: "artifact_current_missing",
    };
  }

  if (existsSync(indexPath)) {
    const existing = readFileSync(indexPath, "utf8");
    if (existing.includes("data-ros-cae-utility")) {
      // Already built — do NOT keep hypothesizing. Record suppress lesson once/day.
      const recent = await input.pool.query(
        `select 1 from titan_commercial_failures
         where business_id=$1 and strategy_key='acquisition_asset_built_awaiting_distribution'
           and created_at > now() - interval '12 hours' limit 1`,
        [input.businessId],
      );
      if (!recent.rows[0]) {
        await recordCommercialFailure(input.pool, {
          businessId: input.businessId,
          strategyKey: "acquisition_asset_built_awaiting_distribution",
          rootCauseHypothesis: "ASSET_EXISTS_WITHOUT_THIRD_PARTY_DISTRIBUTION",
          evidence: { publicUrl, hypothesis: input.hypothesis },
          lesson:
            "Free utility already live on owned domain — further asset hypotheses are theater until third-party surfaces link/list it",
          nextDifferentAction:
            "distribute_utility_url_to_directories_communities_creators_not_more_owned_pages",
        });
        await saveCommercialLesson(input.pool, {
          scope: "acquisition_asset",
          lesson: `${input.businessId}: free utility exists at ${publicUrl}. Owned utility ≠ verified third-party exposure. Next experiments must place this URL on external surfaces and verify publication.`,
          businessIds: [input.businessId],
          confidence: 0.9,
          evidence: [{ publicUrl, at: new Date().toISOString() }],
        });
      }
      return {
        ok: true,
        alreadyPresent: true,
        publicUrl,
        detail: "utility_already_live",
      };
    }
  }

  mkdirSync(root, { recursive: true });
  const homeTrack = `utm_source=cae_utility&utm_medium=free_tool&utm_campaign=${input.businessId}&utm_content=${spec.slug}`;
  const html = buildUtilityHtml({
    businessId: input.businessId,
    title: spec.title,
    prompt: spec.prompt,
    sections: spec.sections,
    homeTrack,
    canonical: publicUrl,
  });
  writeFileSync(indexPath, html);

  const assetId = `asset_${input.businessId}_utility_${spec.slug}`;
  await input.pool.query(
    `insert into aq_assets (asset_id, business_id, buyer, asset_type, purpose, channel_family, title, public_url, status, published_at, meta)
     values ($1,$2,$3,'free_utility','acquisition_pull','product_led',$4,$5,'PUBLISHED',now(),$6::jsonb)
     on conflict (asset_id) do update set public_url=excluded.public_url, status='PUBLISHED', published_at=now(), meta=excluded.meta`,
    [
      assetId,
      input.businessId,
      buildBuyerHabitat(input.businessId).buyerPersona,
      spec.title,
      publicUrl,
      JSON.stringify({
        cae: true,
        interactive: true,
        hypothesis: input.hypothesis,
        builtAt: new Date().toISOString(),
      }),
    ],
  );

  await writeDistributionReceipt(input.pool, {
    businessId: input.businessId,
    hypothesis: input.hypothesis,
    externalDestination: publicUrl,
    externalAction: "publish_free_utility",
    executorType: "CONTENT_PUBLISH",
    requestResult: { interactive: true, slug: spec.slug },
    publicUrl,
    status: "PUBLISHED",
    expectedExposure: "share_link_or_directory_listing_required",
    countsAsDistribution: false,
    kind: "acquisition_asset_owned",
    buyer: buildBuyerHabitat(input.businessId).buyerPersona,
  });

  await recordCommercialProgress(input.pool, {
    businessId: input.businessId,
    eventKind: "validated_business_improvement",
    isNewAudience: false,
    detail: `free_utility_live:${publicUrl}`,
    meta: { publicUrl, slug: spec.slug },
  });

  await saveCommercialLesson(input.pool, {
    scope: "acquisition_asset",
    lesson: `${input.businessId}: shipped interactive free utility at ${publicUrl}. This is pull infrastructure, not third-party exposure. Distribute the URL externally next; do not count owned publish as STAGE progress.`,
    businessIds: [input.businessId],
    confidence: 0.88,
    evidence: [{ publicUrl, hypothesis: input.hypothesis }],
  });

  input.logger("info", "cae.acquisition_asset.built", {
    businessId: input.businessId,
    publicUrl,
    slug: spec.slug,
  });

  return {
    ok: true,
    alreadyPresent: false,
    publicUrl,
    detail: "utility_built",
  };
}
