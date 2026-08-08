import {
  createFileExperimentStore,
  type Attribution,
  type CapabilityGap,
  type CycleReportRecord,
  type DiscoveryDoor,
  type Experiment,
  type ExperimentStore,
  type ExposureRecord,
  type Lesson,
  type PlannerRunRecord,
  type Scorecard,
} from "@revenueos/core";
import { getSupabaseAdmin, supabaseConfigured } from "@/lib/supabase";

let availabilityCache: Promise<boolean> | null = null;

export function probeDurableLedger(): Promise<boolean> {
  if (availabilityCache) return availabilityCache;
  availabilityCache = (async () => {
    if (!supabaseConfigured()) return false;
    try {
      const { error } = await getSupabaseAdmin()
        .from("revenueos_experiments")
        .select("id")
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  })();
  return availabilityCache;
}

export function createDurableExperimentStore(fileDir: string): ExperimentStore {
  const fallback = createFileExperimentStore(fileDir);

  async function supabaseAvailable() {
    const available = await probeDurableLedger();
    if (!available && process.env.VERCEL) {
      throw new Error("RevenueOS durable ledger is unavailable in production");
    }
    return available;
  }

  const sb = () => getSupabaseAdmin();

  return {
    async listExperiments(siteId) {
      if (!(await supabaseAvailable())) return fallback.listExperiments(siteId);
      const { data, error } = await sb()
        .from("revenueos_experiments")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger experiments read failed: ${error.message}`);
        return fallback.listExperiments(siteId);
      }
      return (data ?? [])
        .map((row) => row.document as Experiment)
        .filter((exp) => exp && exp.hypothesis?.patternKey != null && !String(exp.id).startsWith("hourly-email:"));
    },

    async getExperiment(id) {
      if (!(await supabaseAvailable())) return fallback.getExperiment(id);
      const { data, error } = await sb()
        .from("revenueos_experiments")
        .select("document")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return null;
      return data.document as Experiment;
    },

    async saveExperiment(experiment: Experiment) {
      if (!(await supabaseAvailable())) return fallback.saveExperiment(experiment);
      const { error } = await sb()
        .from("revenueos_experiments")
        .upsert({
          id: experiment.id,
          site_id: experiment.siteId,
          status: experiment.status,
          pattern_key:
            experiment.hypothesis.patternKey ?? experiment.category ?? null,
          category: experiment.category ?? null,
          document: experiment,
          updated_at: experiment.updatedAt,
        });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger experiment save failed: ${error.message}`);
        return fallback.saveExperiment(experiment);
      }
    },

    async listLessons({ siteId, industry }) {
      if (!(await supabaseAvailable())) {
        return fallback.listLessons({ siteId, industry });
      }
      const { data, error } = await sb()
        .from("revenueos_lessons")
        .select("document,scope,site_id,industry");
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger lessons read failed: ${error.message}`);
        return fallback.listLessons({ siteId, industry });
      }
      return (data ?? [])
        .filter((row) => {
          if (row.scope === "global") return true;
          if (row.scope === "industry" && industry && row.industry === industry) {
            return true;
          }
          if (row.scope === "site" && row.site_id === siteId) return true;
          return false;
        })
        .map((row) => row.document as Lesson);
    },

    async listAllLessons() {
      if (!(await supabaseAvailable())) {
        return fallback.listAllLessons
          ? fallback.listAllLessons()
          : fallback.listLessons({ siteId: "" });
      }
      const { data, error } = await sb()
        .from("revenueos_lessons")
        .select("document");
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger lessons read-all failed: ${error.message}`);
        return fallback.listAllLessons ? fallback.listAllLessons() : [];
      }
      return (data ?? []).map((row) => row.document as Lesson);
    },

    async saveLesson(lesson: Lesson) {
      if (!(await supabaseAvailable())) return fallback.saveLesson(lesson);
      const { error } = await sb()
        .from("revenueos_lessons")
        .upsert({
          id: lesson.id,
          site_id: lesson.siteId ?? null,
          industry: lesson.industry ?? null,
          scope: lesson.scope,
          pattern_key: lesson.patternKey,
          document: lesson,
          updated_at: lesson.updatedAt,
        });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger lesson save failed: ${error.message}`);
        return fallback.saveLesson(lesson);
      }
    },

    async saveScorecard(scorecard: Scorecard) {
      if (!(await supabaseAvailable())) return fallback.saveScorecard(scorecard);
      const { error } = await sb()
        .from("revenueos_scorecards")
        .insert({ site_id: scorecard.siteId, document: scorecard });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger scorecard save failed: ${error.message}`);
        return fallback.saveScorecard(scorecard);
      }
    },

    async listScorecards(siteId, limit = 14) {
      if (!(await supabaseAvailable())) {
        return fallback.listScorecards(siteId, limit);
      }
      const { data, error } = await sb()
        .from("revenueos_scorecards")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger scorecard read failed: ${error.message}`);
        return fallback.listScorecards(siteId, limit);
      }
      return (data ?? []).map((row) => row.document as Scorecard);
    },

    async saveAttribution(attribution: Attribution) {
      if (!(await supabaseAvailable())) {
        return fallback.saveAttribution(attribution);
      }
      const { error } = await sb()
        .from("revenueos_attributions")
        .upsert({
          id: attribution.id,
          site_id: attribution.siteId,
          experiment_id: attribution.experimentId,
          verdict: attribution.verdict,
          document: attribution,
        });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger attribution save failed: ${error.message}`);
        return fallback.saveAttribution(attribution);
      }
    },

    async listAttributions(siteId) {
      if (!(await supabaseAvailable())) return fallback.listAttributions(siteId);
      const { data, error } = await sb()
        .from("revenueos_attributions")
        .select("document")
        .eq("site_id", siteId);
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger attribution read failed: ${error.message}`);
        return fallback.listAttributions(siteId);
      }
      return (data ?? []).map((row) => row.document as Attribution);
    },

    async listPlannerRuns(siteId, limit = 48) {
      if (!(await supabaseAvailable())) return fallback.listPlannerRuns!(siteId, limit);
      const { data, error } = await sb()
        .from("revenueos_planner_runs")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger planner read failed: ${error.message}`);
        return fallback.listPlannerRuns!(siteId, limit);
      }
      return (data ?? []).map((row) => row.document as PlannerRunRecord);
    },

    async savePlannerRun(record: PlannerRunRecord) {
      if (!(await supabaseAvailable())) return fallback.savePlannerRun!(record);
      const { error } = await sb().from("revenueos_planner_runs").upsert({
        id: record.id,
        site_id: record.siteId,
        source: record.source,
        policy_rejected: record.policyRejected,
        document: record,
      });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger planner save failed: ${error.message}`);
        return fallback.savePlannerRun!(record);
      }
    },

    async listCycleReports(siteId, limit = 30) {
      if (!(await supabaseAvailable())) return fallback.listCycleReports!(siteId, limit);
      const { data, error } = await sb()
        .from("revenueos_cycle_reports")
        .select("document")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger cycle report read failed: ${error.message}`);
        return fallback.listCycleReports!(siteId, limit);
      }
      return (data ?? []).map((row) => row.document as CycleReportRecord);
    },

    async saveCycleReport(record: CycleReportRecord) {
      if (!(await supabaseAvailable())) return fallback.saveCycleReport!(record);
      const { error } = await sb().from("revenueos_cycle_reports").upsert({
        id: record.id,
        site_id: record.siteId,
        observed_at: record.observedAt,
        planner_source: record.plannerSource ?? null,
        document: record,
      });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger cycle report save failed: ${error.message}`);
        return fallback.saveCycleReport!(record);
      }
    },

    async listExposures(siteId, limit = 100) {
      if (!(await supabaseAvailable())) return fallback.listExposures!(siteId, limit);
      const { data, error } = await sb()
        .from("revenueos_exposures")
        .select("document")
        .eq("site_id", siteId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger exposure read failed: ${error.message}`);
        return fallback.listExposures!(siteId, limit);
      }
      return (data ?? []).map((row) => row.document as ExposureRecord);
    },

    async saveExposure(record: ExposureRecord) {
      if (!(await supabaseAvailable())) return fallback.saveExposure!(record);
      const { error } = await sb().from("revenueos_exposures").upsert({
        id: record.id,
        site_id: record.siteId,
        experiment_id: record.experimentId ?? null,
        action_type: record.actionType,
        exposure_key: record.exposureKey,
        version: record.version,
        started_at: record.startedAt,
        ended_at: record.endedAt ?? null,
        document: record,
      });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger exposure save failed: ${error.message}`);
        return fallback.saveExposure!(record);
      }
    },

    async listDiscoveryDoors(siteId) {
      if (!(await supabaseAvailable())) return fallback.listDiscoveryDoors!(siteId);
      const { data, error } = await sb()
        .from("revenueos_discovery_doors")
        .select("document")
        .eq("site_id", siteId)
        .order("published_at", { ascending: false });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger discovery doors read failed: ${error.message}`);
        return fallback.listDiscoveryDoors!(siteId);
      }
      return (data ?? []).map((row) => row.document as DiscoveryDoor);
    },

    async saveDiscoveryDoor(door: DiscoveryDoor) {
      if (!(await supabaseAvailable())) return fallback.saveDiscoveryDoor!(door);
      const { error } = await sb().from("revenueos_discovery_doors").upsert({
        id: door.id,
        site_id: door.siteId,
        cluster_key: door.clusterKey,
        status: door.status,
        published_at: door.publishedAt,
        document: door,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger discovery door save failed: ${error.message}`);
        return fallback.saveDiscoveryDoor!(door);
      }
    },

    async listCapabilityGaps(siteId) {
      if (!(await supabaseAvailable())) return fallback.listCapabilityGaps!(siteId);
      let query = sb().from("revenueos_capability_gaps").select("document");
      if (siteId) query = query.eq("site_id", siteId);
      const { data, error } = await query.order("last_seen_at", { ascending: false });
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger capability gaps read failed: ${error.message}`);
        return fallback.listCapabilityGaps!(siteId);
      }
      return (data ?? []).map((row) => row.document as CapabilityGap);
    },

    async saveCapabilityGap(gap: CapabilityGap) {
      if (!(await supabaseAvailable())) return fallback.saveCapabilityGap!(gap);
      const { error } = await sb().from("revenueos_capability_gaps").upsert(
        {
          id: gap.id,
          site_id: gap.siteId,
          missing_capability: gap.missingCapability,
          desired_action: gap.desiredAction,
          importance: gap.importance,
          times_blocked: gap.timesBlocked,
          document: gap,
          first_seen_at: gap.firstSeenAt,
          last_seen_at: gap.lastSeenAt,
        },
        { onConflict: "site_id,missing_capability,desired_action" },
      );
      if (error) {
        if (process.env.VERCEL) throw new Error(`Ledger capability gap save failed: ${error.message}`);
        return fallback.saveCapabilityGap!(gap);
      }
    },
  };
}
