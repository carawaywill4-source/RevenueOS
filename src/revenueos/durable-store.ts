import {
  createFileExperimentStore,
  type Attribution,
  type Experiment,
  type ExperimentStore,
  type Lesson,
  type Scorecard,
} from "@tributeready/revenueos";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Durable RevenueOS memory. Uses Supabase document tables (see
 * packages/revenueos/schema.sql) so calibration, bandit posteriors, and
 * forecasts COMPOUND across serverless invocations. If the tables are not yet
 * applied (owner has not run the DDL), it transparently falls back to the
 * ephemeral file ledger — no behavior change until the DDL lands.
 *
 * This is app-side infrastructure: the portable brain never imports Supabase.
 */

let availabilityCache: Promise<boolean> | null = null;

/** True once packages/revenueos/schema.sql has been applied in Supabase. */
export function probeDurableLedger(): Promise<boolean> {
  if (availabilityCache) return availabilityCache;
  availabilityCache = (async () => {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return false;
    }
    try {
      const sb = getSupabaseAdmin();
      const { error } = await sb
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

  function supabaseAvailable(): Promise<boolean> {
    return probeDurableLedger();
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
      if (error) return fallback.listExperiments(siteId);
      return (data ?? []).map((row) => row.document as Experiment);
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
      if (error) return fallback.saveExperiment(experiment);
    },

    async listLessons({ siteId, industry }) {
      if (!(await supabaseAvailable())) {
        return fallback.listLessons({ siteId, industry });
      }
      const { data, error } = await sb()
        .from("revenueos_lessons")
        .select("document,scope,site_id,industry");
      if (error) return fallback.listLessons({ siteId, industry });
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
      if (error) return fallback.saveLesson(lesson);
    },

    async saveScorecard(scorecard: Scorecard) {
      if (!(await supabaseAvailable())) return fallback.saveScorecard(scorecard);
      const { error } = await sb()
        .from("revenueos_scorecards")
        .insert({ site_id: scorecard.siteId, document: scorecard });
      if (error) return fallback.saveScorecard(scorecard);
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
      if (error) return fallback.listScorecards(siteId, limit);
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
      if (error) return fallback.saveAttribution(attribution);
    },

    async listAttributions(siteId) {
      if (!(await supabaseAvailable())) return fallback.listAttributions(siteId);
      const { data, error } = await sb()
        .from("revenueos_attributions")
        .select("document")
        .eq("site_id", siteId);
      if (error) return fallback.listAttributions(siteId);
      return (data ?? []).map((row) => row.document as Attribution);
    },
  };
}
