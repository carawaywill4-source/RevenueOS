/**
 * Capability-gap reasoning + acquisition candidates.
 * Strategy failure vs capability failure; spawn AE_CAPABILITY_* projects.
 */

import type pg from "pg";
import {
  CAPABILITY_GAPS_KEY,
  type CapabilityGap,
  type CapabilityGapStatus,
} from "./types.js";

function ev(g: CapabilityGap): number {
  return (
    g.commercialValue * 1.4 +
    g.reusableValue * 0.8 -
    g.cost * 0.6 -
    g.risk * 0.7 -
    (g.ownerRequirement ? 0.5 : 0)
  );
}

export async function discoverCapabilityGaps(
  pool: pg.Pool,
): Promise<CapabilityGap[]> {
  const at = new Date().toISOString();
  const email = await pool.query(
    `select
       count(*) filter (where status in ('SENT','ACCEPTED','SUBMISSION_ACKNOWLEDGED') and created_at > now() - interval '48 hours')::int as sent,
       count(*) filter (where status='FAILED' and created_at > now() - interval '48 hours')::int as fail
     from aq_distribution_receipts
     where external_action='resource_email_pitch'`,
  );
  const ph = await pool.query(
    `select
       count(*) filter (where status='PUBLISHED' and created_at > now() - interval '7 days')::int as pub,
       count(*) filter (where coalesce(request_result->>'detail','') ilike '%CommentCreateInput%' and created_at > now() - interval '7 days')::int as write_blocked,
       count(*) filter (where status='FAILED' and created_at > now() - interval '7 days')::int as fail
     from aq_distribution_receipts
     where external_action='producthunt_helpful_comment'`,
  );
  const humans = await pool.query(
    `select count(*)::int as n from ros_traffic_events
     where created_at > now() - interval '48 hours'
       and class in ('LIKELY_HUMAN','QUALIFIED')
       and coalesce(referer,'') <> ''
       and referer not ilike '%sslip.io%'`,
  );
  const resendReady = Boolean(
    process.env.RESEND_API_KEY &&
      (process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL),
  );
  const phToken = Boolean(process.env.PRODUCTHUNT_DEVELOPER_TOKEN);
  const inboundEnv = Boolean(
    process.env.RESEND_INBOUND_WEBHOOK_SECRET ||
      process.env.INBOUND_MAIL_ENABLED === "1",
  );

  const gaps: CapabilityGap[] = [];

  // Contact discovery — transport works, novel attribution / discovery weak
  gaps.push({
    id: "gap_contact_discovery",
    objective: "Reliable high-quality business contactability for frontier outreach",
    requiredCapability: "CONTACT_DISCOVERY",
    whyNeeded:
      "Email transport exists but novel Design A exhausted HTML regex discovery → owner_action_prepared",
    commercialValue: resendReady ? 0.92 : 0.2,
    existingPartial: resendReady
      ? `resend_ready; sent_48h=${email.rows[0]?.sent ?? 0}`
      : null,
    missingLink: "structured_legitimate_business_contact_discovery",
    externalSystem: "public_business_web",
    allowedExecutionMethods: [
      "official_contact_pages",
      "mailto_links",
      "json_ld_Organization_email",
      "press_contact_pages",
      "role_based_public_addresses",
    ],
    authRequirements: [],
    accountRequirements: [],
    legalPlatformRequirements: [
      "no_personal_data_harvest_beyond_public_business_contacts",
      "no_spam",
      "commercial_quality_gate_required",
    ],
    possibleImplementations: [
      "structured_contact_extractor_module",
      "contact_page_probe_graph",
      "wire_into_verified_email_pipeline",
    ],
    reusableValue: 0.9,
    cost: 0.35,
    risk: 0.25,
    ownerRequirement: null,
    status: resendReady ? "BUILDABLE" : "ACCOUNT_REQUIRED_AUTONOMOUS",
    expectedValue: 0,
    evidence: [
      `email_sent_48h=${email.rows[0]?.sent ?? 0}`,
      `humans_48h=${humans.rows[0]?.n ?? 0}`,
      "design_A_blocker=contact_discovery_exhausted",
    ],
    updatedAt: at,
  });

  // Product Hunt write — capability failure / platform rule
  const phWriteBlocked = Number(ph.rows[0]?.write_blocked ?? 0) > 0;
  gaps.push({
    id: "gap_producthunt_write",
    objective: "Authenticated Product Hunt publication/comment that actually writes",
    requiredCapability: "PRODUCTHUNT_WRITE",
    whyNeeded:
      "Matching/auth works; public GraphQL lacks CommentCreateInput — not merely 'token exists'",
    commercialValue: phToken ? 0.7 : 0.15,
    existingPartial: phToken ? "developer_token_read_works" : null,
    missingLink: "write_scope_or_alternate_permitted_publish_path",
    externalSystem: "producthunt",
    allowedExecutionMethods: [
      "official_api_write_if_approved",
      "permitted_authenticated_ui_if_rules_allow",
    ],
    authRequirements: ["PRODUCTHUNT_DEVELOPER_TOKEN", "possibly_write_scope"],
    accountRequirements: ["producthunt_account"],
    legalPlatformRequirements: [
      "respect_api_scopes",
      "no_captcha_bypass",
      "no_anti_bot_evasion",
    ],
    possibleImplementations: [
      "request_write_scope_owner",
      "alternate_platform_with_write_api",
      "browser_publisher_if_rules_permit",
    ],
    reusableValue: 0.55,
    cost: 0.5,
    risk: 0.55,
    ownerRequirement: phWriteBlocked
      ? "Product Hunt write API approval / alternate permitted path"
      : null,
    status: (phWriteBlocked
      ? "OWNER_AUTH_REQUIRED"
      : phToken
        ? "RESEARCHING"
        : "DISCOVERED") as CapabilityGapStatus,
    expectedValue: 0,
    evidence: [
      `ph_write_blocked_7d=${ph.rows[0]?.write_blocked ?? 0}`,
      `ph_published_7d=${ph.rows[0]?.pub ?? 0}`,
      "API_DOES_NOT_SUPPORT_ACTION≠PLATFORM_IMPOSSIBLE_but_write_not_public",
    ],
    updatedAt: at,
  });

  // Inbound inbox
  gaps.push({
    id: "gap_inbound_inbox",
    objective: "Receive verification + commercial replies for business identity",
    requiredCapability: "INBOUND_MAILBOX",
    whyNeeded: "Outbound partial; inbound disabled → half-blind commercially",
    commercialValue: 0.75,
    existingPartial: "ros_inbound_messages schema + classifier exist",
    missingLink: inboundEnv
      ? "webhook_wiring_incomplete"
      : "resend_receiving_or_mx_not_enabled",
    externalSystem: "resend_or_mx",
    allowedExecutionMethods: [
      "resend_receiving",
      "mx_to_provider",
      "webhook_ingest",
    ],
    authRequirements: ["RESEND_API_KEY"],
    accountRequirements: ["domain_dns"],
    legalPlatformRequirements: ["domain_control"],
    possibleImplementations: [
      "enable_resend_receiving_if_api_allows",
      "owner_mx_step_if_required",
      "webhook_classifier_path",
    ],
    reusableValue: 0.95,
    cost: 0.4,
    risk: 0.3,
    ownerRequirement: inboundEnv
      ? null
      : "Possibly MX/DNS if provider cannot enable receiving autonomously",
    status: inboundEnv ? "INTEGRATABLE" : "RESEARCHING",
    expectedValue: 0,
    evidence: [`inbound_env=${inboundEnv}`, "receiving_historically_disabled"],
    updatedAt: at,
  });

  // Generic authenticated external action spine
  gaps.push({
    id: "gap_external_action_spine",
    objective: "Reusable DISCOVER→RULE_CHECK→AUTH→EXECUTE→VERIFY→MEASURE spine",
    requiredCapability: "EXTERNAL_ACTION_SPINE",
    whyNeeded:
      "Novel designs oscillate on platform-specific hacks; need reusable external execution contract",
    commercialValue: 0.8,
    existingPartial: "producthunt + email adapters exist separately",
    missingLink: "unified_execution_contract_with_verify",
    externalSystem: "multi",
    allowedExecutionMethods: ["official_api", "feed", "webhook", "permitted_ui"],
    authRequirements: ["per_platform"],
    accountRequirements: ["per_platform"],
    legalPlatformRequirements: ["per_platform_rule_check_mandatory"],
    possibleImplementations: [
      "external_action_spine_module",
      "adapters_register_into_spine",
      "titan_calls_spine",
    ],
    reusableValue: 0.95,
    cost: 0.45,
    risk: 0.3,
    ownerRequirement: null,
    status: "BUILDABLE",
    expectedValue: 0,
    evidence: ["design_oscillation_A_B_A", "proof_stuck_at_3"],
    updatedAt: at,
  });

  // Account autonomy (framework → prove on one platform)
  gaps.push({
    id: "gap_account_autonomy",
    objective: "Legitimate business account lifecycle for one high-value platform",
    requiredCapability: "ACCOUNT_LIFECYCLE",
    whyNeeded: "Framework-only; many strategies blocked without reusable identity",
    commercialValue: 0.65,
    existingPartial: "account-lifecycle scaffold marker may exist",
    missingLink: "end_to_end_create_verify_store_login_action",
    externalSystem: "tbd_by_research",
    allowedExecutionMethods: [
      "official_registration_if_automation_allowed",
      "email_verify_via_inbox",
    ],
    authRequirements: ["business_email"],
    accountRequirements: ["no_kyc_platform"],
    legalPlatformRequirements: [
      "no_fake_human_identity",
      "no_captcha_bypass",
      "automation_allowed",
    ],
    possibleImplementations: [
      "platform_discovery_then_register",
      "inbox_verify",
      "vault_store",
    ],
    reusableValue: 0.85,
    cost: 0.7,
    risk: 0.55,
    ownerRequirement: null,
    status: "RESEARCHING",
    expectedValue: 0,
    evidence: ["account_autonomy=framework_only"],
    updatedAt: at,
  });

  for (const g of gaps) {
    // Prefer buildable gaps that raise external executions soon
    if (g.status === "OWNER_AUTH_REQUIRED" || g.status === "PROHIBITED") {
      g.commercialValue *= 0.35;
    }
    if (g.id === "gap_contact_discovery" && Number(email.rows[0]?.sent ?? 0) > 0) {
      g.commercialValue = Math.min(1, g.commercialValue + 0.05);
      g.evidence.push("EVIDENCE: transport already delivered third-party mail");
    }
    g.expectedValue = ev(g);
  }
  gaps.sort((a, b) => b.expectedValue - a.expectedValue);
  return gaps;
}

export function selectCapabilityGap(gaps: CapabilityGap[]): {
  selected: CapabilityGap;
  whyWon: string;
  whyOthersLost: string[];
} {
  // Prefer BUILDABLE/INTEGRATABLE over OWNER_AUTH
  const ranked = [...gaps].sort((a, b) => {
    const rank = (s: CapabilityGapStatus) =>
      s === "BUILDABLE" || s === "INTEGRATABLE"
        ? 3
        : s === "RESEARCHING"
          ? 2
          : s === "DISCOVERED"
            ? 1
            : 0;
    return rank(b.status) * 10 + b.expectedValue - (rank(a.status) * 10 + a.expectedValue);
  });
  const selected = ranked[0]!;
  return {
    selected,
    whyWon: `Highest expected-value buildable capability ${selected.id} ev=${selected.expectedValue.toFixed(2)} status=${selected.status} — chosen to raise proof beyond Level 3 (not code ease)`,
    whyOthersLost: ranked.slice(1).map((g) => {
      const reasons: string[] = [];
      if (g.status === "OWNER_AUTH_REQUIRED") reasons.push("owner/platform write approval");
      if (g.expectedValue + 0.2 < selected.expectedValue) reasons.push("lower EV");
      if (g.risk > selected.risk + 0.2) reasons.push("higher risk");
      return `${g.id} lost (${g.expectedValue.toFixed(2)}/${g.status}): ${reasons.join("; ") || "lower composite"}`;
    }),
  };
}

export async function persistCapabilityGaps(
  pool: pg.Pool,
  gaps: CapabilityGap[],
  selectedId: string,
): Promise<void> {
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING_V3')
     on conflict (key) do update set value=excluded.value, updated_at=now(),
       provenance='AUTONOMOUS_ENGINEERING_V3'`,
    [
      CAPABILITY_GAPS_KEY,
      JSON.stringify({
        at: new Date().toISOString(),
        selectedId,
        gaps,
        doctrine:
          "API_DOES_NOT_SUPPORT_ACTION ≠ PLATFORM_IMPOSSIBLE; credential ≠ capability",
      }),
    ],
  );
}
