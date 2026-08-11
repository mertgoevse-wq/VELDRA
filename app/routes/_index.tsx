import { json, type MetaFunction } from '@remix-run/cloudflare';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { Header } from '~/components/header/Header';

export const meta: MetaFunction = () => {
  const description = 'VELDRA — a provider-agnostic AI development workbench.';

  return [
    { title: 'VELDRA' },
    { name: 'description', content: description },
    { property: 'og:title', content: 'VELDRA' },
    { property: 'og:description', content: description },
    { property: 'og:image', content: '/veldra-social-preview.png' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'VELDRA' },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: '/veldra-social-preview.png' },
  ];
};

export const loader = () => json({});

/**
 * Landing page component for VELDRA
 * Note: Settings functionality should ONLY be accessed through the sidebar menu.
 * Do not add settings button/panel to this landing page as it was intentionally removed
 * to keep the UI clean and consistent with the design system.
 */
export default function Index() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1">
      <Header />
      <ClientOnly fallback={<BaseChat />}>{() => <Chat />}</ClientOnly>
    </div>
  );
}
