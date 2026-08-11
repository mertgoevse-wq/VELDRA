import type { RunStore } from '~/lib/orchestrator/adapters';
import type { WorkflowRun } from '~/lib/orchestrator/types';
import { getOrchestratorRun, listOrchestratorRunIds, setOrchestratorRun } from './db';

/**
 * The VELDRA-app host's implementation of the orchestrator's RunStore port, backed by the
 * existing `boltHistory` IndexedDB database (see db.ts's `orchestratorRuns` object store) --
 * not a new persistence system. `db` may be undefined (persistence disabled, or `indexedDB` is
 * unavailable in this environment, same condition `openDatabase()` itself already guards against
 * elsewhere in this module); a host without a working RunStore is still a valid orchestrator host
 * per OrchestratorHost's own doc comment, so this degrades to a safe no-op rather than throwing.
 */
export function createIndexedDBRunStore(db: IDBDatabase | undefined): RunStore {
  return {
    async save(runId: string, serialized: string): Promise<void> {
      if (!db) {
        return;
      }

      await setOrchestratorRun(db, runId, serialized);
    },

    async load(runId: string): Promise<string | null> {
      if (!db) {
        return null;
      }

      const result = await getOrchestratorRun(db, runId);

      return result ?? null;
    },

    async list(): Promise<string[]> {
      if (!db) {
        return [];
      }

      return listOrchestratorRunIds(db);
    },
  };
}

/**
 * Typed convenience wrapper around RunStore for the one shape the VELDRA app actually persists
 * today (a full WorkflowRun). RunStore itself stays string-in/string-out per its own contract
 * (app/lib/orchestrator/adapters.ts) so the core never depends on a serialization format; this is
 * the host-side edge where that string becomes a typed object again.
 *
 * Deliberately NOT schema-validated on load: `JSON.parse` + a type assertion, not a runtime shape
 * check. A record written by a future, differently-shaped WorkflowRun would currently come back
 * looking valid but be wrong -- that's a real, known gap (versioned migration is future work, see
 * project/research/VELDRA-PRODUCT-ROADMAP.md), not something to silently paper over here.
 */
export async function saveWorkflowRun(store: RunStore, run: WorkflowRun): Promise<void> {
  await store.save(run.id, JSON.stringify(run));
}

export async function loadWorkflowRun(store: RunStore, runId: string): Promise<WorkflowRun | null> {
  const serialized = await store.load(runId);

  if (serialized === null) {
    return null;
  }

  return JSON.parse(serialized) as WorkflowRun;
}

export async function listWorkflowRunIds(store: RunStore): Promise<string[]> {
  return store.list();
}
