/**
 * Indexable guide pages — this is the SEO surface.
 * Home page copy is not enough. Each intent query needs its own URL,
 * unique body, and a sitemap entry. "This page targets: keyword" is banned.
 */

import { premiumCss, GUMROAD_LIVE, type StorefrontBrand } from "./premium-storefront-html.js";

export type SeoGuide = {
  slug: string;
  query: string;
  title: string;
  description: string;
  paragraphs: string[];
};

function esc(s: string): string {
  return s
    .replace(/\s*\[ros-evo-[^\]]*(?:\]|$)/gi, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function slugify(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function titleFromQuery(q: string): string {
  return q
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase();
      if (["rfi", "rfis"].includes(lower)) return w.toUpperCase();
      if (["a", "an", "the", "for", "of", "and", "to", "on", "in"].includes(lower)) {
        return lower;
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

const BUILDGRID_GUIDES: SeoGuide[] = [
  {
    slug: "construction-rfi-log-template",
    query: "construction rfi log template",
    title: "Construction RFI Log Template (Excel) for Small and Mid-Size Jobs",
    description:
      "A construction RFI log template built for project managers who still run questions in email. Number, date, assignee, due date, closed — so the inspector question does not vanish.",
    paragraphs: [
      "A construction RFI log template is not a pretty spreadsheet. It is the only place a project manager can point when someone asks “when did we send that?” three weeks later. If RFIs live in email, texts, and a file named FINAL_v7, you do not have a log. You have a scavenger hunt.",
      "On a small or mid-size build, the architect question from Thursday afternoon is the one that stops a crew on Tuesday. The log has to be something a superintendent will actually open: number, date asked, question in one sentence, who owns the answer, due date, and whether it is open, answered, or closed. Anything fancier gets abandoned by week three.",
      "What to put on every row: RFI number, date issued, spec section if you have it, the question, who it went to, who is chasing it, due date, date returned, and status. Leave a column for the drawing or detail it hits. Do not write a novel in the question cell. The novel belongs in the attached PDF.",
      "Common failure: logging the RFI after the answer already came back. Then the log is a diary, not a tool. The rule is simple — if it left the trailer as a question, it gets a number first. The construction RFI log template in BuildGrid is built around that rule so a new PM can start the same day without inventing columns.",
      "Who this is for: project managers and supers coordinating subcontractors without Procore as the operating system. Who it is not for: teams that need live multiplayer SaaS with seats. This is an editable log you own and reuse on the next job.",
      "BuildGrid includes the RFI log plus the 3-week look-ahead, punch list, and submittal tracker that sit next to it. One payment. Digital download. Open it in Excel or Sheets the morning you buy it.",
    ],
  },
  {
    slug: "look-ahead-schedule-construction",
    query: "look ahead schedule construction",
    title: "3-Week Look Ahead Schedule for Construction (That a Super Will Use)",
    description:
      "A 3-week look-ahead schedule for construction that matches how the site actually works — crew-level, markable, not a 400-line P6 export.",
    paragraphs: [
      "A look ahead schedule in construction fails when it is a reprint of the master schedule. Superintendents do not run the day from a 400-line P6 export. They run it from what is happening this week, next week, and the week after — which trades are on site, which inspections are due, and what will stop a crew if an RFI is still open.",
      "A usable 3-week look-ahead is crew-level. Rows are work packages a human can mark up: “hang drywall level 2 west,” not WBS codes. Columns are the three weeks, plus constraints: material, inspection, RFI, weather. If a row cannot be explained in one sentence on a Monday huddle, it does not belong on the look-ahead.",
      "Build it every week from the field, not from the office copy of last month’s baseline. The point is the next 15 working days. Pull in open RFIs that block a crew. Pull in submittals that have not returned. That is how the look-ahead becomes the coordination tool instead of another PDF nobody prints.",
      "Common failure: updating it after the week already happened so it looks clean for the owner meeting. Then it is a report, not a plan. The BuildGrid look-ahead is a working sheet: mark it, photograph it, send it. Reuse the same structure on the next job so you are not inventing columns every Monday.",
      "This is for PMs and supers on small and mid-size builds. It is not a replacement for enterprise scheduling software. It is the sheet that actually gets used in the trailer.",
      "The look-ahead ships in the BuildGrid pack with the RFI log, punch list, and submittal tracker — because a schedule that ignores open questions is fiction. Digital download. One payment.",
    ],
  },
  {
    slug: "punch-list-template",
    query: "punch list template",
    title: "Punch List Template for Construction Closeout (Room by Room)",
    description:
      "A punch list template that survives the walk: room, item, owner, photo note, sign-off. Built for small and mid-size jobs where punch still dies in a group chat.",
    paragraphs: [
      "A punch list template is only useful if it survives the walk. Most do not. Items get shouted into a group chat, photographed into a camera roll, and lost between the owner meeting and the closeout binder. Then you rewalk the same rooms.",
      "The structure that works is room-by-room, not trade-by-trade dumped in random order. Each row: location, item in one line, trade, owner, due, photo note, and sign-off. If the owner can stand in the room and find the item without a translator, the template is doing its job.",
      "Assign an owner on the walk, not later. “Someone” is how punch items live forever. The template should make it awkward to leave owner blank. Photo notes belong in the sheet so the punch list is the record, not a scavenger hunt through texts.",
      "Common failure: starting a new list for every walk instead of updating the same one. Then you have four lists and no closeout. BuildGrid’s punch list is one living sheet you reuse from first walk to final sign-off, then copy to the next job.",
      "This is for project managers and supers closing small and mid-size builds. It is not a punch SaaS with seats. It is a file you own.",
      "It ships with the RFI log, 3-week look-ahead, and submittal tracker in the BuildGrid pack. One payment. Immediate download. 14-day fix if the files will not open.",
    ],
  },
  {
    slug: "construction-submittal-tracker",
    query: "construction submittal tracker",
    title: "Construction Submittal Tracker Template",
    description:
      "A construction submittal tracker with spec section, status, reviewer, and return date — so “I thought you had that” has a date trail.",
    paragraphs: [
      "A construction submittal tracker exists for one sentence: “I thought you had that.” If you cannot show spec section, date sent, who has it, and when it is due back, you do not have a tracker. You have hope.",
      "Columns that earn their keep: spec section, description, sub, date submitted, reviewer, status (draft, sent, returned, resubmit, approved), return date, and the drawing or product it gates. Status has to be a short list or everyone invents their own words and you cannot filter.",
      "Tie the tracker to the look-ahead. If a submittal is still out and that trade is on site in nine days, that row is a constraint, not paperwork. That is how the tracker stops being an office chore.",
      "Common failure: tracking only the first send and ignoring resubmittals. The second send is usually the one that burns the schedule. BuildGrid’s tracker keeps the same row alive through return and resubmit so the date trail stays in one place.",
      "For PMs coordinating subs on small and mid-size jobs. Not a replacement for a full document-control platform. A working sheet you copy onto the next job.",
      "Included in the BuildGrid pack with the RFI log, look-ahead, and punch list. Digital download after one payment.",
    ],
  },
  {
    slug: "construction-coordination-templates",
    query: "construction coordination templates",
    title: "Construction Coordination Templates for Project Managers",
    description:
      "Construction coordination templates a PM actually uses: RFI log, 3-week look-ahead, punch list, and submittal tracker. One pack, one payment, reuse every job.",
    paragraphs: [
      "Construction coordination templates fail when they are a 40-page PDF of theory. A project manager on a small or mid-size build needs four working files: where questions live, what happens in the next three weeks, what is left at closeout, and what is still with the reviewer. That is RFIs, look-ahead, punch, and submittals.",
      "Email is still the operating system on a lot of jobs. The pack has to drop into Excel or Sheets and get used on Tuesday morning, not after a training session. If a new PM cannot start the RFI log the same day, the templates are theater.",
      "Use them as a set. An RFI log that never touches the look-ahead is a graveyard. A look-ahead that ignores open submittals is fiction. A punch list that starts from zero every walk is overtime. Coordination is the four sheets talking to each other.",
      "BuildGrid is that set. You buy it once, download immediately, and copy it onto the next job. No seats, no login, no subscription. Support is email if the files will not open.",
      "Not for teams replacing Procore this quarter. For the PM who is still running the job from the inbox and needs a system before the next inspector visit.",
    ],
  },
];

function stripKeywordSpam(s: string): string {
  return s.replace(/\n*This page targets:.*$/gim, "").trim();
}

function genericGuides(brand: StorefrontBrand): SeoGuide[] {
  const kws = [
    ...(brand.product.intentKeywords ?? []),
    ...(brand.discoveryDoors ?? []).map((d) => d.intentQuery || d.title),
  ]
    .map((k) => stripKeywordSpam(k).trim())
    .filter(Boolean);
  const uniq = [...new Set(kws.map((k) => k.toLowerCase()))];
  const queries = uniq.length ? uniq : [`${brand.displayName} template`];
  const audience =
    brand.product.audience || "operators who need working files, not a lecture";
  const bullets = brand.product.bullets ?? ["ready-to-use templates"];
  return queries.slice(0, 8).map((query) => {
    const title = titleFromQuery(query);
    return {
      slug: slugify(query),
      query,
      title: `${title} — ${brand.displayName}`,
      description: `${title} for ${audience}. ${stripKeywordSpam(brand.product.description || brand.product.name)}. Digital download.`,
      paragraphs: [
        `People search “${query}” because they need a working file this week, not a course. ${brand.displayName} is ${brand.product.name} for ${audience}.`,
        stripKeywordSpam(
          brand.product.tagline ||
            brand.product.description ||
            `The work is improvised until there is a system on paper.`,
        ),
        `What you should expect from a real ${query}: clear columns or sections, language ${audience} already use, and something you can copy onto the next job without rebuilding it.`,
        `Inside ${brand.displayName}: ${bullets.join(", ")}. These are files you keep after one payment — not a login and a seat.`,
        `Common failure is bookmarking a blog post and still starting from a blank document. The pack exists so the next job starts from a structure that already survived contact with real work.`,
        `Download immediately after payment. Reuse it. If the files will not open, email ${brand.supportEmail || `care@${brand.siteId}.com`} within 14 days. We do not invent reviews or customer counts.`,
      ],
    };
  });
}

export function guidesFor(brand: StorefrontBrand): SeoGuide[] {
  if (brand.siteId === "buildgrid") return BUILDGRID_GUIDES;
  return genericGuides(brand);
}

export function renderGuideHtml(input: {
  brand: StorefrontBrand;
  guide: SeoGuide;
  related: SeoGuide[];
  canonicalUrl: string;
  fingerprint: string;
  rendererVersion: string;
}): string {
  const { brand, guide, related, canonicalUrl, fingerprint, rendererVersion } =
    input;
  const email = brand.supportEmail || `care@${brand.siteId}.com`;
  const price = Number(brand.product.priceUsd);
  const gumroad = GUMROAD_LIVE[brand.siteId] || "";
  const pageUrl = `${canonicalUrl}/guides/${guide.slug}/`;
  const body = guide.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("\n");
  const rel = related
    .filter((g) => g.slug !== guide.slug)
    .slice(0, 4)
    .map(
      (g) =>
        `<li><a href="/guides/${esc(g.slug)}/">${esc(g.title)}</a></li>`,
    )
    .join("");
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    mainEntityOfPage: pageUrl,
    author: { "@type": "Organization", name: brand.displayName },
    publisher: { "@type": "Organization", name: brand.displayName },
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(guide.title)}</title>
  <meta name="description" content="${esc(guide.description)}"/>
  <meta name="ros-artifact" content="${esc(fingerprint)}"/>
  <meta name="ros-renderer" content="${esc(rendererVersion)}"/>
  <link rel="canonical" href="${esc(pageUrl)}"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet"/>
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>${premiumCss(brand)}
  .article{max-width:42rem;padding:3.2rem 6vw 2rem}
  .article p{font-family:"Source Sans 3",system-ui,sans-serif;font-size:1.08rem;line-height:1.7;margin:0 0 1.1rem}
  .crumbs{font-size:.85rem;opacity:.7;margin:0 0 1.2rem;font-family:"Source Sans 3",system-ui,sans-serif}
  .crumbs a{text-decoration:none}
  </style>
</head>
<body>
<nav class="nav">
  <a class="brand-mark" href="/" style="text-decoration:none;color:inherit">${esc(brand.displayName)}</a>
  <span>
    <a href="/#inside">Inside</a>
    <a href="/#faq">FAQ</a>
    <a href="mailto:${esc(email)}">Contact</a>
  </span>
</nav>
<article class="article">
  <p class="crumbs"><a href="/">${esc(brand.displayName)}</a> / Guides / ${esc(guide.query)}</p>
  <h1>${esc(guide.title)}</h1>
  ${body}
  <div class="buy" id="offer" style="margin:2rem 0;grid-template-columns:1fr">
    <div>
      <h2>${esc(brand.product.name)}</h2>
      <p class="fine">${Number.isFinite(price) ? `$${price}.` : ""} Digital download. One payment.</p>
      <p style="margin-top:1rem"><button class="cta" id="buy" type="button" data-buy-url="${esc(gumroad)}">Get ${esc(brand.displayName)}${Number.isFinite(price) ? ` — $${price}` : ""}</button></p>
      <p class="err" id="err" hidden></p>
    </div>
  </div>
  ${rel ? `<h2>More guides</h2><ul>${rel}</ul>` : ""}
</article>
<footer class="footer">
  <div>${esc(brand.displayName)}</div>
  <div>
    <a href="/legal/privacy/">Privacy</a>
    <a href="/legal/terms/">Terms</a>
    <a href="/legal/refunds/">Refunds</a>
    <a href="mailto:${esc(email)}">${esc(email)}</a>
  </div>
</footer>
<script>
(function(){
  fetch('/api/beacon',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'pageview',path:location.pathname,url:location.href,referrer:document.referrer||null}),keepalive:true}).catch(function(){});
  var btn=document.getElementById('buy');
  var err=document.getElementById('err');
  var gumroad=btn && btn.getAttribute('data-buy-url');
  if(!btn) return;
  btn.addEventListener('click', async function(){
    btn.disabled=true; if(err) err.hidden=true;
    try{
      fetch('/api/beacon',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind:'checkout_start',path:location.pathname,url:location.href}),keepalive:true}).catch(function(){});
      if(gumroad){ location.href=gumroad; return; }
      var res=await fetch('/api/checkout',{method:'POST'});
      var data=await res.json();
      if(!res.ok||!data.url) throw new Error(data.error||'Checkout failed');
      location.href=data.url;
    }catch(e){ if(err){ err.textContent=e.message||String(e); err.hidden=false;} btn.disabled=false; }
  });
})();
</script>
</body>
</html>`;
}

export function renderGuidesIndexHtml(input: {
  brand: StorefrontBrand;
  guides: SeoGuide[];
  canonicalUrl: string;
  fingerprint: string;
  rendererVersion: string;
}): string {
  const { brand, guides, canonicalUrl, fingerprint, rendererVersion } = input;
  const email = brand.supportEmail || `care@${brand.siteId}.com`;
  const cards = guides
    .map(
      (g) =>
        `<article class="card"><h3><a href="/guides/${esc(g.slug)}/">${esc(g.title)}</a></h3><p>${esc(g.description)}</p></article>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Guides — ${esc(brand.displayName)}</title>
  <meta name="description" content="${esc(`Guides from ${brand.displayName} on the work the pack is built for.`)}"/>
  <meta name="ros-artifact" content="${esc(fingerprint)}"/>
  <meta name="ros-renderer" content="${esc(rendererVersion)}"/>
  <link rel="canonical" href="${esc(canonicalUrl)}/guides/"/>
  <style>${premiumCss(brand)}</style>
</head>
<body>
<nav class="nav">
  <a class="brand-mark" href="/" style="text-decoration:none;color:inherit">${esc(brand.displayName)}</a>
  <span>
    <a href="/">Home</a>
    <a href="mailto:${esc(email)}">Contact</a>
  </span>
</nav>
<section class="band" id="guides">
  <h1>Guides</h1>
  <p class="fine" style="max-width:52ch">Each article is a real page. No keyword-stuffed stubs.</p>
  <div class="grid-4">${cards}</div>
</section>
<footer class="footer">
  <div>${esc(brand.displayName)}</div>
  <div>
    <a href="/legal/privacy/">Privacy</a>
    <a href="/legal/terms/">Terms</a>
    <a href="/legal/refunds/">Refunds</a>
  </div>
</footer>
</body>
</html>`;
}

export function sitemapXml(
  canonicalUrl: string,
  guides: SeoGuide[],
  lastmod: string,
): string {
  const urls = [
    `${canonicalUrl}/`,
    `${canonicalUrl}/guides/`,
    ...guides.map((g) => `${canonicalUrl}/guides/${g.slug}/`),
    `${canonicalUrl}/legal/privacy/`,
    `${canonicalUrl}/legal/terms/`,
    `${canonicalUrl}/legal/refunds/`,
  ];
  const body = urls
    .map(
      (u, i) =>
        `<url><loc>${u}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>${i === 0 ? "1.0" : "0.8"}</priority></url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}
