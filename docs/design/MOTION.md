# VELDRA Motion Language

VELDRA uses motion to explain state, hierarchy, and spatial change—not to decorate every surface. The existing Framer Motion stack remains the only motion runtime, configured once in `app/root.tsx` with `MotionConfig reducedMotion="user"`.

## Principles

1. **State before spectacle** — movement should make a panel, task, or status change easier to understand.
2. **Short and directional** — use the shortest transition that communicates the relationship between two states.
3. **Progressive disclosure** — keep the first frame compact; reveal detail on intent, as in the subagent activity widget.
4. **Stable layout** — animate opacity, height, and position without making the chat composer jump unexpectedly.
5. **Respect the OS** — reduced motion is a product behavior, not an afterthought.

## Shared tokens and easing

Use `cubicEasingFn` from `app/utils/easings.ts` (`cubicBezier(0.4, 0, 0.2, 1)`) for ordinary UI transitions. The structural duration tokens live in `app/styles/variables.scss`:

- `--veldra-motion-duration-fast`: 120ms
- `--veldra-motion-duration-base`: 200ms
- `--veldra-motion-duration-slow`: 320ms
- `--veldra-motion-duration-theme`: 150ms

The shared `prefers-reduced-motion: reduce` rule sets these token durations to `0ms`. Framer Motion components additionally inherit the root `MotionConfig` preference. Do not add a component-level media-query fork unless a new interaction cannot be expressed through those two mechanisms.

## Approved patterns

### Panel and dialog transitions

Use a brief opacity/scale or directional slide for dialogs, sidebars, and workbench panels. The direction should match the panel's origin. Keep the normal transition at approximately 150–200ms.

### Progressive disclosure

For accordions, tool details, and agent details, use `AnimatePresence` with a height/opacity transition. The trigger must be a real button with `aria-expanded` and `aria-controls`; motion must not be the only indication of state.

`SubagentActivityWidget` is the reference implementation: the fleet summary expands the list, and each task independently reveals its task text, model, timing, system instructions, result, or error.

### Status changes

Use an icon or token color change for running, completed, and failed states. A running indicator may pulse, but the text status and accessible live label must remain usable when animation is disabled.

### Loading and progress

Prefer a stable skeleton or inline status row over a full-screen spinner. Indeterminate motion should be subtle and should stop when `prefers-reduced-motion` is enabled.

## Accessibility checklist

- Every animated disclosure is keyboard reachable.
- Every icon-only control has an accessible name or is `aria-hidden` when paired with text.
- Do not put essential information only in hover states.
- Avoid rapidly flashing, looping, or attention-seeking animation.
- Verify the reduced-motion experience still communicates active, completed, and failed states.
- On narrow screens, animated content must remain inside the viewport and be scrollable when details are long.

## Review guidance

When adding motion, document the state being explained, the chosen duration/easing, and the reduced-motion result. Validate the static end states before judging the animation. A component that is clear with motion disabled is the baseline VELDRA experience.
