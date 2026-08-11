# VELDRA Design System — Research & Direction

**Loop 20, 2026-08-11.** Research and concept only — no visual redesign was implemented in this loop (that's explicitly Loop 19's territory, already partially done: responsive fixes, hero-art integration, and the `data-skin` token-layer plumbing). This document grounds a future design-system build-out in real, current (2025-2026) reference points and in what already exists in this codebase, per "Nicht alles neu erfinden. Bestehende Architektur verwenden."

---

## 1. What already exists (build on this, don't replace it)

`app/styles/variables.scss` already defines a real, comprehensive CSS-custom-property token system — roughly 80 `--bolt-elements-*` variables (borders, background depths, text colors, button states, item states, code/message/artifact surfaces, terminal ANSI colors) gated by `:root[data-theme='light']` / `:root[data-theme='dark']` attribute selectors, synced from a nanostore (`app/lib/stores/theme.ts`) via a pre-hydration inline script (no flash-of-unstyled-content) plus a `useEffect` in `app/root.tsx`.

**Loop 19 already extended this** with a second, orthogonal attribute layer: `data-skin` (`app/lib/stores/skin.ts`), mirroring `theme.ts`'s exact pattern, with one real working example — `obsidian` — that overrides only background/border/surface tokens (`--bolt-elements-bg-depth-1..4`, `borderColor`, `artifacts/actions/messages/prompt/terminals-background`), verified via `getComputedStyle` to actually resolve. `veldra` (today's shipping palette) is the explicit default with zero override, so the mechanism is provably additive — it changes nothing about the UI a user sees today until a skin is actively selected, and no UI to select one exists yet (deliberately — see Loop 19's own report).

**What this document is for**: the mandate's §6/§12/§13 ask for a much larger skin catalog (13 named directions) and a fuller token vocabulary (font, weight, size, letter-spacing, line-height, corner-radius, border-thickness, shadow, blur, opacity, contrast, density, animation-speed) than the color-only tokens that exist today. The plumbing pattern is proven; what's missing is (a) more token *categories* beyond color, and (b) the actual palette designs for the other 12 skins, which are real design decisions, not something to fabricate blind.

---

## 2. Research findings — direct implications for VELDRA

Full raw findings (with every source URL) are in the Loop 20 research agent transcripts; condensed and translated into concrete VELDRA decisions below.

### 2.1 What real, current AI products actually do (not what they claim)

- **ChatGPT mobile (2026)**: no custom typeface at all — runs the native system-font stack per platform (SF Pro/iOS, Roboto/Android, Segoe UI/Windows, Inter/web) specifically to feel platform-native over having brand personality in the reading experience. OpenAI has also publicly walked back an over-complex desktop-app redesign ("it's kind of a mess," their own framing) — a live cautionary example that more surface area/tabs is not automatically better information architecture.
- **Claude mobile/web — the most concrete, citable reference found**: pairs a **humanist sans for UI/body** (StyreneB, proprietary; public substitute **Inter**) with a **literary/slab serif for display/headlines** (Copernicus, proprietary; public substitute **Tiempos Headline**), plus **JetBrains Mono** for code. This deliberate serif-for-display choice is explicitly to avoid "feeling like every other AI tool" — nearly every competing AI product defaults to one geometric/humanist sans for everything. Voice input has two distinct entry points at two distinct depths (a mic icon for one-shot dictation, a separate sound-wave icon for a sustained Voice Mode conversation) rather than one overloaded control.
- **Claude Code (terminal + VS Code)**: the terminal UI is built with React + Ink (React components rendered to a terminal, not raw ANSI manipulation) — a real engineering pattern, not just a visual one, worth remembering if VELDRA ever ships its own CLI. The VS Code extension's entire UI reduces to four primitives — prompt box, `@`-mentions tied to selection, side-by-side diffs with permission gates, session history — with everything else being decoration. "Four primitives, rest is decoration" is a genuinely useful design-economy test to apply to VELDRA's own chat/workbench UI.
- **Base44 / Emergent.sh** (AI app builders, closest functional peers to VELDRA's own "describe an idea → get an app" ambition): Base44 supports single-word style injection in the prompt ("claymorphism," "glassmorphism") to steer generated-app aesthetics, and is explicit that its click-to-edit visual editor does **not** support deep layout changes — a real, named limitation worth knowing before over-promising direct-manipulation editing. Emergent.sh's agent asks clarifying questions rather than one-shotting, and self-verifies by screenshotting the running app against the original prompt — a visual self-diagnosis loop, not just a unit-test loop.

### 2.2 "AI is working" states — converging, and worth partly avoiding

Shimmer text (a left-to-right gradient sweep over "Generating…") has become the default "thinking" indicator across the industry, to the point that design writer Jim Nielsen named shimmering text + tiny sparkle icons + beige/cream/orange palettes as *the* recognizable "AI aesthetic" of 2025-2026. **Recommendation: VELDRA should not lean on this verbatim if it wants to read as its own product rather than a generic AI wrapper** — a distinct progress visualization (mandate §15's own "a small cube/pixel-core that assembles as progress advances" idea) is a genuine differentiator here, not decoration.

What *is* worth keeping regardless of house style, because it's a real, measured UX win, not an aesthetic trend:
- **Skeleton loaders shaped like the incoming content** (card/table/form) make waits feel ~30-40% shorter than a blank panel + spinner, by setting a structural expectation.
- **Streaming text itself** is the single biggest perceived-latency win found in this research — 55-70% reduction in perceived wait vs. non-streamed output of identical actual duration, because the user starts reading before generation finishes. VELDRA's existing streaming chat responses already capture most of this benefit — the remaining opportunity is applying the same principle to *build* steps (file writes, terminal output), not just chat text.
- Rule of thumb confirmed across multiple sources: a typing-indicator/shimmer affordance implies conversational text is coming; a skeleton placeholder implies *structured* content (a card, a table, a generated file tree) is coming. Match the loading affordance to the shape of what's actually arriving.

### 2.3 Layout / interaction patterns

- **Bottom sheets are the 2026-standard pattern for "anything that doesn't deserve a full-screen takeover"** — settings, filters, confirmations, previews, model/provider pickers. Standard on iOS since `UISheetPresentationController` (iOS 15), equally standard on Android via Material. Rationale is thumb ergonomics: ~75% of phone interactions are single-thumb, and the comfortable reach zone is the bottom third of the screen. Direct implication for VELDRA: model selection, provider setup, and skin/theme pickers should default to bottom sheets on mobile, not full-screen navigation pushes or small dropdown popovers that risk off-screen clipping (exactly the class of bug fixed repeatedly in Loop 19's responsive audit).
- **Material 3 Expressive** (Android, May 2025+, backed by 46 studies/18,000+ participants — the most user-research-backed Material update yet): spring-physics-based motion replacing simple eased transitions, and **shape-morphing as a first-class animated primitive**, not just a static shape token.
- **iOS 26 "Liquid Glass"**: standard glass-surface corner radius 16pt, toolbars 22pt continuous. The one genuinely new, concrete, and portable technique here is **concentric corner radius** — a child element's radius is derived from its parent's radius minus its own padding, so nested containers (button-in-card-in-sheet) stay visually consistent without hand-tuning a radius value at every nesting level. This translates directly to a CSS custom-property convention (`--radius: calc(var(--radius-parent) - var(--padding))`) usable well outside SwiftUI — worth adopting as a corner-radius *rule*, not just a token.
- Minimum touch target cited consistently at **48px** across current design-system documentation.

### 2.4 Named visual style trends — real references, treated honestly

| Style | Real 2025-2026 reference | Confidence |
|---|---|---|
| Glassmorphism | frosted-glass layering now commonly paired with dynamic scroll-linked background blur | Solid, multiple sources |
| Neo-brutalism / "soft brutalism" | raw system fonts + unstyled buttons + high-contrast blocks; a "usable" variant softens this with bold borders + friendly fonts + generous whitespace | Solid |
| Bento grid | still trending mid-2026, strongest fit for e-commerce/retail-style modular content | Solid, but a weaker fit for a single-focus chat/dev tool like VELDRA — flagged, not recommended as a primary layout |
| Editorial/magazine-style UI, gradient-mesh backgrounds | only appeared in passing aggregator listicles, no single strong primary example found | **Lower confidence — do not treat as a confirmed distinct trend** |

---

## 3. Typography recommendation

The mandate explicitly wants a **VELDRA Brand Font** (logo/headline use) distinct from a **UI Font** (body/labels, user-selectable later) — Claude's real production pairing (serif display + humanist sans body) is the strongest evidence this two-font approach is a genuine differentiator worth having, not extra complexity for its own sake.

| Role | Recommendation | License | Why |
|---|---|---|---|
| **UI font** (default, user-selectable later) | **Inter** | SIL OFL — unambiguous free commercial use | Already the field's safe default (it's literally Claude's own public substitute for its proprietary UI font); huge language coverage, variable font, highly legible at small sizes |
| **Brand/display font** (logo, headlines, marketing surfaces) | **Space Grotesk** | SIL OFL v1.1 | Distinctive geometric grotesque with real character — echoes the "don't default to the same sans everywhere" lesson from Claude's Copernicus/StyreneB pairing, without the licensing complexity of a paid foundry |
| **Code font** | **JetBrains Mono** | Apache 2.0 | Already what the field (including Claude.ai itself) converges on for code; VELDRA's CodeMirror integration should confirm this is already in use, and if not, adopt it |

**Explicitly flagged, not recommended without further verification**: Cabinet Grotesk and General Sans (Fontshare/ITF) both surfaced as strong candidates but carry **non-OFL, closed-source-with-free-personal-use licensing** requiring direct contact with the Indian Type Foundry for commercial terms — do not adopt either as a shipping brand font without confirming exact commercial terms first. Tiempos Headline (Anthropic's own public substitute reference) is a **paid Klim Type Foundry license**, not free — cite as a design reference, not an adoptable asset.

**Recommendation for `project/DECISIONS.md`**: Inter + Space Grotesk + JetBrains Mono is the pairing with zero licensing ambiguity that still captures the "distinctive display, legible body" lesson from the strongest real-world reference found.

---

## 4. Design token vocabulary — extending the existing system

The mandate wants user-controllable: font, weight, size, letter-spacing, line-height, corner-radius, border-thickness, shadow, blur, opacity, contrast, density, spacing, animation-speed. Today's `variables.scss` covers **color only**. Recommended additive token categories (new CSS custom properties, same `--bolt-elements-*`-adjacent naming convention, same `[data-theme]`/`[data-skin]` cascade mechanism already proven in Loop 19 — no new mechanism needed):

- `--veldra-font-ui`, `--veldra-font-brand`, `--veldra-font-mono` — font-family tokens, swappable independent of color skin
- `--veldra-radius-xs/sm/md/lg/xl` — a scale, plus the concentric-radius *calculation convention* from §2.3 applied at component boundaries rather than hard-coded per component
- `--veldra-border-width` — thin/default/bold, mapped to a "high contrast" accessibility mode (mandate's own "High Contrast" skin) increasing this alongside color-contrast changes
- `--veldra-shadow-sm/md/lg` — with an explicit "none" density-mode value, since heavy shadows are one of the first things a "reduce visual noise" density setting should strip
- `--veldra-density-comfortable/compact` — a spacing-scale multiplier, not a second full token set — density should scale existing spacing tokens rather than requiring every component to hand-author two variants
- `--veldra-motion-duration-fast/base/slow` plus a hard `prefers-reduced-motion` override setting all three to `0ms` — the reduced-motion behavior must be a token-level override, not a per-component `if` check scattered through the codebase

This is a **plan**, not an implementation — none of these tokens exist yet. Sizing this correctly (which categories are genuinely worth per-skin variation vs. global constants) is real design work belonging to a dedicated slice, not something to rush into this research loop.

---

## 5. The 13 named skins — status per name

The mandate lists: VELDRA, Claude-inspired, Obsidian, Anthracite, Midnight, Aurora, Ocean, Ember, Forest, Rose, Lavender, Arctic, High Contrast.

| Skin | Status | Note |
|---|---|---|
| **VELDRA** | ✅ Shipping (default, zero-override) | Today's actual palette |
| **Obsidian** | ✅ Built + verified in Loop 19 | Deep near-black surfaces, dark-mode only; proof that the `data-skin` mechanism works end-to-end |
| Claude-inspired | Not designed | Per the mandate's own instruction: "nur eine Farbstimmung/ästhetische Richtung. Keine Marken kopieren." — a warm, restrained, editorial mood (cream/off-white surfaces, muted rust/terracotta accent, generous whitespace) is directionally what "Claude-inspired but not Claude" would mean, based on the real typography/color research above — but the actual palette values are a design decision requiring visual QA this loop didn't have, not something to hard-code from a text description |
| Anthracite, Midnight, Aurora, Ocean, Ember, Forest, Rose, Lavender, Arctic | Not designed | Each is a genuine palette/contrast/mood decision. Fabricating 12 unverified color sets in a research pass would be exactly the "AI slop" this project explicitly avoids per its own stated principles (visible throughout this session's prior loops) |
| High Contrast | Not designed, but **highest-priority of the undesigned set** | This one is not primarily aesthetic — it's an accessibility requirement (WCAG contrast ratios), which means it has an objective, checkable target rather than a subjective mood, making it the most tractable of the remaining 12 to build correctly without a designer's visual judgment call |

**Recommendation**: build High Contrast next (objective target, directly reuses the `--veldra-border-width`/contrast tokens from §4), then let the product owner pick 2-3 of the remaining mood-based skins to prioritize by name rather than building all 10 speculatively.

---

## 6. Motion design — resource-efficient options

| Approach | File-size/overhead | Best for |
|---|---|---|
| **CSS-only** (transform/opacity animations) | Zero dependency overhead, GPU-accelerated, browser-optimized | Default choice for basic loading/thinking indicators — cheapest, most battery-friendly, matches the industry-standard shimmer pattern if VELDRA wants it for secondary states |
| **Lottie** (prefer newer **dotLottie/.lottie** format) | dotLottie's ZIP compression cuts file size 40-70% vs raw Lottie JSON | Reserve for a small number of branded moments (onboarding, a signature "agent is building" animation), not routine spinners |
| **Rive** | Binary `.riv`, typically 50-80% smaller than equivalent Lottie JSON; state-machine model encodes all interactive states of one component in a single file; but its WASM runtime adds a fixed ~200KB bundle overhead | Only worth the fixed overhead if VELDRA ends up with several interactive animated components sharing the runtime, not for one or two simple effects |

**`prefers-reduced-motion` is universally expected** across all three approaches. CSS handles it natively via the media query; Lottie/Rive implementations must **explicitly** check it and fall back to a static frame or simple fade — this is not automatic in either library and must be built in, not assumed.

**Recommendation for the mandate's own progress-visualization idea** (a cube/pixel-core assembling as progress advances): this is exactly the kind of single, high-value, branded moment Lottie/dotLottie is well-suited for — a good candidate to actually design once the product owner confirms the direction, not to build purely from a text description in a research pass.

---

## 7. What this document deliberately does not do

Per the mandate's own Loop 20 framing ("Noch keine riesigen Feature-Implementierungen... primär RESEARCH, ARCHITECTURE, PRIORITIZATION"): no new CSS was written, no new tokens were added to `variables.scss`, no skin beyond the already-shipped `obsidian` was designed, and no settings UI for any of this was built. This document is the grounding for that work, prioritized in `VELDRA-PRODUCT-ROADMAP.md`.
