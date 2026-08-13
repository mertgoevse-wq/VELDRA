import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { themeStore } from '~/lib/stores/theme';
import { SKINS, SKIN_DESCRIPTIONS, SKIN_LABELS, setSkin, skinStore, type Skin } from '~/lib/stores/skin';

/**
 * A real, live preview: the swatch carries its own `data-theme`/`data-skin` attributes, so it
 * resolves the exact same CSS custom properties (variables.scss) the app-wide switch does --
 * not a hand-drawn approximation. See variables.scss's skin-block selectors, which were
 * deliberately written without a `:root` restriction so they also match this scoped wrapper.
 */
function SkinSwatch({ skin, theme }: { skin: Skin; theme: 'light' | 'dark' }) {
  return (
    <div
      data-theme={theme}
      data-skin={skin}
      className="veldra-surface flex h-12 w-full shrink-0 items-center gap-2 overflow-hidden p-2"
    >
      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" />
      <div className="veldra-control h-4 flex-1 bg-bolt-elements-background-depth-3" />
    </div>
  );
}

export function SkinPicker() {
  const skin = useStore(skinStore);
  const theme = useStore(themeStore);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {SKINS.map((value) => {
        const isActive = value === skin;

        return (
          <button
            key={value}
            type="button"
            onClick={() => {
              setSkin(value);
              toast.success(`Skin set to ${SKIN_LABELS[value]}`);
            }}
            className={classNames(
              'flex flex-col gap-2 rounded-lg border p-2 text-left transition-theme',
              isActive
                ? 'border-accent-500 bg-accent-500/5'
                : 'border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-accent-500/40',
            )}
            aria-pressed={isActive}
          >
            <SkinSwatch skin={value} theme={theme} />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-bolt-elements-textPrimary">{SKIN_LABELS[value]}</span>
              {isActive && <div className="i-ph:check-circle-fill h-3.5 w-3.5 shrink-0 text-accent-500" />}
            </div>
            <span className="text-[11px] leading-snug text-bolt-elements-textTertiary">{SKIN_DESCRIPTIONS[value]}</span>
          </button>
        );
      })}
    </div>
  );
}
