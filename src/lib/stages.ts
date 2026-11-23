import type { JobStage } from "./types";

export const STAGE_STEPS: { stage: JobStage; label: string; progress: number }[] = [
  { stage: "processing_reference", label: "Processing reference", progress: 10 },
  { stage: "extracting_transcript", label: "Extracting transcript", progress: 28 },
  { stage: "analyzing_storytelling", label: "Analyzing storytelling", progress: 52 },
  { stage: "understanding_niche", label: "Understanding your niche", progress: 66 },
  { stage: "generating_script", label: "Generating script", progress: 84 },
  { stage: "finalizing", label: "Finalizing results", progress: 95 },
];

export function stageLabel(stage: JobStage): string {
  return STAGE_STEPS.find((s) => s.stage === stage)?.label ?? "Working";
}
