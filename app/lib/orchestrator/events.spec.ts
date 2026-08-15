import { describe, it, expect } from 'vitest';
import { createWorkflowEvent, createWorkflowEventEmitter } from './events';

describe('createWorkflowEvent', () => {
  it('builds an event with the given fields and sensible defaults for id/at', () => {
    const event = createWorkflowEvent('run-1', 'run.started', { taskCount: 3 });

    expect(event.runId).toBe('run-1');
    expect(event.type).toBe('run.started');
    expect(event.data).toEqual({ taskCount: 3 });
    expect(typeof event.id).toBe('string');
    expect(event.id.length).toBeGreaterThan(0);
    expect(typeof event.at).toBe('number');
    expect(event.taskId).toBeUndefined();
  });

  it('accepts an explicit taskId, id, and timestamp', () => {
    const event = createWorkflowEvent('run-1', 'agent.completed', { output: 'done' }, 'task-1', 'evt-fixed', 12345);

    expect(event.taskId).toBe('task-1');
    expect(event.id).toBe('evt-fixed');
    expect(event.at).toBe(12345);
  });
});

describe('createWorkflowEventEmitter', () => {
  it('delivers emitted events to subscribed listeners in emission order', () => {
    const emitter = createWorkflowEventEmitter();
    const received: string[] = [];

    emitter.subscribe((event) => received.push(event.type));

    emitter.emit(createWorkflowEvent('run-1', 'run.started', {}));
    emitter.emit(createWorkflowEvent('run-1', 'agent.started', {}));
    emitter.emit(createWorkflowEvent('run-1', 'run.completed', {}));

    expect(received).toEqual(['run.started', 'agent.started', 'run.completed']);
  });

  it('supports multiple independent listeners', () => {
    const emitter = createWorkflowEventEmitter();
    const a: string[] = [];
    const b: string[] = [];

    emitter.subscribe((event) => a.push(event.type));
    emitter.subscribe((event) => b.push(event.type));

    emitter.emit(createWorkflowEvent('run-1', 'run.started', {}));

    expect(a).toEqual(['run.started']);
    expect(b).toEqual(['run.started']);
  });

  it('stops delivering to a listener once its unsubscribe function is called', () => {
    const emitter = createWorkflowEventEmitter();
    const received: string[] = [];

    const unsubscribe = emitter.subscribe((event) => received.push(event.type));
    emitter.emit(createWorkflowEvent('run-1', 'run.started', {}));
    unsubscribe();
    emitter.emit(createWorkflowEvent('run-1', 'run.completed', {}));

    expect(received).toEqual(['run.started']);
  });

  it('history() returns every event emitted so far, independent of subscribers', () => {
    const emitter = createWorkflowEventEmitter();

    emitter.emit(createWorkflowEvent('run-1', 'run.started', {}));
    emitter.emit(createWorkflowEvent('run-1', 'run.completed', {}));

    expect(emitter.history().map((e) => e.type)).toEqual(['run.started', 'run.completed']);
  });
});
