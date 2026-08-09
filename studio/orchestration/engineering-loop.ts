export const ENGINEERING_STATES = [
  'ANALYZE',
  'RESEARCH',
  'GENERATE_PROMPT',
  'SELECT_CAPABILITIES',
  'LOAD_CONTENT',
  'IMPLEMENT',
  'TEST',
  'REVIEW',
  'VERIFY',
  'DOCUMENT',
  'ASSESS_REMAINING_WORK',
  'NEXT_LOOP',
] as const;
export type EngineeringState = (typeof ENGINEERING_STATES)[number];

const NEXT_STATES: Record<EngineeringState, EngineeringState[]> = {
  ANALYZE: ['RESEARCH'],
  RESEARCH: ['GENERATE_PROMPT'],
  GENERATE_PROMPT: ['SELECT_CAPABILITIES'],
  SELECT_CAPABILITIES: ['LOAD_CONTENT'],
  LOAD_CONTENT: ['IMPLEMENT'],
  IMPLEMENT: ['TEST'],
  TEST: ['REVIEW'],
  REVIEW: ['VERIFY'],
  VERIFY: ['DOCUMENT'],
  DOCUMENT: ['ASSESS_REMAINING_WORK'],
  ASSESS_REMAINING_WORK: ['NEXT_LOOP'],
  NEXT_LOOP: ['ANALYZE'],
};

export interface LoopFeedback {
  worked: string[];
  failed: string[];
  usefulCapabilities: string[];
  irrelevantCapabilities: string[];
  missingSkills: string[];
  poorAgents: string[];
  exposedTests: string[];
  nextChanges: string[];
}

export interface EngineeringLoopState {
  state: EngineeringState;
  iteration: number;
  maxIterations: number;
  startedAt: string;
  updatedAt: string;
  history: Array<{ state: EngineeringState; at: string; detail?: string }>;
  feedback: LoopFeedback;
  blockedReason?: string;
}

export function createEngineeringLoop(maxIterations: number, now = new Date().toISOString()): EngineeringLoopState {
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error('maxIterations must be a positive integer');
  }

  return {
    state: 'ANALYZE',
    iteration: 1,
    maxIterations,
    startedAt: now,
    updatedAt: now,
    history: [{ state: 'ANALYZE', at: now }],
    feedback: {
      worked: [],
      failed: [],
      usefulCapabilities: [],
      irrelevantCapabilities: [],
      missingSkills: [],
      poorAgents: [],
      exposedTests: [],
      nextChanges: [],
    },
  };
}

export function advanceEngineeringLoop(
  state: EngineeringLoopState,
  next: EngineeringState,
  detail?: string,
  now = new Date().toISOString(),
): EngineeringLoopState {
  if (!NEXT_STATES[state.state].includes(next)) {
    throw new Error(`Invalid engineering transition ${state.state} -> ${next}`);
  }

  if (state.iteration > state.maxIterations) {
    throw new Error('Engineering loop iteration budget exhausted');
  }

  return { ...state, state: next, updatedAt: now, history: [...state.history, { state: next, at: now, detail }] };
}

export function startNextEngineeringIteration(
  state: EngineeringLoopState,
  detail?: string,
  now = new Date().toISOString(),
): EngineeringLoopState {
  if (state.state !== 'NEXT_LOOP') {
    throw new Error('Next iteration can start only from NEXT_LOOP');
  }

  if (state.iteration >= state.maxIterations) {
    return { ...state, state: 'ASSESS_REMAINING_WORK', updatedAt: now, blockedReason: 'iteration budget exhausted' };
  }

  const iteration = state.iteration + 1;

  return {
    ...state,
    iteration,
    state: 'ANALYZE',
    updatedAt: now,
    history: [...state.history, { state: 'ANALYZE', at: now, detail }],
  };
}

export function recordLoopFeedback(state: EngineeringLoopState, feedback: Partial<LoopFeedback>): EngineeringLoopState {
  return {
    ...state,
    feedback: {
      worked: [...state.feedback.worked, ...(feedback.worked ?? [])],
      failed: [...state.feedback.failed, ...(feedback.failed ?? [])],
      usefulCapabilities: [...state.feedback.usefulCapabilities, ...(feedback.usefulCapabilities ?? [])],
      irrelevantCapabilities: [...state.feedback.irrelevantCapabilities, ...(feedback.irrelevantCapabilities ?? [])],
      missingSkills: [...state.feedback.missingSkills, ...(feedback.missingSkills ?? [])],
      poorAgents: [...state.feedback.poorAgents, ...(feedback.poorAgents ?? [])],
      exposedTests: [...state.feedback.exposedTests, ...(feedback.exposedTests ?? [])],
      nextChanges: [...state.feedback.nextChanges, ...(feedback.nextChanges ?? [])],
    },
  };
}
