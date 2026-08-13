import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { subagentsStore, type SubagentTask } from '~/lib/stores/subagents';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function statusLabel(status: SubagentTask['status']) {
  return status === 'running' ? 'Running' : status === 'completed' ? 'Completed' : 'Failed';
}

function statusIcon(status: SubagentTask['status']) {
  if (status === 'running') {
    return (
      <span className="i-svg-spinners:90-ring-with-bg text-bolt-elements-loader-progress text-sm" aria-hidden="true" />
    );
  }

  if (status === 'completed') {
    return <span className="i-ph:check-circle text-bolt-elements-icon-success text-sm" aria-hidden="true" />;
  }

  return <span className="i-ph:warning-circle text-bolt-elements-icon-error text-sm" aria-hidden="true" />;
}

function statusClasses(status: SubagentTask['status']) {
  if (status === 'running') {
    return 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-loader-progress';
  }

  if (status === 'completed') {
    return 'bg-bolt-elements-background-depth-3 text-bolt-elements-icon-success';
  }

  return 'bg-bolt-elements-background-depth-3 text-bolt-elements-icon-error';
}

export function SubagentActivityWidget() {
  const subagents = useStore(subagentsStore);
  const tasks = Object.values(subagents).sort((a, b) => b.createdAt - a.createdAt);
  const runningCount = tasks.filter((task) => task.status === 'running').length;
  const visibleTasks = [
    ...tasks.filter((task) => task.status === 'running'),
    ...tasks.filter((task) => task.status !== 'running'),
  ].slice(0, 6);
  const [expanded, setExpanded] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (runningCount === 0) {
      return undefined;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [runningCount]);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-2 mb-2" aria-label="Background subagent activity">
      <button
        type="button"
        className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 bg-bolt-elements-background-depth-3/50 backdrop-blur rounded-lg border border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bolt-elements-borderColorActive transition-colors shadow-sm text-left"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls="subagent-activity-list"
      >
        <span className="flex min-w-0 items-center gap-2">
          {runningCount > 0 ? (
            <span
              className="i-svg-spinners:pulse-rings-2 text-bolt-elements-loader-progress text-lg"
              aria-hidden="true"
            />
          ) : (
            <span className="i-ph:check-circle text-bolt-elements-icon-success text-lg" aria-hidden="true" />
          )}
          <span className="truncate text-sm font-medium text-bolt-elements-textPrimary" aria-live="polite">
            {runningCount > 0
              ? `${runningCount} background ${runningCount === 1 ? 'task' : 'tasks'} active`
              : `${tasks.length} background ${tasks.length === 1 ? 'task' : 'tasks'} complete`}
          </span>
        </span>
        <span
          className={classNames(
            'i-ph:caret-down shrink-0 text-bolt-elements-textTertiary transition-transform duration-200',
            {
              'rotate-180': expanded,
            },
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="subagent-activity-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: cubicEasingFn }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            {tasks.length > visibleTasks.length && (
              <p className="px-1 text-[11px] text-bolt-elements-textTertiary">
                Showing the {visibleTasks.length} most recent tasks; {tasks.length - visibleTasks.length} older tasks
                are kept in session state.
              </p>
            )}
            {visibleTasks.map((task) => {
              const isDetailsOpen = expandedTaskId === task.taskId;
              const detailsId = `${task.taskId}-details`;
              const elapsed = formatElapsed((task.completedAt ?? now) - task.createdAt);

              return (
                <div
                  key={task.taskId}
                  className="relative flex flex-col overflow-hidden rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-sm"
                >
                  <button
                    type="button"
                    className="group flex min-h-14 w-full items-start gap-3 p-3 text-left hover:bg-bolt-elements-background-depth-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bolt-elements-borderColorActive"
                    onClick={() => setExpandedTaskId(isDetailsOpen ? null : task.taskId)}
                    aria-expanded={isDetailsOpen}
                    aria-controls={detailsId}
                  >
                    <span className="mt-0.5 shrink-0">{statusIcon(task.status)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-mono text-xs font-semibold text-bolt-elements-textPrimary">
                          {task.taskId}
                        </span>
                        <span
                          className={classNames(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            statusClasses(task.status),
                          )}
                        >
                          {statusLabel(task.status)}
                        </span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-bolt-elements-textSecondary">
                        {task.task || 'Working on the delegated task'}
                      </span>
                      <span className="mt-1 block text-[11px] text-bolt-elements-textTertiary">
                        {task.model} · {elapsed}
                      </span>
                    </span>
                    <span
                      className={classNames(
                        'i-ph:caret-down mt-0.5 shrink-0 text-bolt-elements-textTertiary transition-transform duration-200',
                        {
                          'rotate-180': isDetailsOpen,
                        },
                      )}
                      aria-hidden="true"
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {isDetailsOpen && (
                      <motion.div
                        id={detailsId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: cubicEasingFn }}
                        className="overflow-hidden"
                        role="region"
                        aria-label={`${statusLabel(task.status)} subagent details`}
                      >
                        <div className="space-y-3 border-t border-bolt-elements-borderColor px-3 pb-3 pt-3 text-xs">
                          <div>
                            <div className="mb-1 font-medium text-bolt-elements-textSecondary">Delegated task</div>
                            <p className="whitespace-pre-wrap break-words text-bolt-elements-textPrimary">
                              {task.task || 'No task description was provided.'}
                            </p>
                          </div>
                          <div>
                            <div className="mb-1 font-medium text-bolt-elements-textSecondary">Model</div>
                            <p className="break-all font-mono text-bolt-elements-textPrimary">{task.model}</p>
                          </div>
                          {task.error && (
                            <div>
                              <div className="mb-1 font-medium text-bolt-elements-icon-error">Error</div>
                              <p className="whitespace-pre-wrap break-words text-bolt-elements-icon-error">
                                {task.error}
                              </p>
                            </div>
                          )}
                          {task.result && (
                            <div>
                              <div className="mb-1 font-medium text-bolt-elements-textSecondary">Result</div>
                              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bolt-elements-background-depth-1 p-2 font-mono text-[11px] leading-relaxed text-bolt-elements-textPrimary">
                                {task.result}
                              </pre>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
