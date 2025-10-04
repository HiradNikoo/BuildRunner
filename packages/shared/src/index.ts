export type ArgPrimitive = string | number | boolean | null;

export type ArgType = 'string' | 'number' | 'boolean' | 'select';

export interface ArgOption {
  label: string;
  value: string | number | boolean;
}

export interface CommandArgDefinition {
  key: string;
  label: string;
  type: ArgType;
  required?: boolean;
  defaultValue?: ArgPrimitive | ArgPrimitive[];
  helpText?: string;
  options?: ArgOption[];
  allowMultiple?: boolean;
}

export interface CommandRecord {
  id: number;
  name: string;
  description?: string;
  executablePath: string;
  workingDir?: string;
  defaultArgs: Record<string, ArgPrimitive | ArgPrimitive[]>;
  argSchema: CommandArgDefinition[];
}

export interface FileRecord {
  id: number;
  filePath: string;
  displayName: string;
  tags: string[];
  createdAt: string;
}

export type RunStatus = 'idle' | 'queued' | 'running' | 'success' | 'error';

export interface FileCommandArgsRecord {
  fileId: number;
  commandId: number;
  overrideArgs: Record<string, ArgPrimitive | ArgPrimitive[]>;
  lastRunAt?: string;
  lastStatus?: RunStatus;
}

export interface RunHistoryRecord {
  id: number;
  fileId: number;
  commandId: number;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number;
  stdout: string;
  stderr: string;
  fullArgs: Record<string, ArgPrimitive | ArgPrimitive[]>;
}

export interface EffectiveCommandMapping {
  commandId: number;
  effectiveArgs: Record<string, ArgPrimitive | ArgPrimitive[]>;
  status?: RunStatus;
  lastRunAt?: string;
}

export interface MappingResponse {
  fileId: number;
  mappings: EffectiveCommandMapping[];
}

export interface RunExecutionRequest {
  fileId: number;
  commandId: number;
  dryRun?: boolean;
}

export interface RunExecutionResponse {
  runId: number;
  startedAt: string;
}

export interface RunProgressEvent {
  runId: number;
  type: 'stdout' | 'stderr' | 'exit' | 'start';
  data?: string;
  exitCode?: number;
  finishedAt?: string;
}

export interface HistoryFilter {
  fileId?: number;
  commandId?: number;
}

export interface DashboardStats {
  commands: number;
  files: number;
  recentRuns: RunHistoryRecord[];
  failures: number;
  queued: number;
}

export interface WindowApi {
  commands: {
    list: () => Promise<CommandRecord[]>;
    create: (command: Omit<CommandRecord, 'id'>) => Promise<CommandRecord>;
    update: (command: CommandRecord) => Promise<CommandRecord>;
    delete: (id: number) => Promise<void>;
    testExecutable: (path: string) => Promise<{ exists: boolean; executable: boolean; reason?: string }>;
  };
  files: {
    add: (paths: string[]) => Promise<FileRecord[]>;
    list: () => Promise<FileRecord[]>;
    remove: (id: number) => Promise<void>;
  };
  mapping: {
    get: (fileId: number) => Promise<MappingResponse>;
    set: (
      fileId: number,
      commandId: number,
      overrideArgs: Record<string, ArgPrimitive | ArgPrimitive[]> | null,
    ) => Promise<EffectiveCommandMapping[]>;
  };
  run: {
    execute: (request: RunExecutionRequest) => Promise<RunExecutionResponse>;
    subscribe: (
      runId: number,
      listener: (event: RunProgressEvent) => void,
    ) => () => void;
  };
  history: {
    list: (filter?: HistoryFilter) => Promise<RunHistoryRecord[]>;
    get: (runId: number) => Promise<RunHistoryRecord | undefined>;
  };
  system: {
    pickExecutable: () => Promise<string | undefined>;
    pickFiles: () => Promise<string[]>;
    revealInFinder: (filePath: string) => Promise<void>;
  };
  dashboard: {
    stats: () => Promise<DashboardStats>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  };
};

export interface AppSettings {
  databasePath: string;
  logRetentionDays: number;
  maxParallelRuns: number;
  defaultShell?: string;
  theme: 'light' | 'dark' | 'system';
}

export interface CommandQueueItem {
  runId: number;
  file: FileRecord;
  command: CommandRecord;
  args: Record<string, ArgPrimitive | ArgPrimitive[]>;
}

export const IPCChannels = {
  commands: {
    list: 'commands:list',
    create: 'commands:create',
    update: 'commands:update',
    delete: 'commands:delete',
    test: 'commands:test',
  },
  files: {
    add: 'files:add',
    list: 'files:list',
    remove: 'files:remove',
  },
  mapping: {
    get: 'mapping:get',
    set: 'mapping:set',
  },
  run: {
    execute: 'run:execute',
    progress: 'run:progress',
  },
  history: {
    list: 'history:list',
    get: 'history:get',
  },
  system: {
    pickExecutable: 'system:pickExecutable',
    pickFiles: 'system:pickFiles',
    reveal: 'system:reveal',
  },
  dashboard: {
    stats: 'dashboard:stats',
  },
  settings: {
    get: 'settings:get',
    update: 'settings:update',
  },
} as const;

export type IpcChannelMap = typeof IPCChannels;

export const MAX_LOG_LENGTH = 2 * 1024 * 1024;

export type RunQueueState = {
  running: CommandQueueItem[];
  queued: CommandQueueItem[];
};
