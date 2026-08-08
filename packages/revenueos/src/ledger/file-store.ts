import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Attribution, Experiment, Lesson, Scorecard } from "../types";
import type { ExperimentStore } from "./store";

type FileLedger = {
  experiments: Experiment[];
  lessons: Lesson[];
  scorecards: Scorecard[];
  attributions: Attribution[];
};

const EMPTY: FileLedger = {
  experiments: [],
  lessons: [],
  scorecards: [],
  attributions: [],
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
  };
}
