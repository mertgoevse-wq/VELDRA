// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ApprovalRequestWidget } from './ApprovalRequestWidget';
import { getVeldraHost, VeldraOrchestratorHost } from '~/lib/orchestrator/veldra-host';
import { pendingApprovalsStore } from '~/lib/orchestrator/veldra-approvals';

/**
 * Phase 3 of the product-integration mandate: prove the approval UI is a real round-trip
 * against the actual ApprovalPort (veldra-approvals.ts), not a mock -- request() genuinely
 * suspends, a click genuinely calls respond(), and the same promise that request() returned
 * resolves with exactly what the user chose.
 */

describe('ApprovalRequestWidget', () => {
  beforeEach(() => {
    VeldraOrchestratorHost.resetInstance();
    pendingApprovalsStore.set({});
  });

  afterEach(() => {
    cleanup();
    VeldraOrchestratorHost.resetInstance();
    pendingApprovalsStore.set({});
  });

  it('renders nothing when there is no pending approval', () => {
    const { container } = render(<ApprovalRequestWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a real pending approval and resolves it via a genuine ApprovalPort round-trip on click', async () => {
    const host = getVeldraHost();

    const responsePromise = host.approvals.request({
      id: 'approval-1',
      kind: 'budget-exceeded',
      question: 'This run hit its maxTokens limit. Continue once, or stop here?',
      context: 'maxTokens exhausted: 50000 of 50000',
      options: ['continue-once', 'stop'],
    });

    render(<ApprovalRequestWidget />);

    expect(screen.getByText('This run hit its maxTokens limit. Continue once, or stop here?')).toBeInTheDocument();
    expect(screen.getByText('Budget limit reached')).toBeInTheDocument();

    // Progressive disclosure: context is hidden until expanded.
    expect(screen.queryByText('maxTokens exhausted: 50000 of 50000')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show details' }));
    expect(screen.getByText('maxTokens exhausted: 50000 of 50000')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'continue-once' }));

    const response = await responsePromise;
    expect(response.chosen).toBe('continue-once');
    expect(response.requestId).toBe('approval-1');

    /*
     * respond() removes the entry from pendingApprovalsStore; the widget must react to that,
     * not just resolve the promise, or a resolved-but-still-shown card would be a real bug.
     */
    expect(pendingApprovalsStore.get()['approval-1']).toBeUndefined();
  });

  it('lets a second, independent approval request resolve without interfering with the first', async () => {
    const host = getVeldraHost();

    const first = host.approvals.request({
      id: 'approval-a',
      kind: 'plan',
      question: 'Proceed with this plan?',
      context: '',
      options: ['yes', 'no'],
    });
    const second = host.approvals.request({
      id: 'approval-b',
      kind: 'low-confidence',
      question: 'Confidence is low on this result. Accept anyway?',
      context: '',
      options: ['accept', 'retry'],
    });

    render(<ApprovalRequestWidget />);

    fireEvent.click(screen.getByRole('button', { name: 'no' }));

    expect((await first).chosen).toBe('no');
    expect(pendingApprovalsStore.get()['approval-a']).toBeUndefined();

    // The second request is untouched -- still pending, its own promise unresolved.
    expect(pendingApprovalsStore.get()['approval-b']).toBeDefined();
    expect(screen.getByText('Confidence is low on this result. Accept anyway?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'accept' }));
    expect((await second).chosen).toBe('accept');
  });
});
