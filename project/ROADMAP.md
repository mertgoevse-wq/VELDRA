# VELDRA Roadmap

This roadmap reflects implemented behavior and explicitly separates contracts from runtime features.

## Current priorities

1. Finish the global ESLint backlog in small, reviewable slices.
2. Re-run production and Android builds in a dependency-complete, memory-capable environment.
3. Add runtime integration tests for Remote Runtime authentication, CORS, WebSocket upgrades, workspace isolation, and allowlisted commands.
4. Reconcile the execution contracts with VELDRA runtime modes before wiring autonomous execution.
5. Verify provider/model metadata from primary sources before promoting catalog entries.

## Product capabilities

- **Implemented foundations:** provider registry, capability-based routing contracts, bounded budgets, entitlement policies, Image Studio unavailable state, Android fallback runtime, Remote Runtime allowlisted commands, and VELDRA update manifest boundary.
- **Contract-only:** autonomous agents/subagents, signed catalog updates, local-model compatibility scoring, Hugging Face discovery, LAN runtime discovery, and real image generation provider integrations.
- **Unavailable by design:** image generation without a verified provider or credentials; Android local shell execution without a supported runtime.

## Release gates

A feature is not considered complete until its implementation path, validation, security boundary, and documentation are present. Live provider or device validation must be labeled separately from unit/contract coverage.
