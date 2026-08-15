/**
 * BuildActivityFeed
 *
 * Shows structured AI activity during code generation — what the AI is doing,
 * NOT raw chain-of-thought. Displayed between user prompt and AI response.
 *
 * Activity phases: Planning → Understanding → Generating → Writing → Building → Previewing
 */

import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { buildActivityStore, type ActivityPhase, type ActivityEvent } from '~/lib/stores/buildActivity';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { usePrefersReducedMotion } from '~/lib/hooks/usePrefersReducedMotion';

const PHASE_ICONS: Record<ActivityPhase, string> = {
  planning: 'i-ph:lightbulb',
  understanding: 'i-ph:brain',
  searching: 'i-ph:magnifying-glass',
  reading: 'i-ph:file-text',
  generating: 'i-ph:sparkle',
  writing: 'i-ph:pencil-simple',
  running: 'i-ph:play',
  testing: 'i-ph:test-tube',
  building: 'i-ph:hammer',
  previewing: 'i-ph:eye',
  fixing: 'i-ph:wrench',
  waiting: 'i-ph:hourglass',
  complete: 'i-ph:check-circle',
  error: 'i-ph:warning-circle',
};

/**
 * Tokenized status color, not a 14-hue rainbow per phase -- the icon shape (PHASE_ICONS)
 * already differentiates phases; the color communicates outcome (in-progress/done/error/
 * skipped), the same status-not-category split SubagentActivityWidget already uses, and
 * it adapts to skins the way a hardcoded `text-violet-400`-style palette can't.
 */
function statusColorClass(event: ActivityEvent): string {
  switch (event.status) {
    case 'error':
      return 'text-bolt-elements-icon-error';
    case 'skipped':
      return 'text-bolt-elements-textTertiary';
    case 'done':
      return 'text-bolt-elements-icon-success';
    default:
      return 'text-bolt-elements-textSecondary';
  }
}

function ActivityRow({
  event,
  isExpanded,
  onToggle,
  transition,
}: {
  event: ActivityEvent;
  isExpanded: boolean;
  onToggle: () => void;
  transition: { duration: number; ease?: typeof cubicEasingFn };
}) {
  const icon = PHASE_ICONS[event.phase];
  const isActive = event.status === 'active';
  const elapsed = event.completedAt ? `${((event.completedAt - event.startedAt) / 1000).toFixed(1)}s` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
      className="border-b border-bolt-elements-borderColor last:border-b-0"
      data-status={event.status}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-bolt-elements-textSecondary disabled:cursor-default"
        onClick={event.detail ? onToggle : undefined}
        disabled={!event.detail}
        aria-expanded={event.detail ? isExpanded : undefined}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isActive ? (
            <span
              className="i-svg-spinners:90-ring-with-bg text-sm text-bolt-elements-loader-progress"
              aria-hidden="true"
            />
          ) : (
            <span className={classNames(icon, statusColorClass(event), 'text-sm')} aria-hidden="true" />
          )}
        </span>
        <span className="flex-1 truncate text-[11.5px]">{event.label}</span>
        <span className="ml-1 flex shrink-0 items-center gap-1 text-bolt-elements-textTertiary">
          {elapsed && <span className="text-[10px] tabular-nums">{elapsed}</span>}
          {event.detail && (
            <span
              className={classNames('text-[11px]', isExpanded ? 'i-ph:caret-up' : 'i-ph:caret-down')}
              aria-hidden="true"
            />
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && event.detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            className="overflow-hidden pl-9 pr-3 pb-2 text-[11px] leading-relaxed text-bolt-elements-textTertiary"
          >
            {event.detail}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function BuildActivityFeed() {
  const state = useStore(buildActivityStore);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.15, ease: cubicEasingFn };

  const { events, currentPhase } = state;

  if (events.length === 0) {
    return null;
  }

  const activeEvents = events.filter((e) => e.status === 'active');
  const isComplete = currentPhase === 'complete';
  const hasError = currentPhase === 'error';

  return (
    <div
      className={classNames(
        'mb-2 flex w-full flex-col overflow-hidden rounded-lg border bg-bolt-elements-background-depth-3/50 text-xs backdrop-blur',
        {
          'border-bolt-elements-borderColor': !isComplete && !hasError,
          'border-bolt-elements-icon-success/30': isComplete,
          'border-bolt-elements-icon-error/30': hasError,
        },
      )}
    >
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-bolt-elements-background-depth-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-borderColorActive"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {isComplete ? (
            <span className="i-ph:check-circle shrink-0 text-lg text-bolt-elements-icon-success" aria-hidden="true" />
          ) : hasError ? (
            <span className="i-ph:warning-circle shrink-0 text-lg text-bolt-elements-icon-error" aria-hidden="true" />
          ) : (
            <span
              className="i-svg-spinners:90-ring-with-bg shrink-0 text-lg text-bolt-elements-loader-progress"
              aria-hidden="true"
            />
          )}
          <span className="truncate font-medium text-bolt-elements-textPrimary" aria-live="polite">
            {isComplete ? 'Build complete' : hasError ? 'Build error' : (activeEvents[0]?.label ?? 'Working…')}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-bolt-elements-textTertiary">
          <span>
            {events.length} step{events.length !== 1 ? 's' : ''}
          </span>
          <span className={classNames('ml-1', collapsed ? 'i-ph:caret-down' : 'i-ph:caret-up')} aria-hidden="true" />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={transition}
            className="overflow-hidden border-t border-bolt-elements-borderColor"
          >
            {events.map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                isExpanded={expandedId === event.id}
                onToggle={() => setExpandedId((id) => (id === event.id ? null : event.id))}
                transition={transition}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
