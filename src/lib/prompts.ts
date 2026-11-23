import type { Mode } from "./types";

export const MODE_CONFIG: Record<
  Mode,
  {
    label: string;
    blurb: string;
    temperature: number;
    runsStrategyStep: boolean;
    analysisDepth: string;
  }
> = {
  fast: {
    label: "Fast",
    blurb: "One focused analysis pass, quick draft. Best with free/cheap models.",
    temperature: 0.85,
    runsStrategyStep: false,
    analysisDepth:
      "Keep the analysis concise: 1–2 sentences per field, at most 3 items per list.",
  },
  balanced: {
    label: "Balanced",
    blurb: "Storytelling analysis plus a strategy brief before writing. Good default.",
    temperature: 0.8,
    runsStrategyStep: true,
    analysisDepth:
      "Be thorough but tight: 2–3 sentences per field, 3–4 items per list, concrete observations only.",
  },
  premium: {
    label: "Premium",
    blurb: "Deep structural read, retention map and a polished draft. Use your strongest model.",
    temperature: 0.72,
    runsStrategyStep: true,
    analysisDepth:
      "Go deep: explain the mechanic behind every observation, map retention beats second by second, and give 4–6 items per list. Use your selected model's full capability.",
  },
};

export const ANALYST_SYSTEM = `You are HookMerge AI's retention analyst. You read short-form video transcripts (YouTube Shorts, Reels, TikTok) and reverse-engineer WHY they hold attention. You never summarize for summary's sake: every observation must explain a mechanism a writer could reuse on a completely different topic. You are precise, evidence-driven and allergic to vague advice.`;

export function analysisPrompt(input: {
  transcript: string;
  niche: string;
  duration: number;
  mode: Mode;
}): string {
  const cfg = MODE_CONFIG[input.mode];
  return `Analyse this reference video transcript as a retention strategist.

Creator's niche (context only): ${input.niche}
Reference length: ${input.duration} seconds

${cfg.analysisDepth}

Return ONLY a JSON object with exactly these keys:
{
  "opening_hook": "The exact mechanic of the opening line(s) — what makes someone stop scrolling",
  "first_three_seconds": "What is delivered in the first 3 seconds: claim, visual promise, tension, stakes",
  "storytelling_format": "e.g. first-person confession, listicle with twist, myth-busting, POV story, case study",
  "central_idea": "The single idea the video is built around",
  "narrative_structure": [{"beat": "0–3s hook", "purpose": "why this beat exists"}],
  "dialogue_style": "Voice, person, tone, vocabulary level",
  "sentence_length": "Typical sentence length and rhythm, with an example of the cadence (paraphrased)",
  "pacing": "How fast information arrives; where it slows down and why",
  "emotional_triggers": ["specific emotions and the lines that create them"],
  "curiosity_gaps": ["open loops the script plants and when it closes them"],
  "retention_techniques": ["concrete techniques: pattern interrupts, callbacks, escalation, stakes, reveals"],
  "transitions": "How the video moves between beats",
  "information_delivery": "How facts/examples are packaged (analogy, numbers, story, contrast)",
  "ending_payoff": "How the ending resolves the promise; whether it loops back to the hook",
  "approx_script_length": "estimated word count and speaking pace",
  "why_it_works": ["3–6 mechanistic reasons this specific video works"],
  "reusable_formula": "A reusable, topic-agnostic template in one or two sentences"
}

Rules:
- Paraphrase. Never quote more than 6 consecutive words from the transcript.
- Be specific to THIS transcript; no generic advice.
- If the transcript looks like music/ASMR/no speech, say so in central_idea and still describe pacing.

Transcript:
"""
${input.transcript.slice(0, 24_000)}
"""`;
}

export function strategyPrompt(input: {
  analysisJson: string;
  niche: string;
  duration: number;
  mode: Mode;
}): string {
  return `You are HookMerge AI's creative director. Using the reference analysis below, plan ONE original short-form video concept for the creator's niche.

Niche: ${input.niche}
Target length: ${input.duration} seconds (about ${targetWords(input.duration)} spoken words)
Mode: ${MODE_CONFIG[input.mode].label}

Reference analysis:
${input.analysisJson.slice(0, 9000)}

Return ONLY JSON:
{
  "concept": "One-sentence original concept, entirely about the creator's niche",
  "audience": "Who this is for and the tension they feel right now",
  "promise": "The concrete payoff the viewer will get",
  "hook_mechanic": "Which mechanism from the reference we will reuse, adapted to this niche",
  "structure": ["beat 1: ...", "beat 2: ..."],
  "payoff": "How the ending delivers the promise and rewards retention",
  "avoid": ["traps that would make this generic or derivative"]
}`;
}

export function scriptPrompt(input: {
  analysisJson: string;
  strategyJson: string | null;
  niche: string;
  duration: number;
  mode: Mode;
  variation?: boolean;
}): string {
  const words = targetWords(input.duration);
  const cfg = MODE_CONFIG[input.mode];
  return `Write an ORIGINAL short-form video script for this creator.

NICHE: ${input.niche}
DURATION: ${input.duration} seconds (~${words} spoken words, ±12%)
DEPTH: ${cfg.label} mode

REFERENCE ANALYSIS (learn the mechanics, never the content):
${input.analysisJson.slice(0, 9000)}

${input.strategyJson ? `STRATEGY BRIEF:\n${input.strategyJson.slice(0, 5000)}\n` : ""}
HARD RULES:
1. 100% original wording. Never reuse a full sentence or a distinctive phrase from the reference.
2. The topic must belong to the creator's niche, not the reference video's topic.
3. The first line must work as a scroll-stopping hook with no preamble ("Hey guys" is banned).
4. Every 3–5 seconds must add tension, information or a turn. No filler, no recap, no throat-clearing.
5. Speakable language: short sentences, concrete nouns, present tense. No emojis, no hashtags, no stage directions inside dialogue.
6. End with a real payoff — a reveal, a reframe, or a line that loops back to the hook.
7. ${words} words target. Do not pad with repetition.
${input.variation ? "8. This is an extra version: use a different angle and hook mechanic than the obvious first idea." : ""}

Return ONLY JSON:
{
  "title": "A clickable, honest video title (max 70 characters)",
  "hook": "The spoken opening line(s), 1–2 sentences",
  "body": "The complete spoken script including the hook, as plain paragraphs separated by \\n\\n",
  "structure": {
    "opening": "What happens in the opening and why",
    "setup": "The setup beat",
    "development": "The main development",
    "retention": "The curiosity/retention element and where it lands",
    "ending": "The payoff"
  },
  "word_count": ${words}
}`;
}

export function revisionPrompt(input: {
  instruction: string;
  scriptJson: string;
  niche: string;
  duration: number;
  mode: Mode;
}): string {
  return `You are HookMerge AI's script editor. Revise the script below.

NICHE: ${input.niche}
TARGET LENGTH: ${input.duration} seconds (~${targetWords(input.duration)} words)
REQUEST: ${input.instruction}

CURRENT SCRIPT:
${input.scriptJson.slice(0, 12000)}

RULES:
- Keep the same topic and the same core promise.
- Preserve anything that already works; change only what the request demands.
- Stay fully original; no phrases from any reference video.
- Return the complete revised script, not a diff.

Return ONLY JSON with the same shape:
{
  "title": "…",
  "hook": "…",
  "body": "complete script text including the hook",
  "structure": {"opening":"…","setup":"…","development":"…","retention":"…","ending":"…"},
  "word_count": 0
}`;
}

export const ACTION_INSTRUCTIONS: Record<string, string> = {
  improve_hook: "Rewrite the opening hook to be dramatically stronger: sharper tension, a concrete promise, and a first line that cannot be scrolled past. Keep the rest tightly aligned with the new hook.",
  more_engaging: "Make the script more engaging: add pattern interrupts, tighten pacing, raise stakes and strengthen curiosity gaps — without inventing facts or padding length.",
  shorten: "Cut the script down by roughly 35% while keeping the strongest hook, the clearest through-line and the payoff. Remove every non-essential line.",
  expand: "Expand the script by roughly 30% with substance: add a concrete example, a specific detail or a turn that deepens the payoff. Do not pad or repeat.",
};

export function targetWords(seconds: number): number {
  // Short-form delivery averages ~2.4 spoken words per second.
  return Math.round(seconds * 2.4);
}
