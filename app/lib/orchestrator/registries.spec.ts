import { describe, expect, it } from 'vitest';
import type { CapabilityKind, CapabilitySource, ConnectorDefinition } from './registries';

describe('CapabilityKind', () => {
  it('includes connector and mcp-server alongside the existing kinds', () => {
    const kinds: CapabilityKind[] = ['agent', 'skill', 'prompt-pattern', 'method', 'connector', 'mcp-server'];
    expect(kinds).toHaveLength(6);
  });

  it('lets a CapabilitySource declare it provides connectors, reusing the existing discovery pipeline', () => {
    const source: CapabilitySource = {
      id: 'source-github',
      label: 'GitHub',
      location: 'builtin://connectors/github',
      license: 'n/a (builtin)',
      provenance: 'VELDRA-original',
      state: 'cataloged',
      provides: ['connector'],
      usableInProduct: true,
      lastVerified: Date.now(),
    };

    expect(source.provides).toContain('connector');
    expect(source.state).toBe('cataloged');
  });

  it('lets a CapabilitySource declare it provides an mcp-server', () => {
    const source: CapabilitySource = {
      id: 'source-example-mcp',
      label: 'Example MCP Server',
      location: 'https://example.com/mcp',
      license: 'MIT',
      provenance: 'third-party',
      state: 'discovered',
      provides: ['mcp-server'],
      usableInProduct: false,
      lastVerified: Date.now(),
    };

    expect(source.provides).toContain('mcp-server');
    expect(source.usableInProduct).toBe(false);
  });
});

describe('ConnectorDefinition', () => {
  it('models a not-yet-connected GitHub connector honestly', () => {
    const github: ConnectorDefinition = {
      id: 'connector-github',
      sourceId: 'source-github',
      name: 'GitHub',
      description: 'Repositories, branches, commits, pull requests, issues, actions.',
      capabilities: ['read repositories', 'create branches', 'open pull requests'],
      requiredCredentials: [{ kind: 'oauth', label: 'GitHub account', obtainUrl: 'https://github.com/settings/apps' }],
      permissions: [{ scope: 'repo:read', description: 'Read repository contents', required: true }],
      isEnabled: false,
      connectionStatus: 'not-configured',
      setupInstructions: ['Connect a GitHub account to enable repository access.'],
      securityNotes: ['Credentials are never sent to VELDRA-operated servers unless explicitly configured.'],
    };

    // Never fabricate a working connection -- these two must stay undefined until a real attempt happens.
    expect(github.lastConnectionCheckedAt).toBeUndefined();
    expect(github.lastConnectionError).toBeUndefined();
    expect(github.connectionStatus).toBe('not-configured');
    expect(github.isEnabled).toBe(false);
  });

  it('models isEnabled independently of a hypothetical vetted-but-off connector', () => {
    const localServer: ConnectorDefinition = {
      id: 'connector-local-openai-compatible',
      sourceId: 'source-local-openai-compatible',
      name: 'Local OpenAI-compatible server',
      description: 'A locally running Ollama/LM Studio/llama.cpp server exposing an OpenAI-compatible API.',
      capabilities: ['chat completion', 'model listing'],
      requiredCredentials: [{ kind: 'none', label: 'No credential required for local servers by default' }],
      permissions: [{ scope: 'network:lan', description: 'Reach a server on the local network', required: true }],
      isEnabled: false,
      connectionStatus: 'disconnected',
      setupInstructions: ['Enter the local server URL, e.g. http://192.168.x.x:11434.'],
      securityNotes: ['Most local servers do not enforce authentication -- only connect to trusted networks.'],
    };

    expect(localServer.isEnabled).toBe(false);
    expect(localServer.connectionStatus).toBe('disconnected');
  });
});
