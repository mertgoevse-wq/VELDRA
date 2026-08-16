import { atom } from 'nanostores';

/**
 * A minimal cross-module signal: incremented whenever something that could change the
 * Remote Runtime preview's real state just happened (today: a real agent-issued 'start'
 * action succeeded via action-runner.ts's #runStartActionRemote). Preview.tsx watches this
 * to trigger a real refreshRemotePreview() call instead of requiring the user to notice a
 * dev server came up and click "Refresh" themselves -- closing the gap between "the agent
 * started a real dev server" and "the UI that shows dev servers finds out about it."
 *
 * Deliberately just a counter, not an event bus: the only thing consumers need to know is
 * "something changed, go re-check the real state" -- the real state itself always comes
 * from RemoteRuntimeClient.getPreviewUrl(), never from this signal's own value.
 */
export const remotePreviewRefreshSignal = atom(0);

export function triggerRemotePreviewRefresh(): void {
  remotePreviewRefreshSignal.set(remotePreviewRefreshSignal.get() + 1);
}
