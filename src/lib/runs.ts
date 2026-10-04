const globalRuns = globalThis as unknown as {
  ideaPromptRuns?: Map<string, AbortController>;
};
export const runs = (globalRuns.ideaPromptRuns ||= new Map());
