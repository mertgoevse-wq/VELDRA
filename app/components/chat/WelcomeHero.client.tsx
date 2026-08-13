import { useStore } from '@nanostores/react';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';
import { db, getAll, type ChatHistoryItem } from '~/lib/persistence';
import { profileStore } from '~/lib/stores/profile';
import { BUILD_PROMPTS, composeGreeting } from '~/lib/utils/greeting';
import { isCapacitor } from '~/lib/adapters/platform';

const ROTATE_INTERVAL_MS = 7000;
const MAX_RECENT_PROJECTS = 3;

function useRotatingLine(lines: readonly string[]): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || lines.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % lines.length);
    }, ROTATE_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [lines]);

  return lines[index] ?? lines[0];
}

function useRecentProjects(): ChatHistoryItem[] {
  const [items, setItems] = useState<ChatHistoryItem[]>([]);

  useEffect(() => {
    if (!db) {
      return;
    }

    getAll(db)
      .then((list) =>
        list
          .filter((item) => item.urlId && item.description)
          .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
          .slice(0, MAX_RECENT_PROJECTS),
      )
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return items;
}

export function WelcomeHero() {
  const profile = useStore(profileStore);
  const [now] = useState(() => new Date());
  const rotatingLine = useRotatingLine(BUILD_PROMPTS);
  const recentProjects = useRecentProjects();

  return (
    <div className="flex flex-col items-center">
      <div className="relative mb-5 flex h-14 w-14 items-center justify-center lg:h-16 lg:w-16">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-accent-500/20 blur-xl dark:bg-accent-400/25"
        />
        <img src="/veldra-mark-dark.png" alt="" className="relative hidden h-9 w-auto dark:block lg:h-10" />
        <img src="/veldra-mark-light.png" alt="" className="relative block h-9 w-auto dark:hidden lg:h-10" />
      </div>

      <h1
        className="mb-2 text-3xl font-bold text-bolt-elements-textPrimary lg:text-5xl animate-fade-in"
        style={{ fontFamily: 'var(--veldra-font-brand)' }}
      >
        {composeGreeting(now, profile.username)}
      </h1>

      <p
        aria-live="polite"
        className="mb-4 min-h-[1.75rem] text-md text-bolt-elements-textSecondary transition-opacity lg:text-xl animate-fade-in animation-delay-200"
      >
        {rotatingLine}
      </p>

      {recentProjects.length > 0 && !isCapacitor() && (
        <div className="mb-2 flex w-full flex-col items-center justify-center gap-2 px-2">
          <span className="text-xs uppercase tracking-wide text-bolt-elements-textTertiary">Continue</span>
          <div className="flex w-full flex-wrap items-center justify-center gap-2">
            {recentProjects.map((item) => (
              <a
                key={item.id}
                href={`/chat/${item.urlId}`}
                className="max-w-[calc(100vw-3rem)] truncate rounded-full border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 px-3 py-1.5 text-xs text-bolt-elements-textSecondary transition-theme hover:border-accent-500 hover:text-bolt-elements-textPrimary"
                title={item.description}
              >
                {item.description}
                {item.timestamp && (
                  <span className="ml-1.5 text-bolt-elements-textTertiary">
                    · {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
