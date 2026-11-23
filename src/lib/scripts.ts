import { getDb, parseJson } from "./db";
import type { Analysis, ScriptRecord, ScriptStructure, ScriptSummary, Mode } from "./types";

export type ScriptRow = {
  id: string;
  license_id: string;
  account_id: string | null;
  parent_id: string | null;
  title: string;
  hook: string;
  body: string;
  structure: string | null;
  analysis: string | null;
  niche: string;
  duration: number;
  mode: string;
  provider: string;
  model: string;
  reference_title: string | null;
  reference_source: string | null;
  generation_ms: number | null;
  created_at: number;
  updated_at: number;
};

export function scriptRowToRecord(row: ScriptRow): ScriptRecord {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    hook: row.hook,
    body: row.body,
    structure: parseJson<ScriptStructure | null>(row.structure, null),
    analysis: parseJson<Analysis | null>(row.analysis, null),
    niche: row.niche,
    duration: row.duration,
    mode: row.mode as Mode,
    provider: row.provider,
    model: row.model,
    referenceTitle: row.reference_title,
    referenceSource: row.reference_source,
    generationMs: row.generation_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listScripts(accountId: string): ScriptSummary[] {
  const rows = getDb()
    .prepare(
      "SELECT id, title, hook, niche, duration, mode, provider, model, created_at, updated_at FROM scripts WHERE account_id = ? ORDER BY created_at DESC LIMIT 200",
    )
    .all(accountId) as Pick<
    ScriptRow,
    "id" | "title" | "hook" | "niche" | "duration" | "mode" | "provider" | "model" | "created_at" | "updated_at"
  >[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    hook: r.hook,
    niche: r.niche,
    duration: r.duration,
    mode: r.mode as Mode,
    provider: r.provider,
    model: r.model,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function getScript(accountId: string, scriptId: string): ScriptRecord | null {
  const row = getDb()
    .prepare("SELECT * FROM scripts WHERE id = ? AND account_id = ?")
    .get(scriptId, accountId) as ScriptRow | undefined;
  return row ? scriptRowToRecord(row) : null;
}

export function countScripts(accountId: string): number {
  const row = getDb().prepare("SELECT COUNT(*) as c FROM scripts WHERE account_id = ?").get(accountId) as {
    c: number;
  };
  return row.c;
}

export function insertScript(input: {
  accountId: string;
  licenseId: string;
  parentId?: string | null;
  title: string;
  hook: string;
  body: string;
  structure: ScriptStructure | null;
  analysis: Analysis | null;
  niche: string;
  duration: number;
  mode: Mode;
  provider: string;
  model: string;
  referenceTitle: string | null;
  referenceSource: string | null;
  generationMs: number | null;
}): ScriptRecord {
  const id = `scr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO scripts (id, license_id, account_id, parent_id, title, hook, body, structure, analysis, niche, duration, mode, provider, model, reference_title, reference_source, generation_ms, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.licenseId,
      input.accountId,
      input.parentId ?? null,
      input.title,
      input.hook,
      input.body,
      input.structure ? JSON.stringify(input.structure) : null,
      input.analysis ? JSON.stringify(input.analysis) : null,
      input.niche,
      input.duration,
      input.mode,
      input.provider,
      input.model,
      input.referenceTitle,
      input.referenceSource,
      input.generationMs,
      now,
      now,
    );
  return getScript(input.accountId, id)!;
}

export function updateScript(accountId: string, scriptId: string, patch: { title?: string; body?: string }) {
  const script = getScript(accountId, scriptId);
  if (!script) return null;
  const title = patch.title ?? script.title;
  const body = patch.body ?? script.body;
  const hook = body.split(/\n\s*\n/)[0]?.trim() || script.hook;
  getDb()
    .prepare("UPDATE scripts SET title = ?, body = ?, hook = ?, updated_at = ? WHERE id = ? AND account_id = ?")
    .run(title, body, hook, Date.now(), scriptId, accountId);
  return getScript(accountId, scriptId);
}

export function deleteScript(accountId: string, scriptId: string): boolean {
  const res = getDb()
    .prepare("DELETE FROM scripts WHERE id = ? AND account_id = ?")
    .run(scriptId, accountId);
  return Number(res.changes) > 0;
}

export function normalizeAnalysis(raw: unknown): Analysis {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
  const list = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((item): item is string => typeof item === "string") : [];
  const beats = Array.isArray(obj.narrative_structure)
    ? obj.narrative_structure
        .filter((b): b is Record<string, unknown> => typeof b === "object" && b !== null)
        .map((b) => ({ beat: str(b.beat), purpose: str(b.purpose) }))
        .filter((b) => b.beat)
    : [];

  return {
    opening_hook: str(obj.opening_hook),
    first_three_seconds: str(obj.first_three_seconds),
    storytelling_format: str(obj.storytelling_format),
    central_idea: str(obj.central_idea),
    narrative_structure: beats,
    dialogue_style: str(obj.dialogue_style),
    sentence_length: str(obj.sentence_length),
    pacing: str(obj.pacing),
    emotional_triggers: list(obj.emotional_triggers),
    curiosity_gaps: list(obj.curiosity_gaps),
    retention_techniques: list(obj.retention_techniques),
    transitions: str(obj.transitions),
    information_delivery: str(obj.information_delivery),
    ending_payoff: str(obj.ending_payoff),
    approx_script_length: str(obj.approx_script_length),
    why_it_works: list(obj.why_it_works),
    reusable_formula: str(obj.reusable_formula),
  };
}

export function normalizeStructure(raw: unknown): ScriptStructure | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const structure = {
    opening: str(obj.opening),
    setup: str(obj.setup),
    development: str(obj.development),
    retention: str(obj.retention),
    ending: str(obj.ending),
  };
  return Object.values(structure).some(Boolean) ? structure : null;
}
