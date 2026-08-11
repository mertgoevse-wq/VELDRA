# VELDRA Decisions

## D-001 Canonical repository

All productive changes target `mertgoevse-wq/VELDRA` on `origin/main`. Historical repositories may be inspected read-only but are not active workspaces.

## D-002 Provider-neutral boundaries

Provider, model, image, runtime, orchestration, budget, and entitlement behavior is expressed through contracts and capability evidence rather than UI-level provider branches or invented model metadata.

## D-003 Android fallback honesty

Android WebView does not claim WebContainer or local shell support. VELDRA uses IndexedDB/fallback adapters and can optionally connect to an authenticated Remote Runtime.

## D-004 Bounded execution

Budget ceilings, iteration limits, repeated-failure detection, and entitlement policies are mandatory boundaries. “Unlimited” is never represented by an unbounded numeric value.

## D-005 Remote Runtime authentication

`REMOTE_RUNTIME_TOKEN` is required. There is no predictable default credential; missing configuration fails closed. Tokens are compared with a timing-safe comparison. Query-token WebSocket clients remain a temporary compatibility path while subprotocol clients are preferred.

## D-006 CORS is defense in depth

Remote Runtime allows requests without a browser Origin for native/CLI clients, allows local development origins outside production, and requires exact `REMOTE_RUNTIME_ALLOWED_ORIGINS` entries for production browser origins. CORS is not authentication.

## D-007 No fake external capability

No image output, provider availability, model capability, device support, or release is presented as real without verification. Contracts and unavailable states are documented as such.

## D-008 No `.claude/` agent/skill infrastructure until a phase needs it

VELDRA does not maintain a `.claude/agents/` or `.claude/skills/` tree, and none should be added speculatively. A background-agent review of the `claude-code-best-practice` repository (MIT-licensed) during Loop 22 concluded VELDRA should apply its development *patterns* while building the product, not import its agent/skill collections into VELDRA's own repository. This decision had been informally cited by two prior loops (Loop 20's research summary, Loop 22 Slice 1) as "D-2" before it was actually written down here — recorded now so future sessions have a real entry to point to instead of an unverifiable citation.
