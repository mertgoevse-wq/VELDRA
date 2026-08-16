import express from 'express';
import cors from 'cors';
import http from 'http';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import url from 'url';
import dotenv from 'dotenv';

import { requireAuth, validateToken } from './auth.js';
import { isAllowedCorsOrigin } from './security.js';
import { createWorkspace, getWorkspacePath, isValidWorkspaceId } from './workspaces.js';
import {
  deleteWorkspaceFiles,
  getWorkspaceFileMetadata,
  getWorkspaceFilesWithContent,
  listFilesRecursively,
  readWorkspaceTextFile,
  writeWorkspaceFiles,
} from './files.js';
import {
  getCommand,
  isCommandProfile,
  listCommandProfiles,
  startCommand,
  stopCommand,
  type CommandEvent,
} from './commands.js';
import { getWorkspacePreview, observePreviewCommandEvent } from './preview.js';
import { gitStatus, gitInit, gitCommit, gitSetRemote, gitPush } from './git.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({
  noServer: true,
  handleProtocols: (protocols: Set<string>) => protocols.values().next().value ?? '',
});
const workspaceSockets = new Map<string, Set<WebSocket>>();

const PORT = parseInt(process.env.REMOTE_RUNTIME_PORT || '8787', 10);
const HOST = process.env.REMOTE_RUNTIME_HOST || '127.0.0.1';

app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin)),
  }),
);
app.use(express.json({ limit: '50mb' }));

function jsonError(res: express.Response, status: number, error: string) {
  res.status(status).json({ ok: false, error });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const escapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return escapes[char];
  });
}

function ensureWorkspaceExists(id: string) {
  const workspacePath = getWorkspacePath(id);

  return fs.existsSync(workspacePath);
}

function broadcastWorkspaceEvent(workspaceId: string, event: CommandEvent) {
  const sockets = workspaceSockets.get(workspaceId);

  if (!sockets) {
    return;
  }

  const payload = JSON.stringify(event);

  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }
}

function observeAndBroadcastWorkspaceEvent(workspaceId: string, event: CommandEvent) {
  observePreviewCommandEvent(workspaceId, event);
  broadcastWorkspaceEvent(workspaceId, event);
}

/**
 * GET /health
 */
app.get('/health', requireAuth, (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'veldra-remote-runtime',
    version: '1.0.0',
  });
});

/**
 * POST /workspace
 */
app.post('/workspace', requireAuth, (req, res) => {
  try {
    const workspaceId = 'ws_' + Math.random().toString(36).substring(2, 11);
    createWorkspace(workspaceId);
    console.log(`[RemoteRuntime] Created workspace: ${workspaceId}`);
    res.status(201).json({ workspaceId, createdAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('[RemoteRuntime] Error creating workspace', error);
    jsonError(res, 500, error.message || 'Internal server error');
  }
});

/**
 * GET /workspace/:id/files/content?path=...
 */
app.get('/workspace/:id/files/content', requireAuth, (req, res) => {
  const { id } = req.params;
  const filePath = typeof req.query.path === 'string' ? req.query.path : '';

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  if (!filePath) {
    jsonError(res, 400, 'Missing required query parameter: path.');
    return;
  }

  try {
    res.status(200).json(readWorkspaceTextFile(id, filePath));
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      jsonError(res, 403, error.message);
    } else if (error.message.includes('not text-safe')) {
      jsonError(res, 415, 'Only text-safe files can be read by the Remote Runtime file API.');
    } else {
      console.error(`[RemoteRuntime] Error reading file for ${id}`, error);
      jsonError(res, 500, error.message || 'Internal server error');
    }
  }
});

/**
 * GET /workspace/:id/files
 */
app.get('/workspace/:id/files', requireAuth, (req, res) => {
  const { id } = req.params;
  const includeContent = req.query.includeContent === 'true';

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  try {
    const files = includeContent ? getWorkspaceFilesWithContent(id) : listFilesRecursively(id);
    res.status(200).json({ files });
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      jsonError(res, 403, error.message);
    } else {
      console.error(`[RemoteRuntime] Error listing files for ${id}`, error);
      jsonError(res, 500, error.message || 'Internal server error');
    }
  }
});

/**
 * PUT /workspace/:id/files
 */
app.put('/workspace/:id/files', requireAuth, (req, res) => {
  const { id } = req.params;
  const { files, deletedPaths } = req.body;

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  if (!files || typeof files !== 'object') {
    jsonError(res, 400, 'Invalid payload: "files" object is required.');
    return;
  }

  if (Array.isArray(files)) {
    jsonError(res, 400, 'Invalid payload: "files" must be an object keyed by relative path.');
    return;
  }

  if (deletedPaths !== undefined && (!Array.isArray(deletedPaths) || deletedPaths.some((p) => typeof p !== 'string'))) {
    jsonError(res, 400, 'Invalid payload: "deletedPaths" must be an array of strings.');
    return;
  }

  try {
    writeWorkspaceFiles(id, files);

    const deleted = deletedPaths?.length ? deleteWorkspaceFiles(id, deletedPaths) : [];

    const filePaths = Object.keys(files);
    res.status(200).json({
      ok: true,
      writtenFileCount: filePaths.length,
      deletedFileCount: deleted.length,
      files: getWorkspaceFileMetadata(id, filePaths),
    });
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      jsonError(res, 403, error.message);
    } else if (error.message.includes('Invalid payload') || error.message.includes('Invalid file path')) {
      jsonError(res, 400, error.message);
    } else {
      console.error(`[RemoteRuntime] Error writing files for ${id}`, error);
      jsonError(res, 500, error.message || 'Internal server error');
    }
  }
});

/**
 * GET /workspace/:id/preview
 */
app.get('/workspace/:id/preview', requireAuth, (req, res) => {
  const { id } = req.params;

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  res.status(200).json(getWorkspacePreview(id, req.get('host')));
});

/**
 * GET /workspace/:id/preview-page
 */
app.get('/workspace/:id/preview-page', requireAuth, (req, res) => {
  const { id } = req.params;

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  const preview = getWorkspacePreview(id, req.get('host'));
  const escapedMessage = escapeHtml(preview.message);
  const escapedPreviewUrl = preview.previewUrl ? escapeHtml(preview.previewUrl) : undefined;

  res.status(200).send(`
    <html>
      <head>
        <title>Remote Preview Status</title>
        <style>
          body { font-family: sans-serif; background: #0b0b0f; color: #e2e8f0; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #181824; padding: 2rem; border-radius: 12px; border: 1px solid #2e2e3f; max-width: 520px; text-align: center; }
          h2 { color: #a855f7; margin-top: 0; }
          p { font-size: 0.9rem; color: #94a3b8; line-height: 1.5; }
          code { color: #e9d5ff; }
          a { color: #c084fc; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Remote Live Preview Status</h2>
          <p>Workspace ID: <strong>${id}</strong></p>
          <p>Status: <strong>${preview.status}</strong></p>
          <p>${escapedMessage}</p>
          ${
            preview.previewUrl
              ? `<p><a href="${escapedPreviewUrl}" target="_blank" rel="noreferrer">Open preview</a></p>`
              : '<p>For phone access, run Vite with <code>--host 0.0.0.0</code> and use your laptop LAN IP.</p>'
          }
        </div>
      </body>
    </html>
  `);
});

/**
 * POST /workspace/:id/commands
 */
app.post('/workspace/:id/commands', requireAuth, (req, res) => {
  const { id } = req.params;
  const { commandProfile } = req.body ?? {};

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  if (!isCommandProfile(commandProfile)) {
    jsonError(res, 400, `Invalid commandProfile. Allowed profiles: ${listCommandProfiles().join(', ')}.`);
    return;
  }

  try {
    const command = startCommand(id, getWorkspacePath(id), commandProfile, (event) => {
      observeAndBroadcastWorkspaceEvent(id, event);
    });
    res.status(202).json(command);
  } catch (error: any) {
    console.error(`[RemoteRuntime] Error starting command for ${id}`, error);
    jsonError(res, 500, error.message || 'Internal server error');
  }
});

/**
 * GET /workspace/:id/commands/:commandId
 */
app.get('/workspace/:id/commands/:commandId', requireAuth, (req, res) => {
  const { id, commandId } = req.params;

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  const command = getCommand(commandId);

  if (!command || command.workspaceId !== id) {
    jsonError(res, 404, 'Command not found.');
    return;
  }

  res.status(200).json(command);
});

/**
 * POST /workspace/:id/commands/:commandId/stop
 */
app.post('/workspace/:id/commands/:commandId/stop', requireAuth, (req, res) => {
  const { id, commandId } = req.params;

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  const command = getCommand(commandId);

  if (!command || command.workspaceId !== id) {
    jsonError(res, 404, 'Command not found.');
    return;
  }

  const stoppedCommand = stopCommand(commandId, (event) => {
    observeAndBroadcastWorkspaceEvent(id, event);
  });

  res.status(200).json(stoppedCommand);
});

/**
 * GET /workspace/:id/git/status
 */
app.get('/workspace/:id/git/status', requireAuth, async (req, res) => {
  const { id } = req.params;

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  try {
    const result = await gitStatus(getWorkspacePath(id));

    if (!result.ok) {
      jsonError(res, 500, result.error || 'Failed to check git status.');
      return;
    }

    res.status(200).json({ ok: true, status: result.status });
  } catch (error: any) {
    console.error(`[RemoteRuntime] Error in git status for ${id}`, error);
    jsonError(res, 500, error.message || 'Internal server error');
  }
});

/**
 * POST /workspace/:id/git/init
 */
app.post('/workspace/:id/git/init', requireAuth, async (req, res) => {
  const { id } = req.params;

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  try {
    const result = await gitInit(getWorkspacePath(id));

    if (!result.ok) {
      jsonError(res, 500, result.error || 'Failed to initialize git repository.');
      return;
    }

    res.status(200).json({ ok: true, output: result.output });
  } catch (error: any) {
    console.error(`[RemoteRuntime] Error in git init for ${id}`, error);
    jsonError(res, 500, error.message || 'Internal server error');
  }
});

/**
 * POST /workspace/:id/git/commit
 */
app.post('/workspace/:id/git/commit', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body ?? {};

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    jsonError(res, 400, 'Commit message is required and must be a non-empty string.');
    return;
  }

  try {
    const result = await gitCommit(getWorkspacePath(id), message);

    if (!result.ok) {
      jsonError(res, 500, result.error || 'Failed to commit changes.');
      return;
    }

    res.status(200).json({ ok: true, output: result.output });
  } catch (error: any) {
    console.error(`[RemoteRuntime] Error in git commit for ${id}`, error);
    jsonError(res, 500, error.message || 'Internal server error');
  }
});

/**
 * POST /workspace/:id/git/push
 */
app.post('/workspace/:id/git/push', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { token, repoUrl } = req.body ?? {};

  if (!isValidWorkspaceId(id)) {
    jsonError(res, 400, 'Invalid workspace ID format.');
    return;
  }

  if (!ensureWorkspaceExists(id)) {
    jsonError(res, 404, 'Workspace not found.');
    return;
  }

  try {
    // Set remote URL if provided
    if (repoUrl) {
      const remoteResult = await gitSetRemote(getWorkspacePath(id), repoUrl);

      if (!remoteResult.ok) {
        jsonError(res, 500, remoteResult.error || 'Failed to set remote URL.');
        return;
      }
    }

    const result = await gitPush(getWorkspacePath(id), token, repoUrl);

    if (!result.ok) {
      jsonError(res, 400, result.error || 'Push check failed.');
      return;
    }

    res.status(200).json({ ok: true, output: result.output });
  } catch (error: any) {
    console.error(`[RemoteRuntime] Error in git push for ${id}`, error);
    jsonError(res, 500, error.message || 'Internal server error');
  }
});

/**
 * WebSocket upgrade validation & attachment
 */
server.on('upgrade', (request, socket, head) => {
  const parsedUrl = url.parse(request.url || '', true);
  const pathname = parsedUrl.pathname || '';

  // Match /workspace/:id/events
  const match = pathname.match(/^\/workspace\/([a-zA-Z0-9_\-]+)\/events$/);

  if (!match) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();

    return;
  }

  const workspaceId = match[1];
  const queryToken = parsedUrl.query.token as string | undefined;

  if (!isValidWorkspaceId(workspaceId) || !ensureWorkspaceExists(workspaceId)) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();

    return;
  }

  /*
   * Prefer the WebSocket subprotocol so the token is not placed in URL logs.
   * Keep query-token support for existing clients during the migration.
   */
  const protocolsHeader = request.headers['sec-websocket-protocol'];
  const protocolToken = typeof protocolsHeader === 'string' ? protocolsHeader.split(',')[0].trim() : undefined;
  const token = queryToken ?? protocolToken;

  if (!validateToken(token)) {
    console.warn(`[RemoteRuntime] WebSocket upgrade rejected for workspace ${workspaceId}: Invalid token.`);
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();

    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request, workspaceId);
  });
});

/**
 * WebSocket Connection Handler
 */
wss.on('connection', (ws: WebSocket, request: http.IncomingMessage, workspaceId: string) => {
  console.log(`[RemoteRuntime] Client connected to events channel for workspace: ${workspaceId}`);

  const sockets = workspaceSockets.get(workspaceId) ?? new Set<WebSocket>();
  sockets.add(ws);
  workspaceSockets.set(workspaceId, sockets);

  // Send status connection event
  ws.send(
    JSON.stringify({
      type: 'status',
      timestamp: new Date().toISOString(),
      payload: { status: 'connected', workspaceId },
    }),
  );

  ws.on('message', (message) => {
    console.log(`[RemoteRuntime] Ignored WebSocket input in workspace ${workspaceId}: ${message}`);
    ws.send(
      JSON.stringify({
        type: 'status',
        timestamp: new Date().toISOString(),
        payload: {
          status: 'input_ignored',
          output: 'Free-form terminal input is disabled. Use command profiles only.\n',
        },
      }),
    );
  });

  ws.on('close', () => {
    const currentSockets = workspaceSockets.get(workspaceId);
    currentSockets?.delete(ws);

    if (currentSockets?.size === 0) {
      workspaceSockets.delete(workspaceId);
    }

    console.log(`[RemoteRuntime] Connection closed for workspace: ${workspaceId}`);
  });
});

/**
 * Start Server
 */
server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(` VELDRA — Remote Runtime Server  `);
  console.log(`====================================================`);
  console.log(` Running on: http://${HOST}:${PORT} `);
  console.log(` Workspaces: ${getWorkspacePath('example').replace('example', '')} `);
  console.log(` Mode: Sandboxed (Allowlisted command profiles only) `);
  console.log(`====================================================`);
});
