import { useStore } from '@nanostores/react';
import { subagentsStore } from '~/lib/stores/subagents';
import { motion, AnimatePresence } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { useState } from 'react';

export function SubagentActivityWidget() {
  const subagents = useStore(subagentsStore);
  const tasks = Object.values(subagents);
  const [expanded, setExpanded] = useState(true);

  if (tasks.length === 0) return null;

  const runningCount = tasks.filter(t => t.status === 'running').length;

  return (
    <div className="flex flex-col gap-2 w-full mb-2">
      <div 
        className="flex items-center justify-between px-3 py-2 bg-bolt-elements-bg-depth-3/50 backdrop-blur rounded-lg border border-bolt-elements-borderColor cursor-pointer hover:border-bolt-elements-borderColorActive transition-colors shadow-sm"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {runningCount > 0 ? (
            <div className="i-svg-spinners:pulse-rings-2 text-accent-500 text-lg"></div>
          ) : (
            <div className="i-ph:check-circle text-green-500 text-lg"></div>
          )}
          <span className="text-sm font-medium text-bolt-elements-textPrimary">
            Subagent Fleet {runningCount > 0 ? `(${runningCount} active)` : '(Idle)'}
          </span>
        </div>
        <div className={classNames('i-ph:caret-down text-bolt-elements-textTertiary transition-transform duration-200', { 'rotate-180': expanded })}></div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: cubicEasingFn }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            {tasks.map(task => (
              <div key={task.taskId} className="flex flex-col p-3 bg-bolt-elements-bg-depth-2 rounded-lg border border-bolt-elements-borderColor shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-accent-500/5 group-hover:bg-accent-500/10 transition-colors pointer-events-none" />
                <div className="flex items-center justify-between mb-1 relative z-10">
                  <div className="flex items-center gap-2">
                    {task.status === 'running' && <div className="i-svg-spinners:90-ring-with-bg text-accent-500 text-sm"></div>}
                    {task.status === 'completed' && <div className="i-ph:check-circle text-green-500 text-sm"></div>}
                    {task.status === 'failed' && <div className="i-ph:warning-circle text-red-500 text-sm"></div>}
                    <span className="text-xs font-mono font-semibold text-bolt-elements-textPrimary">{task.taskId}</span>
                  </div>
                  <span className={classNames('text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded', 
                    task.status === 'running' ? 'bg-accent-500/20 text-accent-500' :
                    task.status === 'completed' ? 'bg-green-500/20 text-green-500' :
                    'bg-red-500/20 text-red-500'
                  )}>{task.status}</span>
                </div>
                <div className="text-xs text-bolt-elements-textSecondary truncate relative z-10">Model: {task.model}</div>
                {task.status === 'failed' && <div className="text-xs text-red-400 mt-1 truncate relative z-10">Error: {task.error}</div>}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
