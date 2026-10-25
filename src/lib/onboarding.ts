// The onboarding flow's screens and the steps each one completes.

import type { OnboardingStepId } from "./types";

export const SCREENS = ["welcome", "rules", "tiers", "tools", "buddy", "project", "clock"] as const;
export type Screen = (typeof SCREENS)[number];

/** The steps each screen completes; the flow is done when these are. */
const SCREEN_STEPS: Record<Screen, OnboardingStepId[]> = {
  welcome: [],
  rules: ["values"],
  tiers: ["tiers"],
  tools: ["contract", "email", "slack", "calendar"],
  buddy: ["buddy"],
  project: ["project"],
  clock: ["first-hour"],
};

export const flowDone = (done: Record<OnboardingStepId, boolean>) =>
  SCREENS.every((s) => SCREEN_STEPS[s].every((id) => done[id]));

export function firstOpenScreen(done: Record<OnboardingStepId, boolean>): number {
  const i = SCREENS.findIndex((s) => s !== "welcome" && SCREEN_STEPS[s].some((id) => !done[id]));
  const anyDone = Object.values(done).some(Boolean);
  return i === -1 ? SCREENS.length - 1 : anyDone ? i : 0;
}

