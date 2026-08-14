/**
 * Build Activity Store
 *
 * Tracks structured activity events during AI-assisted development.
 * Shows users WHAT the AI is doing without exposing raw chain-of-thought.
 *
 * Events are ephemeral per-session and displayed in BuildActivityFeed.
 */

import { atom } from 'nanostores';

export type ActivityPhase =
  | 'planning'
  | 'understanding'
  | 'searching'
  | 'reading'
  | 'generating'
  | 'writing'
  | 'running'
  | 'testing'
  | 'building'
  | 'previewing'
  | 'fixing'
  | 'waiting'
  | 'complete'
  | 'error';

export interface ActivityEvent {
  id: string;
  phase: ActivityPhase;
  label: string;
  detail?: string;
  startedAt: number;
  completedAt?: number;
  status: 'active' | 'done' | 'error' | 'skipped';
}

export interface BuildActivityState {
  events: ActivityEvent[];
  currentPhase: ActivityPhase | null;
  sessionId: string | null;
}

const INITIAL_STATE: BuildActivityState = {
  events: [],
  currentPhase: null,
  sessionId: null,
};

export const buildActivityStore = atom<BuildActivityState>(INITIAL_STATE);

let _eventCounter = 0;

function makeId() {
  return `evt-${Date.now()}-${++_eventCounter}`;
}

export function startBuildSession(sessionId: string) {
  buildActivityStore.set({ events: [], currentPhase: null, sessionId });
}

export function addActivity(phase: ActivityPhase, label: string, detail?: string): string {
  const id = makeId();
  const state = buildActivityStore.get();

  // Mark previous active event as done
  const updatedEvents = state.events.map((e) =>
    e.status === 'active' ? { ...e, status: 'done' as const, completedAt: Date.now() } : e,
  );

  const event: ActivityEvent = {
    id,
    phase,
    label,
    detail,
    startedAt: Date.now(),
    status: 'active',
  };

  buildActivityStore.set({
    ...state,
    events: [...updatedEvents, event],
    currentPhase: phase,
  });

  return id;
}

export function completeActivity(id: string) {
  const state = buildActivityStore.get();
  buildActivityStore.set({
    ...state,
    events: state.events.map((e) => (e.id === id ? { ...e, status: 'done', completedAt: Date.now() } : e)),
  });
}

export function errorActivity(id: string, detail?: string) {
  const state = buildActivityStore.get();
  buildActivityStore.set({
    ...state,
    currentPhase: 'error',
    events: state.events.map((e) =>
      e.id === id ? { ...e, status: 'error', completedAt: Date.now(), detail: detail ?? e.detail } : e,
    ),
  });
}

export function clearBuildActivity() {
  buildActivityStore.set(INITIAL_STATE);
}

export function completeBuildSession() {
  const state = buildActivityStore.get();
  const updatedEvents = state.events.map((e) =>
    e.status === 'active' ? { ...e, status: 'done' as const, completedAt: Date.now() } : e,
  );
  buildActivityStore.set({ ...state, events: updatedEvents, currentPhase: 'complete' });
}
