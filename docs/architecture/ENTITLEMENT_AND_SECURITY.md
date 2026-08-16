# VELDRA — Entitlement, Auth, and APK Protection Architecture

**Status: design document, current-state audit + target architecture. Most of the target
architecture below is NOT built.** This file exists so premium/entitlement work has a real
design to build toward instead of being invented ad hoc, and so nobody accidentally ships a
product claim ("your subscription is enforced," "this can't be pirated") that the code doesn't
back up. Written 2026-08-16 against commit `a45c284` after a direct code audit — see each
section for exactly what was checked.

---

## 1. Current state — read this before designing anything

**VELDRA has no backend server of its own.** Confirmed by direct audit: every server-side
network call in the codebase is either a Remix loader proxying a third-party service (GitHub,
Netlify, Vercel, Supabase) using the *user's own* token, or the optional, separately-documented
Remote Runtime (command execution for the Android fallback shell — unrelated to accounts,
auth, or billing). There is no account system, no auth server, no licensing server, nothing
that could verify "is this user entitled to X" over the network today.

**Entitlement is entirely client-side.** `app/lib/orchestrator/entitlement.ts` defines a real,
well-structured tier model (`FREE | PREMIUM | PRO | DEVELOPER`, per-tier token budgets, a
capability list gated by tier), and `app/lib/stores/entitlement.ts` persists the current tier
to `localStorage`. Both files already say, in their own doc comments, that this is UI-only and
not a security boundary — that's not new information this doc is introducing, it's confirming
the existing self-documentation is accurate. Concretely:

- Exactly one live call site checks a capability (`'spawn-subagent'` in
  `app/lib/orchestrator/integration.ts`), and it's gated behind `VELDRA_USE_ORCHESTRATOR`
  (default off in production) — so in practice, nothing in the shipping app is currently
  blocked by a tier check.
- No UI component calls `setEntitlementTier`, `checkCapability`, or reads
  `entitlementCapabilitiesStore`. There is no upgrade prompt, no paywall, no settings screen
  for tier — a user cannot even manually change their own tier today, let alone pay for one.
- A patched build could set `localStorage['veldra_entitlement_tier'] = 'PRO'` and nothing would
  stop it, because nothing server-side is watching. This is expected and correct given there is
  no server — it is not a bug in the client code, it is the honest consequence of the backend
  not existing yet.

**No sign-in flow exists.** There is no "log in to VELDRA" anywhere in the app. What exists
under auth-shaped names is unrelated: GitHub OAuth connection (a third-party integration, not
VELDRA account auth), the Android-backend bearer token (`app/lib/.server/android-auth.ts` —
authenticates the *Android app* to *this backend*, not a user), and an unauthenticated local
display-profile stub in Settings (a name/avatar stored in `localStorage`, no password check).

**Storage threat model** (full detail: `docs/architecture/STORAGE_AND_SYNC.md` § Threat model,
kept authoritative there — not duplicated here): no encryption at rest exists anywhere.
Provider API keys, the GitHub token, and the Remote Runtime token are all plaintext, in
`localStorage` and/or cookies depending on which one. This matters for entitlement because a
device already compromised enough to read those plaintext credentials is also compromised
enough to flip a client-only tier flag — the two risks compound, they don't stack independently.

**No secrets are baked into the APK build.** Checked directly: `.env.example`'s `VITE_*`
tokens (GitHub/GitLab/Vercel/Netlify/Supabase) are placeholder examples for *developer*
integrations, never committed with real values. Provider API keys are never embedded at build
time — they're either typed in by the user at runtime (stored client-side, see above) or, for
the Android-backend bridge mode, resolved server-side from environment variables and never sent
to the Android client at all (`app/lib/.server/android-auth.ts`'s own doc comment: "Provider
keys stay in this backend's own environment... with no cookie-sourced keys"). This one
principle — never ship a real secret inside the distributed artifact — is already correctly
followed; nothing needed fixing here.

---

## 2. Target architecture: Auth → Session → Device Trust → Server Entitlement

This is the shape a real implementation should take when a backend exists. None of it is built.
Documented now so future work has a contract to build against instead of improvising one under
deadline pressure, and so today's client-side entitlement code (§1) has an obvious place to
plug into later without a rewrite.

```
┌─────────┐     ┌──────────┐     ┌──────────────┐     ┌──────────────────┐
│  Auth   │ --> │ Session  │ --> │ Device Trust │ --> │ Server Entitlement │
└─────────┘     └──────────┘     └──────────────┘     └──────────────────┘
 who is the      short-lived      is this a        does THIS session,
 user?           token, not       specific,         on THIS device,
                 the password     known install     get to do X right now?
```

### 2.1 Auth
- Identity provider: don't build a password system. Use an existing, audited identity provider
  (Google Sign-In is the obvious first choice on Android — Play Services is already the
  platform; email/passkey as a fallback for desktop/web where Play Services isn't available).
- **Passkeys over passwords, 2FA on account-sensitive actions only.** The mandate explicitly
  warns against requiring 2FA on every launch without justification — that's correct: 2FA
  belongs on account recovery, payment-method changes, and new-device sign-in, not on "open the
  app." A session token (below) is what authorizes ordinary use once signed in.
- Never store a long-lived password or raw credential client-side. Auth's job is to hand back a
  session, not to be re-checked constantly.

### 2.2 Session
- Short-lived access token (minutes-to-hours) + refresh token, standard OAuth2/OIDC shape.
  Access token goes in memory / a short-TTL secure store; refresh token needs the platform's
  real secure storage — Android Keystore-backed `EncryptedSharedPreferences` (or the
  Credential Manager API), not the plaintext `localStorage` pattern this app currently uses for
  every other token (§1). This is a concrete, checkable difference from how VELDRA stores
  credentials today — call it out explicitly in review, don't let the existing plaintext
  pattern get copy-pasted into session-token storage by habit.
- Session validity is re-checked server-side on each entitlement-relevant request, not cached
  indefinitely client-side. A revoked session should stop working within the access token's TTL
  at the outside.

### 2.3 Device Trust
- **Play Integrity API** (Android) is the real tool here, not invented anti-tampering. It gives
  a server-verifiable attestation that the calling app is a genuine, unmodified build installed
  through a legitimate channel, on a device that isn't rooted/compromised in ways Google can
  detect. This is what actually answers "is this a patched APK" — client-side tamper checks
  (checksum-your-own-APK, detect-root heuristics) are trivially defeated by the same patch that
  bypasses the entitlement check itself, so they add cost but not a real guarantee. Play
  Integrity's verdict is checked server-side, alongside the session token, not trusted from a
  client-reported flag.
- Device binding: associate a session with a device identifier server-side (VELDRA already has
  a stable per-device ID generator — `app/lib/identity/device.ts` — currently unused for
  anything; this is the natural reuse point) so a leaked session token is harder to replay from
  an unrelated device, and so "N devices per account" tier limits (if the product wants them)
  have something to count against.

### 2.4 Server Entitlement
- **This is the part that requires a real backend, and none exists yet** — see §1. The
  contract this doc proposes, for whenever that backend exists:
  - `GET /v1/entitlement` → `{ tier, expiresAt, capabilities[] }`, signed/short-TTL, called on
    app start and after any billing event; the client caches this response and treats it as the
    source of truth, replacing today's locally-set `localStorage` tier.
  - Every premium *server-side* action (anything the backend itself performs on the user's
    behalf — not client-only UI gating) re-checks entitlement at the point of use, not just at
    login. A tier downgrade mid-session should take effect without requiring the user to
    restart the app.
  - The client's existing `entitlement.ts`/`stores/entitlement.ts` capability-list shape
    (§1) is a reasonable UI-gating layer to keep even after a real backend exists — it decides
    what to *show*; the server decides what to *allow*. Losing that distinction (trusting the
    client's copy as authorization) is exactly the mistake this doc is warning against.
- **Billing**: Google Play Billing is the correct integration for Android in-app purchases and
  subscriptions — it handles payment, receipt validation, and subscription lifecycle, and Google
  already does fraud detection at that layer. The backend's job is to verify the purchase token
  Play Billing hands back (server-side, via the Play Developer API) before granting entitlement
  — never trust a client-reported "I bought it" flag. Not integrated today; no Play Billing
  code exists anywhere in this repo (confirmed by audit — zero hits).

### 2.5 What a copied/patched APK can and can't do under this design
Stated plainly, matching the mandate's own instruction not to claim impossible protection:

- **Can't**: get server-granted premium capabilities without a valid session + a Play
  Integrity verdict the backend accepts. Patching out the local tier check does nothing once
  the *server* — not the client — is what actually gates the capability.
- **Can**: still run as a fully-functional FREE-tier app (there's no DRM on the software
  itself, nor should there be — the mandate is explicit that "perfect DRM" isn't the goal).
  Can still have its UI-only capability list patched to *display* premium features — cosmetic,
  not functional, once real server checks exist; today, before those checks exist, patching the
  UI list is the only thing there is to patch, and it does nothing either way since nothing
  gates on it yet.
- **Can't** (today, accidentally, not by design): extract a real secret from the APK, because
  none is embedded there (§1).

---

## 3. APK code protection (Block 5) — what raising the cost actually looks like

Real reverse-engineering resistance is about **raising the cost of tampering and removing
anything worth stealing**, not making it impossible — an unmodified README claim like "can't be
cracked" would be false on any platform, Android included. What this repo does today, and what
it deliberately doesn't attempt:

**Done** (this round, commit `a45c284` — see that commit message for full verification detail):
- R8 minification + resource shrinking enabled for release builds (`minifyEnabled true`,
  `shrinkResources true`) — real code obfuscation via R8's default name-mangling, verified by
  an actual release build (12.8MB output vs. 22.2MB unminified debug).
- Release builds no longer ship the WebView remote-debugging bridge
  (`webContentsDebuggingEnabled`), cleartext HTTP, or mixed content — closing the three easiest
  ways to inspect/intercept a running instance without even needing to decompile anything.
- `android:allowBackup="false"` — a plaintext-credential-bearing app should not let Android
  Auto Backup copy that data off-device.
- Release signing scaffolding (`keystore.properties`, gitignored) exists so a real release
  build can actually be signed with a real key instead of shipping unsigned or on a leaked
  debug key — no real keystore exists in this environment yet, so this is plumbing, not a
  populated credential.

**Deliberately not attempted**, and why:
- **No custom native obfuscation beyond R8's defaults** (control-flow flattening, string
  encryption, anti-debug tricks). These add real engineering cost for marginal gain against a
  motivated attacker, and the actual asset worth protecting here — the product's client-side
  code — is a WebView-hosted **web app**, not compiled native logic. The real UI/business logic
  ships as readable, unminified JS/TS inside `assets/public` regardless of what R8 does to the
  thin native Capacitor shell around it. Anyone who wants to read VELDRA's client code can
  already do so by unzipping the APK and reading the bundled web assets — R8 doesn't touch
  those, and pretending otherwise would be the "impossible anti-copy protection" claim the
  mandate explicitly says not to make.
- **No client-side root/tamper detection.** As noted in §2.3, these are cheap to bypass with
  the same tooling used to bypass whatever they're protecting, so they mostly just complicate
  the codebase without changing the real security posture. Play Integrity (server-verified) is
  the credible version of this idea; anything client-only isn't.
- **JS bundle minification for the web asset payload itself** is a build-tooling question
  (Vite's own minifier, already runs for production builds) separate from the Android-specific
  R8/APK work this document covers — not evaluated here.

---

## 4. What to build first, if/when this becomes active work

In dependency order — each step is meaningless without the one before it:

1. Stand up *any* backend (even minimal) with real user accounts and a session issuer. Nothing
   below this line is buildable without it — confirmed repeatedly by direct audit throughout
   this document.
2. Wire real Google Sign-In (or equivalent) on Android, issuing the session shape in §2.2, with
   the refresh token in real secure storage (not `localStorage`).
3. Integrate Google Play Billing for the actual purchase flow, with server-side receipt
   verification (§2.4) before any entitlement is granted.
4. Replace `stores/entitlement.ts`'s locally-set tier with a real `GET /v1/entitlement` fetch,
   keeping the existing capability-list shape as the UI-gating layer on top of it.
5. Add Play Integrity verification to the entitlement check (§2.3) once 1-4 exist and there's a
   real capability worth protecting from a patched client.

Skipping straight to step 5 without 1-4 (i.e., adding tamper detection to a system with no
server to report to) would be exactly the "fake security boundary" this document exists to
avoid.
