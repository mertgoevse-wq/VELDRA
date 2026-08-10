import { afterEach, describe, expect, it } from 'vitest';
import {
  composeMessageWithProjectBrief,
  hasProjectBriefDetails,
  projectBriefStore,
  resetProjectBrief,
  setProjectBriefField,
} from './projectBrief';

describe('projectBrief', () => {
  afterEach(() => {
    resetProjectBrief();
  });

  it('reports no details for an empty brief', () => {
    expect(hasProjectBriefDetails({})).toBe(false);
  });

  it('reports no details for a brief with only whitespace fields', () => {
    expect(hasProjectBriefDetails({ visualStyle: '   ', integrations: '' })).toBe(false);
  });

  it('reports details once any field is set', () => {
    expect(hasProjectBriefDetails({ platform: 'android' })).toBe(true);
    expect(hasProjectBriefDetails({ offlineRequired: true })).toBe(true);
  });

  it('leaves the message completely unchanged when the brief is empty -- Quick Start stays untouched', () => {
    expect(composeMessageWithProjectBrief('Build me a todo app', {})).toBe('Build me a todo app');
  });

  it('prepends a readable preamble for a filled-in Guided Build brief', () => {
    const message = composeMessageWithProjectBrief('Build me a habit tracker with a calendar and statistics.', {
      platform: 'android',
      visualStyle: 'minimal, dark mode',
      integrations: 'local notifications',
      offlineRequired: true,
    });

    expect(message).toBe(
      'Project details:\n' +
        '- Platform: Android app\n' +
        '- Visual style: minimal, dark mode\n' +
        '- Required integrations: local notifications\n' +
        '- Must work fully offline (no required network calls).\n' +
        '\n' +
        'Build me a habit tracker with a calendar and statistics.',
    );
  });

  it('omits unset fields from the preamble instead of printing empty lines', () => {
    const message = composeMessageWithProjectBrief('Build me a blog.', { platform: 'web' });

    expect(message).toBe('Project details:\n- Platform: Web app\n\nBuild me a blog.');
  });

  it('trims whitespace-only optional fields out of the preamble', () => {
    const message = composeMessageWithProjectBrief('Build me an app.', {
      platform: 'both',
      visualStyle: '   ',
      integrations: '\t',
    });

    expect(message).toBe('Project details:\n- Platform: Web and Android app\n\nBuild me an app.');
  });

  it('setProjectBriefField updates a single field without clobbering the rest', () => {
    setProjectBriefField('platform', 'android');
    setProjectBriefField('visualStyle', 'playful');

    expect(projectBriefStore.get()).toEqual({ platform: 'android', visualStyle: 'playful' });
  });

  it('resetProjectBrief clears every field back to empty', () => {
    setProjectBriefField('platform', 'android');
    resetProjectBrief();

    expect(projectBriefStore.get()).toEqual({});
  });
});
