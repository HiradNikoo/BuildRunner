import path from 'node:path';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import {
  ArgPrimitive,
  CommandRecord,
  FileRecord,
  FileCommandArgsRecord,
  RunHistoryRecord,
  RunStatus,
  DashboardStats,
} from '@shared/index';

export class DataStore {
  private db: Database.Database;

  constructor(private readonly filePath: string) {
    const directory = path.dirname(filePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.prepare();
  }

  private prepare() {
    this.db
      .prepare(`
        CREATE TABLE IF NOT EXISTS commands (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          executablePath TEXT NOT NULL,
          workingDir TEXT,
          defaultArgs TEXT NOT NULL DEFAULT '{}',
          argSchema TEXT NOT NULL DEFAULT '[]'
        )
      `)
      .run();

    this.db
      .prepare(`
        CREATE TABLE IF NOT EXISTS files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filePath TEXT NOT NULL UNIQUE,
          displayName TEXT NOT NULL,
          tags TEXT NOT NULL DEFAULT '[]',
          createdAt TEXT NOT NULL
        )
      `)
      .run();

    this.db
      .prepare(`
        CREATE TABLE IF NOT EXISTS file_command_args (
          fileId INTEGER NOT NULL,
          commandId INTEGER NOT NULL,
          overrideArgs TEXT NOT NULL DEFAULT '{}',
          lastRunAt TEXT,
          lastStatus TEXT,
          PRIMARY KEY (fileId, commandId),
          FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
          FOREIGN KEY (commandId) REFERENCES commands(id) ON DELETE CASCADE
        )
      `)
      .run();

    this.db
      .prepare(`
        CREATE TABLE IF NOT EXISTS run_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fileId INTEGER NOT NULL,
          commandId INTEGER NOT NULL,
          startedAt TEXT NOT NULL,
          finishedAt TEXT,
          exitCode INTEGER,
          stdout TEXT NOT NULL DEFAULT '',
          stderr TEXT NOT NULL DEFAULT '',
          fullArgs TEXT NOT NULL DEFAULT '{}',
          FOREIGN KEY (fileId) REFERENCES files(id) ON DELETE CASCADE,
          FOREIGN KEY (commandId) REFERENCES commands(id) ON DELETE CASCADE
        )
      `)
      .run();
  }

  public close() {
    this.db.close();
  }

  public listCommands(): CommandRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM commands ORDER BY name COLLATE NOCASE ASC`)
      .all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      executablePath: row.executablePath,
      workingDir: row.workingDir ?? undefined,
      defaultArgs: JSON.parse(row.defaultArgs || '{}'),
      argSchema: JSON.parse(row.argSchema || '[]'),
    }));
  }

  public getCommand(id: number): CommandRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM commands WHERE id = ?`).get(id);
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      executablePath: row.executablePath,
      workingDir: row.workingDir ?? undefined,
      defaultArgs: JSON.parse(row.defaultArgs || '{}'),
      argSchema: JSON.parse(row.argSchema || '[]'),
    };
  }

  public createCommand(command: Omit<CommandRecord, 'id'>): CommandRecord {
    const stmt = this.db.prepare(`
      INSERT INTO commands (name, description, executablePath, workingDir, defaultArgs, argSchema)
      VALUES (@name, @description, @executablePath, @workingDir, @defaultArgs, @argSchema)
    `);
    const result = stmt.run({
      name: command.name,
      description: command.description ?? null,
      executablePath: command.executablePath,
      workingDir: command.workingDir ?? null,
      defaultArgs: JSON.stringify(command.defaultArgs ?? {}),
      argSchema: JSON.stringify(command.argSchema ?? []),
    });
    return { ...command, id: Number(result.lastInsertRowid) };
  }

  public updateCommand(command: CommandRecord): CommandRecord {
    this.db
      .prepare(`
        UPDATE commands
        SET name=@name,
            description=@description,
            executablePath=@executablePath,
            workingDir=@workingDir,
            defaultArgs=@defaultArgs,
            argSchema=@argSchema
        WHERE id=@id
      `)
      .run({
        id: command.id,
        name: command.name,
        description: command.description ?? null,
        executablePath: command.executablePath,
        workingDir: command.workingDir ?? null,
        defaultArgs: JSON.stringify(command.defaultArgs ?? {}),
        argSchema: JSON.stringify(command.argSchema ?? []),
      });
    return command;
  }

  public deleteCommand(id: number) {
    this.db.prepare(`DELETE FROM commands WHERE id = ?`).run(id);
  }

  public listFiles(): FileRecord[] {
    const rows = this.db.prepare(`SELECT * FROM files ORDER BY createdAt DESC`).all();
    return rows.map((row) => ({
      id: row.id,
      filePath: row.filePath,
      displayName: row.displayName,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.createdAt,
    }));
  }

  public addFiles(paths: string[]): FileRecord[] {
    const insert = this.db.prepare(`
      INSERT INTO files (filePath, displayName, tags, createdAt)
      VALUES (@filePath, @displayName, @tags, @createdAt)
      ON CONFLICT(filePath) DO UPDATE SET displayName=excluded.displayName
      RETURNING *
    `);
    const now = new Date().toISOString();
    const files: FileRecord[] = [];
    const transaction = this.db.transaction((pathsToAdd: string[]) => {
      for (const filePath of pathsToAdd) {
        const displayName = path.basename(filePath);
        const row = insert.get({
          filePath,
          displayName,
          tags: JSON.stringify([]),
          createdAt: now,
        });
        files.push({
          id: row.id,
          filePath: row.filePath,
          displayName: row.displayName,
          tags: JSON.parse(row.tags || '[]'),
          createdAt: row.createdAt,
        });
      }
    });
    transaction(paths);
    return files;
  }

  public removeFile(id: number) {
    this.db.prepare(`DELETE FROM files WHERE id = ?`).run(id);
  }

  public getFile(id: number): FileRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM files WHERE id = ?`).get(id);
    if (!row) return undefined;
    return {
      id: row.id,
      filePath: row.filePath,
      displayName: row.displayName,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.createdAt,
    };
  }

  public setMapping(
    fileId: number,
    commandId: number,
    overrideArgs: Record<string, ArgPrimitive | ArgPrimitive[]> | null,
    status?: RunStatus,
    lastRunAt?: string,
  ): void {
    if (overrideArgs === null) {
      this.removeMapping(fileId, commandId);
      return;
    }
    this.db
      .prepare(`
        INSERT INTO file_command_args (fileId, commandId, overrideArgs, lastStatus, lastRunAt)
        VALUES (@fileId, @commandId, @overrideArgs, @status, @lastRunAt)
        ON CONFLICT(fileId, commandId) DO UPDATE SET
          overrideArgs=excluded.overrideArgs,
          lastStatus=COALESCE(excluded.lastStatus, file_command_args.lastStatus),
          lastRunAt=COALESCE(excluded.lastRunAt, file_command_args.lastRunAt)
      `)
      .run({
        fileId,
        commandId,
        overrideArgs: JSON.stringify(overrideArgs ?? {}),
        status: status ?? null,
        lastRunAt: lastRunAt ?? null,
      });
  }

  public getMappings(fileId: number): FileCommandArgsRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM file_command_args WHERE fileId = ?`)
      .all(fileId);
    return rows.map((row) => ({
      fileId: row.fileId,
      commandId: row.commandId,
      overrideArgs: JSON.parse(row.overrideArgs || '{}'),
      lastRunAt: row.lastRunAt ?? undefined,
      lastStatus: row.lastStatus ?? undefined,
    }));
  }

  public removeMapping(fileId: number, commandId: number) {
    this.db
      .prepare(`DELETE FROM file_command_args WHERE fileId = @fileId AND commandId = @commandId`)
      .run({ fileId, commandId });
  }

  public insertRunHistory(record: Omit<RunHistoryRecord, 'id'>): number {
    const result = this.db
      .prepare(`
        INSERT INTO run_history (fileId, commandId, startedAt, finishedAt, exitCode, stdout, stderr, fullArgs)
        VALUES (@fileId, @commandId, @startedAt, @finishedAt, @exitCode, @stdout, @stderr, @fullArgs)
      `)
      .run({
        ...record,
        finishedAt: record.finishedAt ?? null,
        exitCode: record.exitCode ?? null,
        stdout: record.stdout ?? '',
        stderr: record.stderr ?? '',
        fullArgs: JSON.stringify(record.fullArgs ?? {}),
      });
    return Number(result.lastInsertRowid);
  }

  public appendRunLogs(runId: number, stdoutChunk: string, stderrChunk: string, maxLength: number) {
    const row = this.db.prepare(`SELECT stdout, stderr FROM run_history WHERE id = ?`).get(runId);
    if (!row) return;
    const stdout = this.truncate(`${row.stdout ?? ''}${stdoutChunk ?? ''}`, maxLength);
    const stderr = this.truncate(`${row.stderr ?? ''}${stderrChunk ?? ''}`, maxLength);
    this.db
      .prepare(`UPDATE run_history SET stdout=@stdout, stderr=@stderr WHERE id=@id`)
      .run({ id: runId, stdout, stderr });
  }

  public completeRun(
    runId: number,
    exitCode: number,
    finishedAt: string,
    status: RunStatus,
    fileId: number,
    commandId: number,
  ) {
    this.db
      .prepare(`
        UPDATE run_history
        SET exitCode=@exitCode, finishedAt=@finishedAt
        WHERE id=@id
      `)
      .run({ id: runId, exitCode, finishedAt });
    this.db
      .prepare(`
        UPDATE file_command_args
        SET lastRunAt=@lastRunAt, lastStatus=@status
        WHERE fileId=@fileId AND commandId=@commandId
      `)
      .run({
        fileId,
        commandId,
        lastRunAt: finishedAt,
        status,
      });
  }

  public listHistory(filter?: { fileId?: number; commandId?: number }): RunHistoryRecord[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};
    if (filter?.fileId) {
      conditions.push('fileId = @fileId');
      params.fileId = filter.fileId;
    }
    if (filter?.commandId) {
      conditions.push('commandId = @commandId');
      params.commandId = filter.commandId;
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM run_history ${where} ORDER BY startedAt DESC LIMIT 200`)
      .all(params);
    return rows.map((row) => ({
      id: row.id,
      fileId: row.fileId,
      commandId: row.commandId,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
      exitCode: row.exitCode ?? undefined,
      stdout: row.stdout ?? '',
      stderr: row.stderr ?? '',
      fullArgs: JSON.parse(row.fullArgs || '{}'),
    }));
  }

  public getRun(runId: number): RunHistoryRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM run_history WHERE id = ?`).get(runId);
    if (!row) return undefined;
    return {
      id: row.id,
      fileId: row.fileId,
      commandId: row.commandId,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt ?? undefined,
      exitCode: row.exitCode ?? undefined,
      stdout: row.stdout ?? '',
      stderr: row.stderr ?? '',
      fullArgs: JSON.parse(row.fullArgs || '{}'),
    };
  }

  public saveRunArgs(runId: number, fullArgs: Record<string, ArgPrimitive | ArgPrimitive[]>) {
    this.db
      .prepare(`UPDATE run_history SET fullArgs=@fullArgs WHERE id=@id`)
      .run({ id: runId, fullArgs: JSON.stringify(fullArgs ?? {}) });
  }

  public stats(): DashboardStats {
    const commands = this.db.prepare(`SELECT COUNT(*) as count FROM commands`).get().count as number;
    const files = this.db.prepare(`SELECT COUNT(*) as count FROM files`).get().count as number;
    const failures = this.db
      .prepare(`SELECT COUNT(*) as count FROM run_history WHERE exitCode IS NOT NULL AND exitCode <> 0`)
      .get().count as number;
    const recentRuns = this.listHistory().slice(0, 10);
    const queued = this.db
      .prepare(`SELECT COUNT(*) as count FROM file_command_args WHERE lastStatus='queued'`)
      .get().count as number;
    return { commands, files, failures, queued, recentRuns };
  }

  private truncate(value: string, maxLength: number) {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  }
}

export function resolveDatabasePath(userData: string, configuredPath?: string) {
  if (configuredPath) {
    return configuredPath;
  }
  return path.join(userData, 'buildrunner.sqlite');
}
