/**
 * Durable self-model of RevenueOS architecture — updated as code/config changes.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import { AE_ARCH_KEY, type ArchitectureComponent } from "./types.js";

const CORE_COMPONENTS: ArchitectureComponent[] = [
  {
    id: "titan.commercial_executive",
    name: "Titan Commercial Executive",
    path: "services/operator/src/lib/titan-commercial-executive",
    role: "Acquisition decisions, new-audience bets, CAE, zero-traffic war room",
    calls: ["acquisitionos", "capability-reality", "resend", "producthunt"],
    stateStores: ["titan_*", "aq_distribution_receipts", "ros_config_meta"],
    commercialSignals: ["receipts", "missions", "lessons", "gaps"],
  },
  {
    id: "acquisitionos",
    name: "AcquisitionOS",
    path: "services/operator/src/lib/acquisitionos",
    role: "Channel graph, executors, funnel, owner queue",
    calls: ["hosting-plane", "indexnow"],
    stateStores: ["aq_channel_surfaces", "aq_distribution_receipts"],
    commercialSignals: ["distribution", "exposure"],
  },
  {
    id: "capability_reality",
    name: "Capability Reality",
    path: "services/operator/src/lib/capability-reality",
    role: "Feature≠capability registry, identity, commercial comms, vault",
    calls: ["resend", "producthunt"],
    stateStores: ["ros_capability_registry", "ros_distribution_capabilities"],
    commercialSignals: ["capability_states"],
  },
  {
    id: "autonomous_engineering",
    name: "Autonomous Engineering Brain",
    path: "services/operator/src/lib/autonomous-engineering",
    role: "Observe→diagnose→patch→test→deploy→measure→rollback",
    calls: ["systemd", "tsx", "pg"],
    stateStores: ["ros_eng_limitations", "ros_eng_receipts", "ros_config_meta"],
    commercialSignals: ["limitation_backlog", "engineering_war_room"],
  },
  {
    id: "core_evolution",
    name: "Core Evolution (legacy narrow)",
    path: "services/operator/src/lib/core-evolution-executor.ts",
    role: "Stub telemetry + meta-contradiction detection",
    calls: ["apex.governAction"],
    stateStores: ["core_evolution_receipts"],
    commercialSignals: ["self_evolution_contradictions"],
  },
  {
    id: "code_evolution",
    name: "Site Code Evolution / Forge limb",
    path: "services/operator/src/lib/code-evolution-executor.ts",
    role: "Storefront mutations under CAE gates",
    calls: ["hosting-plane", "vercel-deploy-adapter"],
    stateStores: ["code_evolution_receipts"],
    commercialSignals: ["site_readiness"],
  },
  {
    id: "engineering_repair",
    name: "Engineering Repair",
    path: "services/operator/src/lib/engineering-repair.ts",
    role: "Failure fingerprint playbooks, canary, operator restart",
    calls: ["systemd"],
    stateStores: ["engineering_repair_*"],
    commercialSignals: ["repair_incidents"],
  },
  {
    id: "telemetry",
    name: "Traffic Classification",
    path: "services/operator/src/lib/traffic-classify.ts",
    role: "BOT/INTERNAL/UNKNOWN/LIKELY_HUMAN/QUALIFIED",
    calls: ["caddy", "beacons"],
    stateStores: ["ros_traffic_events"],
    commercialSignals: ["humans", "referrals"],
  },
  {
    id: "hosting_plane",
    name: "Hosting Plane",
    path: "services/hosting-plane",
    role: "Native site deploy/rollback on Azure",
    calls: ["caddy"],
    stateStores: ["hosting artifacts"],
    commercialSignals: ["site_health"],
  },
  {
    id: "apex",
    name: "Apex Governance",
    path: "packages/revenueos (governAction)",
    role: "Mutation authorization — not commercial bottleneck emitter",
    calls: [],
    stateStores: [],
    commercialSignals: ["admission_deny"],
  },
];

function listTsModules(dir: string, max = 40): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    if (out.length >= max) return;
    let entries: string[] = [];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= max) break;
      if (e === "node_modules" || e.startsWith(".")) continue;
      const p = path.join(d, e);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(p);
      else if (e.endsWith(".ts") && !e.endsWith(".test.ts")) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

export async function refreshArchitectureModel(
  pool: pg.Pool,
  appRoot: string,
): Promise<{ components: ArchitectureComponent[]; moduleCount: number }> {
  const modules = listTsModules(
    path.join(appRoot, "services/operator/src/lib"),
    80,
  );
  const doc = {
    version: "architecture-model-v1",
    updatedAt: new Date().toISOString(),
    runtime: {
      operator: "systemd:revenueos-operator",
      appRoot: "/opt/revenueos/app",
      env: "/etc/revenueos/revenueos.env",
      postgres: "docker:revenueos-postgres",
      hosting: "revenueos-hosting-plane",
    },
    decisionPoints: [
      "titan-commercial-executive/executive-cycle.ts",
      "acquisitionos/lane.ts",
      "zero-traffic-war-room.ts",
      "autonomous-engineering/loop.ts",
    ],
    executionPoints: [
      "new-audience.ts",
      "acquisitionos/executors.ts",
      "producthunt-adapter.ts",
      "acquisition-asset-executor.ts",
    ],
    verificationPoints: [
      "exposure-verify.ts",
      "traffic-classify.ts",
      "capability-reality/registry.ts",
    ],
    components: CORE_COMPONENTS,
    scannedModules: modules.map((m) => path.relative(appRoot, m)).slice(0, 60),
    moduleCount: modules.length,
    doctrine: {
      featureTheater: true,
      portfolioFrozenUnderCae: true,
      northStar: "customer_acquisition",
    },
  };

  await pool.query(
    `insert into ros_config_meta (key, value, updated_at, provenance)
     values ($1,$2::jsonb,now(),'AUTONOMOUS_ENGINEERING')
     on conflict (key) do update set
       value=excluded.value, updated_at=now(), provenance='AUTONOMOUS_ENGINEERING'`,
    [AE_ARCH_KEY, JSON.stringify(doc)],
  );

  return { components: CORE_COMPONENTS, moduleCount: modules.length };
}
