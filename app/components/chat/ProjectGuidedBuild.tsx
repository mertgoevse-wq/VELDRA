import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { Checkbox } from '~/components/ui/Checkbox';
import { classNames } from '~/utils/classNames';
import {
  hasProjectBriefDetails,
  projectBriefStore,
  setProjectBriefField,
  type ProjectPlatform,
} from '~/lib/stores/projectBrief';

const PLATFORM_OPTIONS: Array<{ value: ProjectPlatform; label: string; icon: string }> = [
  { value: 'web', label: 'Web', icon: 'i-ph:globe' },
  { value: 'android', label: 'Android', icon: 'i-ph:device-mobile' },
  { value: 'both', label: 'Both', icon: 'i-ph:devices' },
];

/**
 * Optional structured details a user can attach to their first message before starting a new
 * project ("Guided Build"). Collapsed by default so "Quick Start" (type a description, hit send)
 * is unaffected -- the panel only changes anything once the user actually opens and fills it in.
 * Wiring: BaseChat.tsx's handleSendMessage reads projectBriefStore and folds it into the outgoing
 * message via composeMessageWithProjectBrief() only for the very first message of a chat.
 */
export function ProjectGuidedBuild() {
  const brief = useStore(projectBriefStore);
  const [expanded, setExpanded] = useState(false);
  const hasDetails = hasProjectBriefDetails(brief);

  return (
    <div className="max-w-2xl mx-auto w-full px-4 lg:px-0 mb-2">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex items-center gap-1.5 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary mx-auto transition-colors"
        aria-expanded={expanded}
      >
        <div className={expanded ? 'i-ph:caret-down' : 'i-ph:caret-right'} />
        Guided Build
        {hasDetails && !expanded && <span className="text-accent-500">· details added</span>}
      </button>

      {expanded && (
        <div className="mt-3 p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-left space-y-3">
          <div>
            <div className="text-xs font-medium text-bolt-elements-textSecondary mb-1.5">Platform</div>
            <div className="flex gap-2">
              {PLATFORM_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setProjectBriefField('platform', brief.platform === option.value ? undefined : option.value)
                  }
                  className={classNames(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                    brief.platform === option.value
                      ? 'bg-accent-500 text-white border-accent-500'
                      : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary border-bolt-elements-borderColor hover:border-accent-500/50',
                  )}
                >
                  <div className={option.icon} />
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="project-brief-style"
              className="text-xs font-medium text-bolt-elements-textSecondary mb-1.5 block"
            >
              Visual style <span className="text-bolt-elements-textTertiary">(optional)</span>
            </label>
            <input
              id="project-brief-style"
              type="text"
              value={brief.visualStyle ?? ''}
              onChange={(event) => setProjectBriefField('visualStyle', event.target.value)}
              placeholder="e.g. minimal, dark mode, playful"
              className="w-full px-3 py-1.5 rounded-md text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-accent-500/50"
            />
          </div>

          <div>
            <label
              htmlFor="project-brief-integrations"
              className="text-xs font-medium text-bolt-elements-textSecondary mb-1.5 block"
            >
              Required integrations <span className="text-bolt-elements-textTertiary">(optional)</span>
            </label>
            <input
              id="project-brief-integrations"
              type="text"
              value={brief.integrations ?? ''}
              onChange={(event) => setProjectBriefField('integrations', event.target.value)}
              placeholder="e.g. local notifications, a calendar view"
              className="w-full px-3 py-1.5 rounded-md text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor focus:outline-none focus:ring-2 focus:ring-accent-500/50"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary cursor-pointer">
            <Checkbox
              checked={brief.offlineRequired ?? false}
              onCheckedChange={(checked) => setProjectBriefField('offlineRequired', checked === true)}
            />
            Must work fully offline
          </label>

          <p className="text-xs text-bolt-elements-textTertiary">
            These details are added to your first message below — describe what you want to build, then send.
          </p>
        </div>
      )}
    </div>
  );
}
