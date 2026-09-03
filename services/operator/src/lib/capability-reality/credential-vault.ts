/**
 * Secure credential references for RevenueOS platform accounts.
 * Secrets stay in env / encrypted vault rows — never logged.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type pg from "pg";

function vaultKey(): Buffer {
  const raw =
    process.env.REVENUEOS_VAULT_KEY ||
    process.env.REVENUEOS_ATTRIBUTION_SECRET ||
    process.env.RESEND_API_KEY ||
    "revenueos-dev-vault-not-for-prod";
  return createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", vaultKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(blob: string): string | null {
  try {
    const [ver, ivB64, tagB64, encB64] = blob.split(":");
    if (ver !== "v1" || !ivB64 || !tagB64 || !encB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      vaultKey(),
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const out = Buffer.concat([
      decipher.update(Buffer.from(encB64, "base64")),
      decipher.final(),
    ]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

function hint(value: string): string {
  if (!value) return "empty";
  if (value.includes("@")) {
    const [, domain] = value.split("@");
    return `***@${domain ?? "?"}`;
  }
  return `set:len=${value.length}`;
}

export async function upsertVaultSecret(
  pool: pg.Pool,
  input: {
    credentialRef: string;
    platform: string;
    kind: string;
    secret: string;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  await pool.query(
    `insert into ros_credential_vault
       (credential_ref, platform, kind, secret_enc, secret_hint, meta, updated_at)
     values ($1,$2,$3,$4,$5,$6::jsonb,now())
     on conflict (credential_ref) do update set
       secret_enc=excluded.secret_enc,
       secret_hint=excluded.secret_hint,
       meta=excluded.meta,
       updated_at=now()`,
    [
      input.credentialRef,
      input.platform,
      input.kind,
      encryptSecret(input.secret),
      hint(input.secret),
      JSON.stringify(input.meta ?? {}),
    ],
  );
}

export async function readVaultSecret(
  pool: pg.Pool,
  credentialRef: string,
): Promise<string | null> {
  const res = await pool.query(
    `select secret_enc from ros_credential_vault where credential_ref=$1 limit 1`,
    [credentialRef],
  );
  const enc = res.rows[0]?.secret_enc as string | undefined;
  if (!enc) return null;
  return decryptSecret(enc);
}

/** Mirror env-backed platform credentials into vault + account registry (no plaintext logs). */
export async function syncEnvCredentialsIntoVault(pool: pg.Pool): Promise<{
  synced: string[];
  missing: string[];
}> {
  const map: Array<{
    ref: string;
    platform: string;
    kind: string;
    env: string;
    usernameEnv?: string;
  }> = [
    {
      ref: "resend_api_key",
      platform: "resend",
      kind: "api_key",
      env: "RESEND_API_KEY",
    },
    {
      ref: "producthunt_developer_token",
      platform: "producthunt",
      kind: "developer_token",
      env: "PRODUCTHUNT_DEVELOPER_TOKEN",
    },
    {
      ref: "gumroad_access_token",
      platform: "gumroad",
      kind: "access_token",
      env: "GUMROAD_ACCESS_TOKEN",
    },
    {
      ref: "youtube_api_key",
      platform: "youtube",
      kind: "api_key",
      env: "YOUTUBE_API_KEY",
    },
  ];
  const synced: string[] = [];
  const missing: string[] = [];
  for (const m of map) {
    const v = process.env[m.env]?.trim();
    if (!v) {
      missing.push(m.env);
      continue;
    }
    await upsertVaultSecret(pool, {
      credentialRef: m.ref,
      platform: m.platform,
      kind: m.kind,
      secret: v,
    });
    await pool.query(
      `insert into ros_platform_accounts
         (account_id, platform, status, rule_class, credential_ref, permissions, meta, updated_at)
       values ($1,$2,'CREDENTIAL_PRESENT','PERMITTED_WITH_LIMITS',$3,$4::jsonb,$5::jsonb,now())
       on conflict (account_id) do update set
         status='CREDENTIAL_PRESENT',
         credential_ref=excluded.credential_ref,
         updated_at=now()`,
      [
        `${m.platform}:env`,
        m.platform,
        m.ref,
        JSON.stringify(["api"]),
        JSON.stringify({ source: "env_sync", env: m.env }),
      ],
    );
    synced.push(m.platform);
  }

  // Business identity
  const from =
    process.env.OUTREACH_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "";
  const domain =
    process.env.OUTREACH_FROM_DOMAIN ||
    process.env.RESEND_FROM_DOMAIN ||
    "tributeready.org";
  const reply =
    process.env.OUTREACH_REPLY_EMAIL || "ops@tributeready.org";
  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ('revenueos_business_identity', $1::jsonb, now(), 'CAPABILITY_REALITY')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='CAPABILITY_REALITY'`,
    [
      JSON.stringify({
        version: "business-identity-v1",
        legalName: "RevenueOS / TributeReady",
        operationalEmail: reply,
        outboundFrom: from || `ops@${domain}`,
        domain,
        inboundProvider: "resend",
        inboundReceiving: "disabled_on_domain_as_of_audit",
        accountRegistrationIdentity: `ops@${domain}`,
        vault: "ros_credential_vault",
        updatedAt: new Date().toISOString(),
      }),
    ],
  );

  return { synced, missing };
}
