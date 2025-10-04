import { EventEmitter } from 'node:events';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  CommandRecord,
  FileRecord,
  RunProgressEvent,
  ArgPrimitive,
  MAX_LOG_LENGTH,
  RunStatus,
} from '@shared/index';
import { DataStore } from '../db/index.js';
import { buildCliArgs } from '../utils/args.js';
import type { AppSettings } from '@shared/index';

export interface QueueItem {
  runId: number;
  file: FileRecord;
  command: CommandRecord;
  args: Record<string, ArgPrimitive | ArgPrimitive[]>;
  dryRun?: boolean;
}

type ExecutorEvents = {
  progress: (event: RunProgressEvent) => void;
};

export declare interface RunExecutor {
  on<U extends keyof ExecutorEvents>(event: U, listener: ExecutorEvents[U]): this;
  emit<U extends keyof ExecutorEvents>(event: U, ...args: Parameters<ExecutorEvents[U]>): boolean;
}

export class RunExecutor extends EventEmitter {
  private queue: QueueItem[] = [];
  private running = new Map<number, QueueItem>();
  private maxParallel = 1;

  constructor(
    private readonly dataStore: DataStore,
    private readonly getSettings: () => AppSettings,
  ) {
    super();
    this.maxParallel = this.getSettings().maxParallelRuns ?? 1;
  }

  enqueue(item: QueueItem) {
    if (item.dryRun) {
      this.dataStore.setMapping(item.file.id, item.command.id, item.args, 'running', new Date().toISOString());
      this.emit('progress', { runId: item.runId, type: 'start' });
      this.emit('progress', {
        runId: item.runId,
        type: 'stdout',
        data: this.buildDryRunMessage(item),
      });
      const finishedAt = new Date().toISOString();
      this.dataStore.completeRun(item.runId, 0, finishedAt, 'success', item.file.id, item.command.id);
      this.emit('progress', {
        runId: item.runId,
        type: 'exit',
        exitCode: 0,
        finishedAt,
      });
      return;
    }

    this.queue.push(item);
    this.dataStore.setMapping(item.file.id, item.command.id, item.args, 'queued', new Date().toISOString());
    this.process();
  }

  updateParallelism() {
    const settings = this.getSettings();
    this.maxParallel = Math.max(1, settings.maxParallelRuns ?? 1);
    this.process();
  }

  private process() {
    while (this.running.size < this.maxParallel && this.queue.length > 0) {
      const next = this.queue.shift()!;
      this.start(next);
    }
  }

  private start(item: QueueItem) {
    this.running.set(item.runId, item);
    this.emit('progress', { runId: item.runId, type: 'start' });
    this.dataStore.setMapping(item.file.id, item.command.id, item.args, 'running', new Date().toISOString());

    let child;
    try {
      const schemaArgs = buildCliArgs(item.command.argSchema, item.args);
      const placeholderArgs = this.applyFilePlaceholders(schemaArgs, item.file.filePath);
      const { executable, args, options } = this.resolveExecutable(
        item.command.executablePath,
        placeholderArgs,
        item.command.workingDir,
      );

      child = spawn(executable, args, options);
    } catch (error) {
      const data = (error as Error).message;
      this.emit('progress', { runId: item.runId, type: 'stderr', data });
      this.finish(item, 1, 'error');
      return;
    }

    child.stdout.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      this.emit('progress', { runId: item.runId, type: 'stdout', data });
      this.dataStore.appendRunLogs(item.runId, data, '', MAX_LOG_LENGTH);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      this.emit('progress', { runId: item.runId, type: 'stderr', data });
      this.dataStore.appendRunLogs(item.runId, '', data, MAX_LOG_LENGTH);
    });

    child.on('error', (error) => {
      const data = error.message;
      this.emit('progress', { runId: item.runId, type: 'stderr', data });
      this.finish(item, 1, 'error');
    });

    child.on('close', (code) => {
      const exitCode = code ?? 0;
      const status: RunStatus = exitCode === 0 ? 'success' : 'error';
      this.finish(item, exitCode, status);
    });
  }

  private finish(item: QueueItem, exitCode: number, status: RunStatus) {
    const finishedAt = new Date().toISOString();
    this.running.delete(item.runId);
    this.dataStore.completeRun(item.runId, exitCode, finishedAt, status, item.file.id, item.command.id);
    this.emit('progress', {
      runId: item.runId,
      type: 'exit',
      exitCode,
      finishedAt,
    });
    this.process();
  }

  private applyFilePlaceholders(values: string[], filePath: string) {
    return values.map((value) =>
      value
        .replaceAll('{{filePath}}', filePath)
        .replaceAll('{{fileName}}', path.basename(filePath))
        .replaceAll('{{fileDir}}', path.dirname(filePath)),
    );
  }

  private resolveExecutable(executablePath: string, args: string[], workingDir?: string) {
    const platform = process.platform;
    const ext = path.extname(executablePath).toLowerCase();
    const env = { ...process.env };

    if (platform !== 'win32') {
      if (!fs.existsSync(executablePath)) {
        throw new Error(`Executable not found: ${executablePath}`);
      }
      try {
        fs.accessSync(executablePath, fs.constants.X_OK);
      } catch {
        throw new Error(`Executable is not marked as runnable: ${executablePath}. Run chmod +x.`);
      }
    }

    if (platform === 'win32') {
      if (ext === '.bat') {
        return {
          executable: 'cmd.exe',
          args: ['/c', executablePath, ...args],
          options: { cwd: workingDir ?? path.dirname(executablePath), env },
        };
      }
      return {
        executable: executablePath,
        args,
        options: { cwd: workingDir ?? path.dirname(executablePath), env },
      };
    }

    if (ext === '.sh') {
      return {
        executable: 'bash',
        args: [executablePath, ...args],
        options: { cwd: workingDir ?? path.dirname(executablePath), env },
      };
    }

    const shell = this.getSettings().defaultShell;
    if (shell) {
      return {
        executable: shell,
        args: [executablePath, ...args],
        options: { cwd: workingDir ?? path.dirname(executablePath), env },
      };
    }

    return {
      executable: executablePath,
      args,
      options: { cwd: workingDir ?? path.dirname(executablePath), env },
    };
  }

  private buildDryRunMessage(item: QueueItem) {
    const args = buildCliArgs(item.command.argSchema, item.args);
    const command = `${item.command.executablePath} ${args.join(' ')}`.trim();
    return `DRY RUN: ${command}${os.EOL}`;
  }
}
