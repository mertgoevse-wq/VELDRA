# VELDRA Template & Skin System

VELDRA has two distinct visual abstraction layers.

## Skins

Skins control visual language:

- typography
- colors
- surfaces
- borders
- shadows
- radii
- spacing
- motion
- component appearance

Initial visual families:

- Glass
- Neo
- Clay
- Skeuo
- Minimal
- Maximal
- Brutalist
- Liquid
- Spatial

## Templates

Templates are reusable application compositions. The list below previously described an
aspirational/architecture-vision set that never matched what's actually implemented — corrected
2026-08-17 against `app/lib/templates.ts`'s real `VELDRA_TEMPLATES` array, the source of truth:

- AI Chat
- Code Workspace
- Agent Workspace
- Model Laboratory
- Prompt Studio
- Project Overview
- Terminal
- Monitoring

("Dashboard", "Chat Workspace" (the real one is named "AI Chat"), "Workflow Builder",
"MCP Workspace", "Settings", and "Orchestration" have no corresponding entry in
`app/lib/templates.ts` today — do not reference them as available templates.)

External repositories are references.

Templates and skins implemented in VELDRA must be VELDRA-native.
