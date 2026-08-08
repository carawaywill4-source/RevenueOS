import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Attribution,
  CapabilityGap,
  CycleReportRecord,
  DiscoveryDoor,
  Experiment,
  ExposureRecord,
  Lesson,
  PlannerRunRecord,
  Scorecard,
} from "../types";
import type { ExperimentStore } from "./store";

type FileLedger = {
  experiments: Experiment[];
  lessons: Lesson[];
  scorecards: Scorecard[];
  attributions: Attribution[];
  plannerRuns: PlannerRunRecord[];
  cycleReports: CycleReportRecord[];
  exposures: ExposureRecord[];
  discoveryDoors: DiscoveryDoor[];
  capabilityGaps: CapabilityGap[];
};

const EMPTY: FileLedger = {
  experiments: [],
  lessons: [],
  scorecards: [],
  attributions: [],
  plannerRuns: [],
  cycleReports: [],
  exposures: [],
  discoveryDoors: [],
  capabilityGaps: [],
};

/**
 * Durable enough for MVP and serverless-hostile environments where Supabase
 * DDL has not been applied yet. Prefer Supabase store in production when ready.
 */
export function createFileExperimentStore(
  rootDir: string,
): ExperimentStore {
  const filePath = path.join(rootDir, "ledger.json");

  async function load(): Promise<FileLedger> {
    try {
      const raw = await readFile(filePath, "utf8");
      return { ...EMPTY, ...JSON.parse(raw) } as FileLedger;
    } catch {
      return structuredClone(EMPTY);
    }
  }

  async function save(data: FileLedger) {
    await mkdir(rootDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  return {
    async listExperiments(siteId) {
      const data = await load();
      return data.experiments.filter((item) => item.siteId === siteId);
    },
    async getExperiment(id) {
      const data = await load();
      return data.experiments.find((item) => item.id === id) ?? null;
    },
    async saveExperiment(experiment) {
      const data = await load();
      const index = data.experiments.findIndex((item) => item.id === experiment.id);
      if (index >= 0) data.experiments[index] = experiment;
      else data.experiments.push(experiment);
      await save(data);
    },
    async listLessons({ siteId, industry }) {
      const data = await load();
      return data.lessons.filter((lesson) => {
        if (lesson.scope === "global") return true;
        if (lesson.scope === "industry" && industry && lesson.industry === industry) {
          return true;
        }
        if (lesson.scope === "site" && lesson.siteId === siteId) return true;
        return false;
      });
    },
    async listAllLessons() {
      const data = await load();
      return data.lessons;
    },
    async saveLesson(lesson) {
      const data = await load();
      const index = data.lessons.findIndex((item) => item.id === lesson.id);
      if (index >= 0) data.lessons[index] = lesson;
      else data.lessons.push(lesson);
      await save(data);
    },
    async saveScorecard(scorecard) {
      const data = await load();
      data.scorecards.unshift(scorecard);
      data.scorecards = data.scorecards.slice(0, 90);
      await save(data);
    },
    async listScorecards(siteId, limit = 14) {
      const data = await load();
      return data.scorecards
        .filter((item) => item.siteId === siteId)
        .slice(0, limit);
    },
    async saveAttribution(attribution) {
      const data = await load();
      const index = data.attributions.findIndex(
        (item) => item.id === attribution.id,
      );
      if (index >= 0) data.attributions[index] = attribution;
      else data.attributions.push(attribution);
      await save(data);
    },
    async listAttributions(siteId) {
      const data = await load();
      return data.attributions.filter((item) => item.siteId === siteId);
    },
    async listPlannerRuns(siteId, limit = 48) {
      const data = await load();
      return data.plannerRuns
        .filter((item) => item.siteId === siteId)
        .slice(0, limit);
    },
    async savePlannerRun(record) {
      const data = await load();
      data.plannerRuns.unshift(record);
      data.plannerRuns = data.plannerRuns.slice(0, 200);
      await save(data);
    },
    async listCycleReports(siteId, limit = 30) {
      const data = await load();
      return data.cycleReports
        .filter((item) => item.siteId === siteId)
        .slice(0, limit);
    },
    async saveCycleReport(record) {
      const data = await load();
      data.cycleReports.unshift(record);
      data.cycleReports = data.cycleReports.slice(0, 90);
      await save(data);
    },
    async listExposures(siteId, limit = 100) {
      const data = await load();
      return data.exposures
        .filter((item) => item.siteId === siteId)
        .slice(0, limit);
    },
    async saveExposure(record) {
      const data = await load();
      data.exposures.unshift(record);
      data.exposures = data.exposures.slice(0, 500);
      await save(data);
    },
    async listDiscoveryDoors(siteId) {
      const data = await load();
      return data.discoveryDoors.filter((item) => item.siteId === siteId);
    },
    async saveDiscoveryDoor(door) {
      const data = await load();
      const index = data.discoveryDoors.findIndex((item) => item.id === door.id);
      if (index >= 0) data.discoveryDoors[index] = door;
      else data.discoveryDoors.push(door);
      await save(data);
    },
    async listCapabilityGaps(siteId) {
      const data = await load();
      if (!siteId) return [...data.capabilityGaps];
      return data.capabilityGaps.filter((item) => item.siteId === siteId);
    },
    async saveCapabilityGap(gap) {
      const data = await load();
      const index = data.capabilityGaps.findIndex(
        (item) =>
          item.siteId === gap.siteId &&
          item.missingCapability === gap.missingCapability &&
          item.desiredAction === gap.desiredAction,
      );
      if (index >= 0) data.capabilityGaps[index] = gap;
      else data.capabilityGaps.push(gap);
      await save(data);
    },
  };
}
