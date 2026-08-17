import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { Checkbox } from '~/components/ui/Checkbox';
import { classNames } from '~/utils/classNames';
import { isMobileDevice } from '~/utils/mobile';
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
 *
 * Rendered as a real `veldra-control`/`veldra-surface` affordance (not a bare text link) so it
 * reads as a first-class VELDRA entry point and actually changes appearance per skin, same as
 * Button/Dialog/Checkbox.
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
        className="veldra-control flex w-full items-center gap-3 bg-bolt-elements-background-depth-1 px-4 py-3 text-left hover:border-accent-500/40"
        aria-expanded={expanded}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-500/10 text-accent-500">
          <div className="i-ph:compass h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-bolt-elements-textPrimary">Guided Build</div>
          <div className="truncate text-xs text-bolt-elements-textTertiary">
            {hasDetails ? 'Details added — ready when you are' : 'Answer a few quick questions before you start'}
          </div>
        </div>
        <div
          className={classNames(
            'h-4 w-4 shrink-0 text-bolt-elements-textTertiary',
            expanded ? 'i-ph:caret-up' : 'i-ph:caret-down',
          )}
        />
      </button>

      {expanded && (
        <div className="veldra-surface mt-2 space-y-3 p-4 text-left">
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
                    'veldra-control flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium',
                    brief.platform === option.value
                      ? 'bg-accent-500 text-white border-accent-500'
                      : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:border-accent-500/50',

                    // 44dp touch minimum on touch surfaces; desktop keeps the tighter chip height.
                    isMobileDevice() && 'min-h-11',
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
              className="veldra-control w-full bg-bolt-elements-background-depth-1 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
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
              className="veldra-control w-full bg-bolt-elements-background-depth-1 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/50"
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
