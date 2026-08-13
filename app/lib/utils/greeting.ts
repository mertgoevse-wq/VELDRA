/**
 * Time-aware welcome greeting + rotating build prompts for the home/welcome screen.
 * Pure and side-effect free so the boundary hours can be unit tested directly.
 */

export function getTimeOfDayGreeting(date: Date = new Date()): string {
  const hour = date.getHours();

  if (hour < 5) {
    return 'Still up';
  }

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

export function composeGreeting(date: Date, name?: string): string {
  const greeting = getTimeOfDayGreeting(date);
  const trimmedName = name?.trim();

  return trimmedName ? `${greeting}, ${trimmedName}.` : `${greeting}.`;
}

/**
 * Original VELDRA-voiced lines, not lifted from Claude/ChatGPT wording.
 * Kept short and calm — this rotates slowly, it should never feel like a ticker.
 */
export const BUILD_PROMPTS = [
  'What do you want to build today?',
  'Describe an idea — VELDRA will help you plan it.',
  "Got a rough idea? That's enough to start.",
  'Ready for the next build?',
] as const;
