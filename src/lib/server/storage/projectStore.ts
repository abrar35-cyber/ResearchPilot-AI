import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ProjectSchema,
  ProjectSummarySchema,
  type Project,
  type ProjectSummary,
} from "@/lib/schemas/research";
import { isValidVisitorId } from "@/lib/server/adminAuth";
import { AppError, NotFoundError } from "@/lib/server/errors";
import { openStore, withStorageErrors, type BlobStore } from "@/lib/server/storage/blobs";

const STORE_NAME = "rp-projects";
const MAX_INDEX_ENTRIES = 100;
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function newProjectId(): string {
  return randomUUID();
}

export function isValidProjectId(id: string): boolean {
  return ID_PATTERN.test(id);
}

function indexKey(ownerId: string): string {
  return `index/owner/${ownerId}`;
}

function toSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    question: project.question,
    status: project.status,
    reportLanguage: project.reportLanguage,
    createdAt: project.createdAt,
    sourceCount: project.sources.length,
  };
}

async function readIndex(store: BlobStore, ownerId: string): Promise<ProjectSummary[]> {
  const data: unknown = await store.get(indexKey(ownerId), { type: "json" });
  const parsed = z.array(ProjectSummarySchema).safeParse(data);
  return parsed.success ? parsed.data : [];
}

async function updateIndex(store: BlobStore, ownerId: string, summary: ProjectSummary): Promise<void> {
  const current = await readIndex(store, ownerId);
  const next = [summary, ...current.filter((item) => item.id !== summary.id)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_INDEX_ENTRIES);
  await store.setJSON(indexKey(ownerId), next);
}

/** Validates and saves a project (used after every agent step to keep partial progress). */
export async function saveProject(project: Project): Promise<Project> {
  const checked = ProjectSchema.safeParse({ ...project, updatedAt: new Date().toISOString() });
  if (!checked.success) {
    throw new AppError("invalid_project", "The project data failed validation and was not saved.", 500);
  }
  const toSave = checked.data;

  return withStorageErrors(async () => {
    const store = openStore(STORE_NAME);
    await store.setJSON(`projects/${toSave.id}`, toSave);
    if (isValidVisitorId(toSave.ownerId)) {
      await updateIndex(store, toSave.ownerId, toSummary(toSave));
    }
    return toSave;
  });
}

export async function getProject(id: string): Promise<Project> {
  if (!isValidProjectId(id)) throw new NotFoundError("Project");

  return withStorageErrors(async () => {
    const store = openStore(STORE_NAME);
    const data: unknown = await store.get(`projects/${id}`, { type: "json" });
    if (data === null || data === undefined) throw new NotFoundError("Project");

    const parsed = ProjectSchema.safeParse(data);
    if (!parsed.success) {
      throw new AppError("corrupt_project", "The saved project data is damaged.", 500);
    }
    return parsed.data;
  });
}

/** Only the visitor's own projects are listed. */
export async function listProjectSummaries(ownerId: string): Promise<ProjectSummary[]> {
  if (!isValidVisitorId(ownerId)) return [];
  return withStorageErrors(async () => readIndex(openStore(STORE_NAME), ownerId));
}
