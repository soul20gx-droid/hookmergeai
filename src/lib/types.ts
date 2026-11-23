export type Mode = "fast" | "balanced" | "premium";

export type NarrativeBeat = { beat: string; purpose: string };

export type Analysis = {
  opening_hook: string;
  first_three_seconds: string;
  storytelling_format: string;
  central_idea: string;
  narrative_structure: NarrativeBeat[];
  dialogue_style: string;
  sentence_length: string;
  pacing: string;
  emotional_triggers: string[];
  curiosity_gaps: string[];
  retention_techniques: string[];
  transitions: string;
  information_delivery: string;
  ending_payoff: string;
  approx_script_length: string;
  why_it_works: string[];
  reusable_formula: string;
};

export type ScriptStructure = {
  opening: string;
  setup: string;
  development: string;
  retention: string;
  ending: string;
};

export type ScriptRecord = {
  id: string;
  parentId: string | null;
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
  createdAt: number;
  updatedAt: number;
};

export type ScriptSummary = Pick<
  ScriptRecord,
  | "id"
  | "title"
  | "niche"
  | "duration"
  | "mode"
  | "provider"
  | "model"
  | "createdAt"
  | "updatedAt"
  | "hook"
>;

export type JobStage =
  | "queued"
  | "processing_reference"
  | "extracting_transcript"
  | "analyzing_storytelling"
  | "understanding_niche"
  | "generating_script"
  | "finalizing"
  | "done"
  | "failed"
  | "cancelled";

export type JobError = { code: string; message: string; hint?: string };

export type JobView = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  stage: JobStage;
  progress: number;
  error: JobError | null;
  scriptId: string | null;
  createdAt: number;
  updatedAt: number;
  niche: string;
  duration: number;
  mode: Mode;
};

export type LicenseStatus = "unused" | "active" | "expired" | "revoked";

export type LicenseView = {
  id: string;
  accountId: string;
  label: string | null;
  keyPrefix: string;
  keyLast4: string | null;
  status: LicenseStatus;
  generationLimit: number | null;
  generationsUsed: number;
  expiresAt: number | null;
  activatedAt: number | null;
  createdAt: number;
  lastSeenAt: number | null;
};

export type ProviderModelInfo = {
  id: string;
  label: string;
  tier: Mode;
  note?: string;
};

export type ProviderInfo = {
  id: string;
  label: string;
  tagline: string;
  kind: "openai" | "gemini";
  baseUrl: string;
  docsUrl: string;
  keyHint: string;
  freeTier: boolean;
  supportsTranscription: boolean;
  transcriptionNote?: string;
  allowCustomBaseUrl: boolean;
  allowCustomModel: boolean;
  models: ProviderModelInfo[];
};

export type AiConfigView = {
  provider: string;
  model: string;
  baseUrl: string;
  keyMode: "stored" | "none";
  hasKey: boolean;
  maskedKey: string | null;
  updatedAt: number | null;
};

export type AdminLicenseRow = LicenseView & {
  notes: string | null;
  scripts: number;
};

export type AdminStats = {
  licenses: { total: number; active: number; revoked: number; expired: number; expiringSoon: number };
  scripts: { total: number; today: number; week: number };
  jobs: { running: number; completed: number; failed: number; cancelled: number };
  providers: { provider: string; count: number }[];
  recentLicenses: AdminLicenseRow[];
  dailyGenerations: { day: string; count: number }[];
};
