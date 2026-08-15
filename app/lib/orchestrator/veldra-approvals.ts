import { map } from 'nanostores';
import type { ApprovalPort, ApprovalRequest, ApprovalResponse } from './adapters';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('veldra-approvals');

/**
 * VELDRA-app's ApprovalPort: a real pending-approval handoff, not a stub. request()
 * genuinely suspends -- the returned promise does not resolve until something calls
 * respond() with a decision. No UI consumes this yet (that's a later block per the
 * mandate that asked for this port); pendingApprovalsStore exists now specifically so
 * that UI can be added later without touching this file's runtime contract, the same
 * way subagentsStore already lets SubagentActivityWidget subscribe reactively to state
 * this module owns.
 */
export const pendingApprovalsStore = map<Record<string, ApprovalRequest>>({});

export interface VeldraApprovalPort extends ApprovalPort {
  /** Records a decision and resumes whatever called request() for this id. Returns false if the id isn't pending (already answered, or never existed). */
  respond(requestId: string, chosen: string, note?: string): boolean;

  /** Every request still awaiting a decision. */
  listPending(): ApprovalRequest[];
}

export function createVeldraApprovalPort(): VeldraApprovalPort {
  const resolvers = new Map<string, (response: ApprovalResponse) => void>();

  return {
    request(approval: ApprovalRequest): Promise<ApprovalResponse> {
      logger.info('Approval requested, awaiting a real decision', { kind: approval.kind, id: approval.id });

      pendingApprovalsStore.setKey(approval.id, approval);

      return new Promise<ApprovalResponse>((resolve) => {
        resolvers.set(approval.id, resolve);
      });
    },

    respond(requestId: string, chosen: string, note?: string): boolean {
      const resolve = resolvers.get(requestId);

      if (!resolve) {
        logger.warn('respond() called for an unknown or already-answered approval', { requestId });
        return false;
      }

      resolvers.delete(requestId);

      const { [requestId]: _removed, ...rest } = pendingApprovalsStore.get();
      pendingApprovalsStore.set(rest);

      resolve({ requestId, chosen, note, respondedAt: Date.now() });
      logger.info('Approval decision recorded', { requestId, chosen });

      return true;
    },

    listPending(): ApprovalRequest[] {
      return Object.values(pendingApprovalsStore.get());
    },
  };
}
