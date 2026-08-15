import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { pendingApprovalsStore } from '~/lib/orchestrator/veldra-approvals';
import { getVeldraHost } from '~/lib/orchestrator/veldra-host';
import type { ApprovalKind } from '~/lib/orchestrator/types';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { usePrefersReducedMotion } from '~/lib/hooks/usePrefersReducedMotion';

/**
 * Phase 3 of the product-integration mandate: a real end-to-end approval UI, backed
 * entirely by the real ApprovalPort (veldra-approvals.ts) built in the runtime-foundation
 * round -- request() genuinely suspends whatever called it until this widget calls
 * respond(). Nothing here is simulated; a click genuinely resumes or halts the workflow
 * that's waiting on it.
 *
 * Honest scope note: no live call site currently produces a real approval request.
 * spawnSubagentWithOrchestrator()'s single-task-per-run shape means its one budget check
 * always runs against zero usage (see integration.ts's preflight check, added in Phase 1)
 * -- so a 'budget-exceeded' request, the only kind anything currently asks for, can never
 * actually fire from today's live spawn path. This widget exists ahead of that so that
 * a future multi-task workflow or a destructive-action/plan check can start requesting
 * real approvals without a second round of "wire the UI to real data" -- see
 * docs/ai-state/DECISIONS.md's Phase 3 entry.
 */

const KIND_ICON: Record<ApprovalKind, string> = {
  plan: 'i-ph:map-trifold',
  'destructive-action': 'i-ph:warning-octagon',
  'budget-exceeded': 'i-ph:gauge',
  'external-side-effect': 'i-ph:arrow-square-out',
  'low-confidence': 'i-ph:question',
};

function kindLabel(kind: ApprovalKind): string {
  switch (kind) {
    case 'plan':
      return 'Plan approval';
    case 'destructive-action':
      return 'Destructive action';
    case 'budget-exceeded':
      return 'Budget limit reached';
    case 'external-side-effect':
      return 'External side effect';
    case 'low-confidence':
      return 'Low-confidence result';
    default:
      return kind;
  }
}

export function ApprovalRequestWidget() {
  const pending = useStore(pendingApprovalsStore);
  const requests = Object.values(pending);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: cubicEasingFn };

  if (requests.length === 0) {
    return null;
  }

  const handleRespond = (requestId: string, chosen: string) => {
    setRespondingId(requestId);
    getVeldraHost().approvals.respond(requestId, chosen);

    /*
     * The request is removed from pendingApprovalsStore by respond() itself; this local
     * flag just prevents a double-click between that call and the next render.
     */
    setRespondingId(null);
  };

  return (
    <section
      className="flex w-full flex-col gap-2 mb-2"
      aria-label="Pending approvals"
      role="region"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {requests.map((request) => {
          const isExpanded = expandedId === request.id;

          return (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={transition}
              className="flex flex-col overflow-hidden rounded-lg border border-bolt-elements-item-contentAccent/40 bg-bolt-elements-item-backgroundAccent/20 shadow-sm"
            >
              <div className="flex items-start gap-3 p-3">
                <span
                  className={classNames(
                    KIND_ICON[request.kind] ?? 'i-ph:question',
                    'mt-0.5 shrink-0 text-lg text-bolt-elements-item-contentAccent',
                  )}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-bolt-elements-background-depth-3 text-bolt-elements-item-contentAccent">
                      {kindLabel(request.kind)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-bolt-elements-textPrimary">{request.question}</p>

                  {request.context && (
                    <button
                      type="button"
                      className="mt-1 text-[11px] text-bolt-elements-textTertiary underline decoration-dotted hover:text-bolt-elements-textSecondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-borderColorActive rounded"
                      onClick={() => setExpandedId(isExpanded ? null : request.id)}
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>
                  )}

                  <AnimatePresence initial={false}>
                    {isExpanded && request.context && (
                      <motion.p
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={transition}
                        className="mt-1 overflow-hidden whitespace-pre-wrap break-words text-xs text-bolt-elements-textSecondary"
                      >
                        {request.context}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {request.options.map((option) => (
                      <button
                        key={option}
                        type="button"
                        disabled={respondingId === request.id}
                        onClick={() => handleRespond(request.id, option)}
                        className="min-h-8 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-1 text-xs font-medium text-bolt-elements-textPrimary hover:border-bolt-elements-borderColorActive hover:bg-bolt-elements-background-depth-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-borderColorActive disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </section>
  );
}
