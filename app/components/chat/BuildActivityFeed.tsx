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

const PHASE_COLORS: Record<ActivityPhase, string> = {
  planning: 'text-blue-400',
  understanding: 'text-purple-400',
  searching: 'text-cyan-400',
  reading: 'text-slate-400',
  generating: 'text-violet-400',
  writing: 'text-emerald-400',
  running: 'text-orange-400',
  testing: 'text-yellow-400',
  building: 'text-amber-400',
  previewing: 'text-sky-400',
  fixing: 'text-rose-400',
  waiting: 'text-slate-400',
  complete: 'text-green-400',
  error: 'text-red-400',
};

function ActivityRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: ActivityEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const icon = PHASE_ICONS[event.phase];
  const color = PHASE_COLORS[event.phase];
  const isActive = event.status === 'active';
  const elapsed = event.completedAt ? `${((event.completedAt - event.startedAt) / 1000).toFixed(1)}s` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="activity-row"
      data-status={event.status}
    >
      <button className="activity-row-header" onClick={event.detail ? onToggle : undefined} aria-expanded={isExpanded}>
        <span className="activity-icon-wrap">
          {isActive ? (
            <span
              className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress activity-icon"
              aria-hidden="true"
            />
          ) : (
            <span className={`${icon} ${color} activity-icon`} aria-hidden="true" />
          )}
        </span>
        <span className="activity-label">{event.label}</span>
        <span className="activity-meta">
          {elapsed && <span className="activity-elapsed">{elapsed}</span>}
          {event.detail && (
            <span className={`i-ph:caret-${isExpanded ? 'up' : 'down'} activity-expand-icon`} aria-hidden="true" />
          )}
        </span>
      </button>
      <AnimatePresence>
        {isExpanded && event.detail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="activity-detail"
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

  const { events, currentPhase } = state;

  if (events.length === 0) {
    return null;
  }

  const activeEvents = events.filter((e) => e.status === 'active');
  const isComplete = currentPhase === 'complete';
  const hasError = currentPhase === 'error';

  return (
    <div className="build-activity-feed" data-complete={isComplete} data-error={hasError}>
      {/* Header */}
      <button className="build-activity-header" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
        <span className="build-activity-status">
          {isComplete ? (
            <span className="i-ph:check-circle build-activity-status-icon text-green-400" />
          ) : hasError ? (
            <span className="i-ph:warning-circle build-activity-status-icon text-red-400" />
          ) : (
            <span className="i-svg-spinners:90-ring-with-bg build-activity-status-icon text-bolt-elements-loader-progress" />
          )}
          <span className="build-activity-title">
            {isComplete ? 'Build complete' : hasError ? 'Build error' : (activeEvents[0]?.label ?? 'Working…')}
          </span>
        </span>
        <span className="build-activity-stats">
          <span>
            {events.length} step{events.length !== 1 ? 's' : ''}
          </span>
          <span className={`i-ph:caret-${collapsed ? 'down' : 'up'} ml-1`} />
        </span>
      </button>

      {/* Event list */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="build-activity-events"
          >
            {events.map((event) => (
              <ActivityRow
                key={event.id}
                event={event}
                isExpanded={expandedId === event.id}
                onToggle={() => setExpandedId((id) => (id === event.id ? null : event.id))}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
