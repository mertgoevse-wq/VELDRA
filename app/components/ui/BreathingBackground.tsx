/**
 * A slow, ambient radial-gradient glow (mandate section 14: "breathing background"). Pure CSS
 * (`.veldra-breathing-bg`, defined in app/styles/animations.scss) -- no canvas, no JS animation
 * loop, no React state -- so it renders identically on the server and costs nothing to mount.
 * Reduced-motion and dark-mode handling live in the CSS layer, not here, so any future consumer
 * gets both for free.
 */
export function BreathingBackground() {
  return <div aria-hidden="true" className="veldra-breathing-bg" />;
}
