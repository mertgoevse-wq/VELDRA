// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { BuildActivityFeed } from './BuildActivityFeed';
import { buildActivityStore, addActivity, completeBuildSession, clearBuildActivity } from '~/lib/stores/buildActivity';

/**
 * Phase 5 of the product-integration mandate: BuildActivityFeed previously had no styling
 * on the web/desktop build at all (only android.css, which the web entry never loads --
 * see docs/ai-state/DECISIONS.md). Rewritten to use the same tokenized Tailwind pattern as
 * SubagentActivityWidget/ApprovalRequestWidget; this test proves the rewrite renders real
 * buildActivityStore data correctly, not just that it typechecks.
 */

describe('BuildActivityFeed', () => {
  beforeEach(() => {
    clearBuildActivity();

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
    clearBuildActivity();
  });

  it('renders nothing when there is no build activity', () => {
    const { container } = render(<BuildActivityFeed />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the active step label and step count from real store events', () => {
    addActivity('planning', 'Understanding your request');
    addActivity('generating', 'Planning project structure');

    render(<BuildActivityFeed />);

    /*
     * The header title mirrors the active event's own label -- both real renders of the
     * same current step, not a mismatch.
     */
    expect(screen.getAllByText('Planning project structure').length).toBeGreaterThan(0);
    expect(screen.getByText('2 steps')).toBeInTheDocument();
  });

  it('shows "Build complete" once the session completes, driven by real store state', () => {
    addActivity('writing', 'Writing index.html');
    completeBuildSession();

    render(<BuildActivityFeed />);

    expect(screen.getByText('Build complete')).toBeInTheDocument();
  });

  it('expands a step with detail on click and shows the real detail text', () => {
    addActivity('fixing', 'Fixing a type error', 'Property "foo" does not exist on type "Bar".');

    render(<BuildActivityFeed />);

    expect(screen.queryByText('Property "foo" does not exist on type "Bar".')).not.toBeInTheDocument();

    /*
     * Header and row both say "Fixing a type error" (header mirrors the active step); the
     * row's own toggle is the second match in DOM order (header renders first).
     */
    const [, rowToggle] = screen.getAllByRole('button', { name: /Fixing a type error/ });
    fireEvent.click(rowToggle);

    expect(screen.getByText('Property "foo" does not exist on type "Bar".')).toBeInTheDocument();
  });

  it('reacts to buildActivityStore updates after mount, not just its initial value', async () => {
    render(<BuildActivityFeed />);

    expect(screen.queryByText(/step/)).not.toBeInTheDocument();

    addActivity('searching', 'Searching the codebase');

    expect(buildActivityStore.get().events).toHaveLength(1);
    await waitFor(() => expect(screen.getByText('1 step')).toBeInTheDocument());
    expect(screen.getAllByText('Searching the codebase').length).toBeGreaterThan(0);
  });
});
