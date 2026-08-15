import { test } from "node:test";
import assert from "node:assert/strict";
import { earliestBrokenStage, shouldEnterZeroExposure, polishAllowed } from "../lib/commercial-execution-v4/ledger.js";
import { diagnoseEmailSendability, composeSalesEmail, isPersonalDumpOrSpamTarget } from "../lib/commercial-execution-v4/email.js";
import { classifyDirectoryPage, listingLooksAccepted } from "../lib/commercial-execution-v4/directory.js";
import { extractPublicEmails } from "../lib/commercial-execution-v4/contacts.js";
import { gumroadOwnerBlocker } from "../lib/commercial-execution-v4/marketplace.js";
import { buyUrlFor, trackedBuyUrl } from "../lib/commercial-execution-v4/offer.js";
import { extractSignupForm } from "../lib/commercial-execution-v4/signup.js";
import { listingDeskEmails, siblingSubmitUrls, shouldAbandonResult, composeListingAsk } from "../lib/commercial-execution-v4/climb.js";
import { HUNT_QUERY_BANK, geoContactQueries, nextHuntQueries } from "../lib/commercial-execution-v4/hunt.js";
import { expandChannelUniverse, CHANNEL_ORIGINS, CHANNEL_DOORS } from "../lib/commercial-execution-v4/channel-universe.js";
import { parseBingHits } from "../lib/titan-research-engine.js";
import { escalationForHits, failureFingerprint } from "../lib/commercial-execution-v4/failure-patterns.js";
import { channelScore, judgePair, pickPlacement, familyOf, type ChannelMemory } from "../lib/commercial-execution-v4/learn.js";
import { formatOwnerNow, isCommercialNowQuestion } from "../lib/commercial-execution-v4/owner-status.js";

test("funnel earliest stage is EXTERNAL_ACTION when nothing left the machine", () => {
  assert.equal(
    earliestBrokenStage({
      externalActions: 0,
      exposures: 0,
      verifiedHumans: 0,
      engagements: 0,
      leads: 0,
      checkouts: 0,
      purchases: 0,
    }),
    "EXTERNAL_ACTION",
  );
});

test("funnel does not blame checkout when humans are zero", () => {
  assert.equal(
    earliestBrokenStage({
      externalActions: 12,
      exposures: 0,
      verifiedHumans: 0,
      engagements: 0,
      leads: 0,
      checkouts: 0,
      purchases: 0,
    }),
    "EXPOSURE",
  );
});

test("zero-exposure mode when never seen a human", () => {
  assert.equal(
    shouldEnterZeroExposure({
      scope: "buildgrid",
      minutesSinceLastExternalCommercialAction: 3,
      minutesSinceLastVerifiedHuman: null,
      minutesSinceLastLead: null,
      minutesSinceLastCheckout: null,
      minutesSinceLastPurchase: null,
      lastExternalAt: null,
      lastHumanAt: null,
    }),
    true,
  );
  assert.equal(
    polishAllowed({
      scope: "buildgrid",
      minutesSinceLastExternalCommercialAction: 3,
      minutesSinceLastVerifiedHuman: null,
      minutesSinceLastLead: null,
      minutesSinceLastCheckout: null,
      minutesSinceLastPurchase: null,
      lastExternalAt: null,
      lastHumanAt: null,
    }),
    false,
  );
});

test("Resend test domain is not third-party sendable", () => {
  const d = diagnoseEmailSendability({
    RESEND_API_KEY: "re_test_key_1234567890",
    OUTREACH_FROM_EMAIL: "RevenueOS <onboarding@resend.dev>",
  } as NodeJS.ProcessEnv);
  assert.equal(d.sendable, false);
  assert.equal(d.blockerClass, "OWNER");
  assert.match(d.blocker ?? "", /verified sending domain/i);
});

test("missing API key is CONFIG not an owner identity blocker", () => {
  const d = diagnoseEmailSendability({} as NodeJS.ProcessEnv);
  assert.equal(d.sendable, false);
  assert.equal(d.blockerClass, "CONFIG");
});

test("CAPTCHA is a hard blocker; account-required is not", () => {
  const captcha = classifyDirectoryPage(
    "https://dir.example/submit",
    "<form action='/submit'><div class='g-recaptcha'></div></form>",
  );
  assert.equal(captcha.policy, "HARD_BLOCKED");
  assert.equal(captcha.hardBlocker, "captcha");

  const pub = classifyDirectoryPage(
    "https://dir.example/submit",
    "<form action='/submit'>submit your listing. no account required. <input name='url'></form>",
  );
  assert.equal(pub.policy, "PERMITTED_PUBLISH");
  assert.equal(pub.hardBlocker, null);
});

test("identical failure fingerprints escalate then abandon", () => {
  assert.equal(escalationForHits(1), "retry");
  assert.equal(escalationForHits(2), "investigate");
  assert.equal(escalationForHits(3), "alter_method");
  assert.equal(escalationForHits(4), "abandon");
  const a = failureFingerprint({
    businessId: "buildgrid",
    strategy: "research_permitted_publish_surface",
    channel: "directories",
    target: "https://antforms.com/blog",
    failureReason: "listicle",
  });
  const b = failureFingerprint({
    businessId: "buildgrid",
    strategy: "research_permitted_publish_surface",
    channel: "directories",
    target: "https://antforms.com/blog",
    failureReason: "listicle",
  });
  assert.equal(a, b);
});

test("search boxes and login forms are not listing submits", () => {
  const search = classifyDirectoryPage(
    "https://goodaitools.com/submit",
    `<form action="/search" method="GET"><input name="q"></form>`,
  );
  assert.equal(search.policy, "UNKNOWN");
  assert.match(search.reason, /search_form/);

  const login = classifyDirectoryPage(
    "https://dir.example/add",
    `<form action="/login.php" method="post"><input name="user"><input name="password"></form>`,
  );
  assert.equal(login.reason, "login_form_not_a_public_listing_submit");
});

test("SaaSHub-style URL listing form is publishable; bounce is not verified", () => {
  const page = classifyDirectoryPage(
    "https://www.saashub.com/services/submit",
    `<title>Submit a Product - SaaSHub</title>
     <form action="/services/new" method="get"><input name="url"><input name="commit" type="submit"></form>`,
  );
  assert.equal(page.policy, "PERMITTED_PUBLISH");
  assert.equal(page.formMethod, "get");
  assert.ok(page.fieldNames.includes("url"));
  const bounce = listingLooksAccepted(
    200,
    "<title>Submit a Product</title>",
    "https://www.saashub.com/services/submit",
  );
  assert.equal(bounce.verified, false);
  assert.equal(bounce.result, "bounced_to_submit_form");
});

test("listing thank-you is verified submit, not a plan", () => {
  const r = listingLooksAccepted(200, "Thanks for submitting. Your listing is pending review.");
  assert.equal(r.executed, true);
  assert.equal(r.verified, true);
});

test("harvests public role emails and skips noreply", () => {
  const found = extractPublicEmails(
    `<a href="mailto:editor@jobsitepm.com">editor</a> hello@jobsitepm.com noreply@jobsitepm.com`,
    "https://jobsitepm.com/rfi-log",
  );
  const emails = found.map((c) => c.email);
  assert.ok(emails.includes("editor@jobsitepm.com"));
  assert.ok(emails.includes("hello@jobsitepm.com"));
  assert.equal(emails.includes("noreply@jobsitepm.com"), false);
});

test("directory support inboxes are not buyers", () => {
  assert.equal(isPersonalDumpOrSpamTarget("support@viesearch.com"), true);
  assert.equal(isPersonalDumpOrSpamTarget("editor@jobsitepm.com"), false);
});

test("same-host directory support is a listing-desk door", () => {
  const desk = listingDeskEmails(
    `Email support@dir.example if the form is stuck.`,
    "https://dir.example/submit",
  );
  assert.ok(desk.some((c) => c.email === "support@dir.example"));
});

test("named operator emails are harvested, not only role inboxes", () => {
  const found = extractPublicEmails(
    `Reach Mike at mike@smithgc.com or hello@smithgc.com`,
    "https://smithgc.com/contact",
  );
  const emails = found.map((c) => c.email);
  assert.ok(emails.includes("mike@smithgc.com"));
  assert.ok(emails.includes("hello@smithgc.com"));
});

test("deobfuscates [at] public emails", () => {
  const found = extractPublicEmails(
    `Write editor [at] jobsitepm.com for reprints.`,
    "https://jobsitepm.com/contact",
  );
  assert.ok(found.some((c) => c.email === "editor@jobsitepm.com"));
});

test("hunt cursor walks a large query bank instead of six DDG strings", () => {
  const listing = {
    name: "BuildGrid",
    url: "https://willowdreams682.gumroad.com/l/dlfcqr",
    email: "care@buildgrid.com",
    description: "RFI pack",
    category: "software",
    intentKeywords: ["construction rfi log template"],
    priceUsd: 89,
  };
  assert.ok(HUNT_QUERY_BANK.length >= 40);
  assert.ok(geoContactQueries().length >= 50);
  const a = nextHuntQueries(0, listing, 6);
  const b = nextHuntQueries(a.nextCursor, listing, 6);
  assert.equal(a.queries.length, 6);
  assert.notEqual(a.queries.join("|"), b.queries.join("|"));
  assert.ok(a.queries.every((q) => !/\bsubmit\b/i.test(q)));
  assert.ok(b.queries.every((q) => !/\bsubmit\b/i.test(q)));
  const later = nextHuntQueries(HUNT_QUERY_BANK.length, listing, 4);
  assert.ok(later.queries.some((q) => /Denver|Austin|Dallas|Phoenix/.test(q)));
});

test("Bing cite HTML yields real destination URLs", () => {
  const html = `<cite>https://esiconstruction.com</cite><cite>https://www.ekcconstruction.com</cite>`;
  const hits = parseBingHits(html, 8);
  assert.ok(hits.some((h) => h.url.includes("esiconstruction.com")));
  assert.ok(hits.some((h) => h.url.includes("ekcconstruction.com")));
});

test("channel universe is a large executable pool, not 13 seed URLs", () => {
  assert.ok(CHANNEL_ORIGINS.length >= 150);
  assert.ok(CHANNEL_DOORS.includes("/signup"));
  const surfaces = expandChannelUniverse();
  assert.ok(surfaces.length >= 1500);
  assert.ok(surfaces.some((s) => /signup/i.test(s.url)));
  assert.ok(surfaces.some((s) => /submit/i.test(s.url)));
  const ids = new Set(surfaces.map((s) => s.id));
  assert.equal(ids.size, surfaces.length);
});

test("profit outranks traffic outranks untried; dead is last", () => {
  assert.ok(
    channelScore({ verdict: "WORKS", purchases: 1, revenueUsd: 89, checkouts: 0, humans: 0, attempts: 1 }) >
      channelScore({ verdict: "WORKS", purchases: 0, revenueUsd: 0, checkouts: 0, humans: 4, attempts: 1 }),
  );
  assert.ok(
    channelScore({ verdict: "WORKS", purchases: 0, revenueUsd: 0, checkouts: 0, humans: 1, attempts: 1 }) >
      channelScore({ verdict: "UNTRIED", purchases: 0, revenueUsd: 0, checkouts: 0, humans: 0, attempts: 0 }),
  );
  assert.ok(
    channelScore({ verdict: "DEAD", purchases: 0, revenueUsd: 0, checkouts: 0, humans: 0, attempts: 4 }) <
      channelScore({ verdict: "WRONG_FIT", purchases: 0, revenueUsd: 0, checkouts: 0, humans: 0, attempts: 1 }),
  );
});

test("a channel with no humans after the wait is dead for that pair", () => {
  const dead = judgePair({
    listedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    humans: 0,
    checkouts: 0,
    purchases: 0,
    revenueUsd: 0,
    lastResult: "submitted_or_pending_review",
  });
  assert.equal(dead.verdict, "DEAD");
  const waiting = judgePair({
    listedAt: new Date(),
    humans: 0,
    checkouts: 0,
    purchases: 0,
    revenueUsd: 0,
    lastResult: "submitted_or_pending_review",
  });
  assert.equal(waiting.verdict, "WAITING");
  const captcha = judgePair({
    listedAt: new Date(),
    humans: 0,
    checkouts: 0,
    purchases: 0,
    revenueUsd: 0,
    lastResult: "captcha",
  });
  assert.equal(captcha.verdict, "DEAD");
});

test("a channel that works for construction is cloned to the other construction product", () => {
  assert.equal(familyOf("buildgrid"), familyOf("quotecraft"));
  const mem: ChannelMemory[] = [
    {
      host: "saashub.com",
      businessId: "buildgrid",
      family: "construction",
      listedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      attempts: 1,
      humans: 3,
      checkouts: 1,
      purchases: 1,
      revenueUsd: 89,
      lastResult: "submitted_or_pending_review",
      verdict: "WORKS",
      score: 1100,
      reason: "attributed_purchase",
    },
  ];
  const pick = pickPlacement({
    businesses: ["buildgrid", "quotecraft", "resumeforge"],
    hosts: ["saashub.com", "futuretools.io"],
    memory: mem,
    explore: false,
  });
  assert.equal(pick.businessId, "quotecraft");
  assert.equal(pick.host, "saashub.com");
  assert.match(pick.reason, /clone_works_construction/);
});

test("a host that sucked for one product gets a different family, not a retry of the same pair", () => {
  const mem: ChannelMemory[] = [
    {
      host: "hotfrog.com",
      businessId: "buildgrid",
      family: "construction",
      listedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      attempts: 1,
      humans: 0,
      checkouts: 0,
      purchases: 0,
      revenueUsd: 0,
      lastResult: "submitted_or_pending_review",
      verdict: "WRONG_FIT",
      score: -40,
      reason: "host_works_for_other_family_not_this_product",
    },
  ];
  const pick = pickPlacement({
    businesses: ["buildgrid", "invoicechaser"],
    hosts: ["hotfrog.com"],
    memory: mem,
    explore: false,
  });
  assert.equal(pick.businessId, "invoicechaser");
  assert.equal(pick.host, "hotfrog.com");
  assert.match(pick.reason, /try_invoicechaser/);
});

test("listing URLs carry channel UTM so traffic can be attributed", () => {
  const url = trackedBuyUrl("buildgrid", "www.saashub.com");
  assert.match(url, /utm_source=saashub-com/);
  assert.match(url, /utm_campaign=buildgrid/);
});

test("Gumroad enable without payouts is an owner blocker, not a code loop", () => {
  assert.equal(
    gumroadOwnerBlocker(
      "You must connect at least one payment method before you can publish this product for sale.",
    ),
    true,
  );
  assert.equal(gumroadOwnerBlocker("published"), false);
});

test("sales email names the price and the Gumroad buy URL", () => {
  const mail = composeSalesEmail({
    name: "BuildGrid",
    description: "RFI log and punch list pack",
    url: buyUrlFor("buildgrid"),
    category: "software",
    priceUsd: 89,
    intentKeywords: ["construction rfi log template"],
  });
  assert.match(mail.subject, /\$89/);
  assert.match(mail.text, /Buy \(instant download\): https:\/\/willowdreams682\.gumroad\.com/);
  assert.doesNotMatch(mail.text, /I'm writing about/);
});

test("signup form is email+password register, not a login wall", () => {
  const form = extractSignupForm(
    `<form action="/users" method="post">
       <input name="user[email]" />
       <input name="user[password]" type="password" />
       <button>Create account</button>
     </form>`,
    "https://dir.example/signup",
  );
  assert.ok(form);
  assert.equal(form?.method, "post");
  const loginOnly = extractSignupForm(
    `<form action="/login" method="post"><input name="email"><input name="password"></form>`,
    "https://dir.example/login",
  );
  assert.equal(loginOnly, null);
});

test("a captcha wall has sibling doors and a listing-desk ask", () => {
  const sibs = siblingSubmitUrls("https://dir.example/submit");
  assert.ok(sibs.some((u) => u.endsWith("/contact")));
  assert.ok(sibs.some((u) => u.endsWith("/signup")));
  assert.equal(shouldAbandonResult("http_409"), true);
  const ask = composeListingAsk({
    name: "BuildGrid",
    url: "https://willowdreams682.gumroad.com/l/dlfcqr",
    email: "care@buildgrid.com",
    description: "RFI pack",
    category: "software",
    priceUsd: 89,
  });
  assert.match(ask.text, /Live product:/);
});

test("owner now-question is commercial, not cycle telemetry", () => {
  assert.equal(isCommercialNowQuestion("What are you doing right now?"), true);
  const text = formatOwnerNow({
    frontier: "buildgrid",
    bottleneck: "EXTERNAL_ACTION",
    lastCommercialAction: "directory_submit to https://x.example at 12:04 UTC",
    lastResult: "pending review",
    nextAction: "targeted outreach",
    humans: 0,
    leads: 0,
    checkouts: 0,
    revenue: 0,
    externalActions: 1,
    zeroExposureMode: true,
    firstRealCustomerMode: true,
    commercialExecutionRatio: 0.2,
    activeBusinesses: 47,
    retiredBusinesses: 3,
  });
  assert.match(text, /no external audience/);
  assert.doesNotMatch(text, /Titan cycle/);
  assert.match(text, /Humans: 0/);
});

test("quoted Resend from-address is still sendable", () => {
  const d = diagnoseEmailSendability({
    RESEND_API_KEY: "re_test_key_1234567890",
    OUTREACH_FROM_EMAIL: '"RevenueOS Titan <ops@tributeready.org>"',
  } as NodeJS.ProcessEnv);
  assert.equal(d.sendable, true);
  assert.equal(d.from.includes('"'), false);
  assert.match(d.from, /ops@tributeready\.org/);
});

test("first-customer lock concentrates on BuildGrid until a stranger pays", async () => {
  const { firstCustomerFrontier, isJunkPlacementHost } = await import(
    "../lib/commercial-execution-v4/first-customer.js"
  );
  assert.equal(firstCustomerFrontier(0)?.businessId, "buildgrid");
  assert.equal(firstCustomerFrontier(0)?.reason, "first_customer_lock");
  assert.equal(firstCustomerFrontier(1), null);
  assert.equal(isJunkPlacementHost("forums.comodo.com"), true);
  assert.equal(isJunkPlacementHost("saashub.com"), false);
});
