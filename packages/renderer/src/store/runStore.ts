import { create } from 'zustand';
import { RunProgressEvent, RunStatus } from '@shared/index';

type LogEntry = {
  type: 'stdout' | 'stderr' | 'system';
  message: string;
  timestamp: string;
};

type RunStore = {
  currentRunId?: number;
  status: RunStatus;
  exitCode?: number;
  startedAt?: string;
  finishedAt?: string;
  logs: LogEntry[];
  subscribeDisposer?: () => void;
  startRun: (payload: { fileId: number; commandId: number; dryRun?: boolean }) => Promise<number>;
  appendLog: (entry: LogEntry) => void;
  handleEvent: (event: RunProgressEvent) => void;
  clear: () => void;
};

export const useRunStore = create<RunStore>((set, get) => ({
  currentRunId: undefined,
  status: 'idle',
  exitCode: undefined,
  startedAt: undefined,
  finishedAt: undefined,
  logs: [],
  subscribeDisposer: undefined,
  async startRun(payload) {
    const response = await window.api.run.execute(payload);
    const dispose = window.api.run.subscribe(response.runId, (event) => {
      get().handleEvent(event);
    });
    set({
      currentRunId: response.runId,
      status: 'running',
      exitCode: undefined,
      logs: [],
      startedAt: response.startedAt,
      finishedAt: undefined,
      subscribeDisposer: dispose,
    });
    return response.runId;
  },
  appendLog(entry) {
    set((state) => ({ logs: [...state.logs, entry] }));
  },
  handleEvent(event) {
    if (event.type === 'start') {
      set({ status: 'running' });
      return;
    }
    if (event.type === 'stdout' || event.type === 'stderr') {
      get().appendLog({
        type: event.type,
        message: event.data ?? '',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (event.type === 'exit') {
      const disposer = get().subscribeDisposer;
      disposer?.();
      set({
        status: event.exitCode === 0 ? 'success' : 'error',
        exitCode: event.exitCode,
        finishedAt: event.finishedAt,
        subscribeDisposer: undefined,
      });
      get().appendLog({
        type: 'system',
        message: `Process exited with code ${event.exitCode}`,
        timestamp: new Date().toISOString(),
      });
    }
  },
  clear() {
    const disposer = get().subscribeDisposer;
    disposer?.();
    set({
      currentRunId: undefined,
      status: 'idle',
      exitCode: undefined,
      logs: [],
      startedAt: undefined,
      finishedAt: undefined,
      subscribeDisposer: undefined,
    });
  },
}));
