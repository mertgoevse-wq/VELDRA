// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import StarterTemplates from './StarterTemplates';

/**
 * Block 4 (product-integration mandate): desktop's StarterTemplates used to navigate away
 * to /git?url=... (a full page navigation to a brand-new chat) instead of seeding the
 * curated template into the CURRENT chat the way Android's TemplatePicker already does.
 * This proves the fix: selecting a template calls applyStarterTemplate with the real
 * template name/label (the same call getTemplates() expects), not a navigation.
 */

vi.mock('~/utils/constants', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/utils/constants')>();
  return {
    ...actual,
    STARTER_TEMPLATES: [
      { name: 'fake-react', label: 'Fake React', description: 'A fake template', githubRepo: 'fake-org/fake-react' },
    ],
  };
});

describe('StarterTemplates', () => {
  afterEach(() => {
    cleanup();
  });

  it('seeds the real template into the current chat via applyStarterTemplate, not a navigation', () => {
    const applyStarterTemplate = vi.fn();
    render(<StarterTemplates applyStarterTemplate={applyStarterTemplate} />);

    fireEvent.click(screen.getByTitle('Fake React'));

    expect(applyStarterTemplate).toHaveBeenCalledWith('fake-react', 'Fake React');
  });

  it('renders a button, not a link that would navigate away from the chat', () => {
    render(<StarterTemplates applyStarterTemplate={vi.fn()} />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('does not throw when applyStarterTemplate is not provided', () => {
    render(<StarterTemplates />);
    expect(() => fireEvent.click(screen.getByTitle('Fake React'))).not.toThrow();
  });
});
