import { map } from 'nanostores';

export interface SubagentTask {
  taskId: string;
  model: string;
  systemPrompt: string;
  task: string;
  status: 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

// A dictionary mapping taskId to their current state
export const subagentsStore = map<Record<string, SubagentTask>>({});
