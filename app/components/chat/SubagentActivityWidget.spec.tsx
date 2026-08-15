// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SubagentActivityWidget } from './SubagentActivityWidget';
import { subagentsStore, type SubagentTask } from '~/lib/stores/subagents';
import { recentAgentActivityStore } from '~/lib/orchestrator/subagent-activity-bridge';

/**
 * Phase 4 of the product-integration mandate: verify SubagentActivityWidget actually
 * renders what's really in subagentsStore/recentAgentActivityStore, not a shape assumed
 * from reading the component. Test 3 in particular exercises the REAL
 * startSubagentActivityBridge() the widget itself starts on mount (not a mock) against a
 * real subagentsStore status transition, so a passing test here means the full activity
 * pipeline this widget depends on -- store to bridge to rendered DOM -- actually works.
 */

function task(overrides: Partial<SubagentTask> = {}): SubagentTask {
  return {
    taskId: 'subagent-1000-abcde',
    model: 'Google:gemini-1.5-pro',
    systemPrompt: 'You are a helpful subagent.',
    task: 'Summarize the README',
    status: 'running',
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('SubagentActivityWidget', () => {
  beforeEach(() => {
    subagentsStore.set({});
    recentAgentActivityStore.set([]);

    /*
     * Both the modern (addEventListener) and legacy (addListener) MediaQueryList methods
     * are stubbed -- framer-motion's own internal reduced-motion detection still uses the
     * legacy pair, which a mock missing them makes throw at mount time.
     */
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    cleanup();
    subagentsStore.set({});
    recentAgentActivityStore.set([]);
  });

  it('renders nothing when there are no subagent tasks', () => {
    const { container } = render(<SubagentActivityWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the running count and real task details from subagentsStore when expanded', () => {
    subagentsStore.setKey('subagent-1000-abcde', task());

    render(<SubagentActivityWidget />);

    expect(screen.getByText('1 background task active')).toBeInTheDocument();

    /*
     * The task list itself starts expanded (useState(true)) -- only the individual task
     * row's own details need a click, not the outer section toggle (which would collapse it).
     */
    fireEvent.click(screen.getByRole('button', { name: /subagent-1000-abcde/ }));

    /*
     * Appears twice by design: the always-visible collapsed-row summary, and the expanded
     * "Delegated task" detail paragraph -- both real renders of the same real task.task.
     */
    expect(screen.getAllByText('Summarize the README').length).toBeGreaterThan(0);
    expect(screen.getByText('Google:gemini-1.5-pro')).toBeInTheDocument();
  });

  it('shows a real error from a failed task, sourced from subagentsStore, not invented', () => {
    subagentsStore.setKey(
      'subagent-2000-fghij',
      task({ taskId: 'subagent-2000-fghij', status: 'failed', error: 'Provider request timed out' }),
    );

    render(<SubagentActivityWidget />);

    expect(screen.getByText('1 background task complete')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /subagent-2000-fghij/ }));

    expect(screen.getByText('Provider request timed out')).toBeInTheDocument();
  });

  it("reflects a real status transition through the widget's own activity bridge, not a manually-seeded event", async () => {
    /*
     * Mount BEFORE seeding the task, matching real production ordering: the widget is
     * already mounted (and its bridge already listening) in Messages.client.tsx well
     * before any live spawn happens. nanostore's map.listen() only fires on changes made
     * AFTER subscribing -- seeding the task first (like the other tests here do) would
     * make the bridge miss the transition into 'running' entirely, since that change
     * would have already happened before it ever subscribed.
     */
    render(<SubagentActivityWidget />);

    subagentsStore.setKey('subagent-3000-klmno', task({ taskId: 'subagent-3000-klmno' }));

    /*
     * The bridge (started by the widget's own mount effect, already listening by now)
     * must record a real agent.started for this real 'running' transition.
     */
    await waitFor(() =>
      expect(recentAgentActivityStore.get().some((event) => event.type === 'agent.started')).toBe(true),
    );

    // Real state transition -- not a fabricated event -- must flow through to a re-render.
    subagentsStore.setKey('subagent-3000-klmno', {
      ...subagentsStore.get()['subagent-3000-klmno'],
      status: 'completed',
      result: 'Done.',
      completedAt: Date.now(),
    });

    await waitFor(() =>
      expect(recentAgentActivityStore.get().some((event) => event.type === 'agent.completed')).toBe(true),
    );

    await waitFor(() => expect(screen.getByText('1 background task complete')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /subagent-3000-klmno/ }));

    expect(screen.getByText('Started')).toBeInTheDocument();

    /*
     * "Completed" legitimately appears twice: the task's own status badge, and the
     * Activity list's agent.completed entry -- both real, both from real store data.
     */
    expect(screen.getAllByText('Completed').length).toBe(2);
  });
});
