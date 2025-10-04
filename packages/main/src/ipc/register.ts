import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import {
  IPCChannels,
  MappingResponse,
  RunExecutionRequest,
  RunExecutionResponse,
  RunProgressEvent,
} from '@shared/index';
import { DataStore } from '../db/index.js';
import { RunExecutor } from '../run/executor.js';
import { mergeArgs } from '../utils/args.js';
import { SettingsManager } from '../utils/settings.js';

export function registerIpcHandlers(
  getWindow: () => BrowserWindow | null,
  dataStore: DataStore,
  executor: RunExecutor,
  settings: SettingsManager,
) {
  ipcMain.handle(IPCChannels.commands.list, () => dataStore.listCommands());

  ipcMain.handle(IPCChannels.commands.create, (_event, payload) => dataStore.createCommand(payload));

  ipcMain.handle(IPCChannels.commands.update, (_event, payload) => dataStore.updateCommand(payload));

  ipcMain.handle(IPCChannels.commands.delete, (_event, id: number) => dataStore.deleteCommand(id));

  ipcMain.handle(IPCChannels.commands.test, (_event, executablePath: string) => {
    const exists = fs.existsSync(executablePath);
    let executable = exists;
    let reason: string | undefined;
    if (exists) {
      try {
        fs.accessSync(executablePath, fs.constants.X_OK);
      } catch (error) {
        executable = false;
        reason = (error as Error).message;
      }
    }
    return { exists, executable, reason };
  });

  ipcMain.handle(IPCChannels.files.add, (_event, paths: string[]) => dataStore.addFiles(paths));

  ipcMain.handle(IPCChannels.files.list, () => dataStore.listFiles());

  ipcMain.handle(IPCChannels.files.remove, (_event, id: number) => dataStore.removeFile(id));

  ipcMain.handle(IPCChannels.mapping.get, (_event, fileId: number): MappingResponse => {
    const mappings = dataStore.getMappings(fileId);
    const commands = dataStore.listCommands();
    return {
      fileId,
      mappings: mappings
        .map((mapping) => {
          const command = commands.find((c) => c.id === mapping.commandId);
          if (!command) return undefined;
          const { merged } = mergeArgs(command.argSchema, command.defaultArgs, mapping.overrideArgs ?? {});
          return {
            commandId: mapping.commandId,
            effectiveArgs: merged,
            status: mapping.lastStatus,
            lastRunAt: mapping.lastRunAt,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    };
  });

  ipcMain.handle(IPCChannels.mapping.set, (_event, fileId: number, commandId: number, overrideArgs) => {
    dataStore.setMapping(fileId, commandId, overrideArgs);
    const mappings = dataStore.getMappings(fileId);
    return mappings.map((mapping) => {
      const relatedCommand = dataStore.getCommand(mapping.commandId);
      if (!relatedCommand) return undefined;
      const { merged: effectiveArgs } = mergeArgs(
        relatedCommand.argSchema,
        relatedCommand.defaultArgs,
        mapping.overrideArgs,
      );
      return {
        commandId: mapping.commandId,
        effectiveArgs,
        status: mapping.lastStatus,
        lastRunAt: mapping.lastRunAt,
      };
    }).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  });

  ipcMain.handle(IPCChannels.run.execute, (_event, request: RunExecutionRequest): RunExecutionResponse => {
    const file = dataStore.getFile(request.fileId);
    if (!file) {
      throw new Error('File not found');
    }
    const command = dataStore.getCommand(request.commandId);
    if (!command) {
      throw new Error('Command not found');
    }

    const mappings = dataStore.getMappings(file.id);
    const overrides = mappings.find((m) => m.commandId === command.id)?.overrideArgs ?? {};
    const { merged, missingRequired } = mergeArgs(command.argSchema, command.defaultArgs, overrides);
    if (missingRequired.length) {
      throw new Error(`Missing required arguments: ${missingRequired.join(', ')}`);
    }

    const startedAt = new Date().toISOString();
    const runId = dataStore.insertRunHistory({
      fileId: file.id,
      commandId: command.id,
      startedAt,
      stdout: '',
      stderr: '',
      fullArgs: merged,
    });
    dataStore.saveRunArgs(runId, merged);

    executor.enqueue({
      runId,
      file,
      command,
      args: merged,
      dryRun: request.dryRun,
    });

    const response: RunExecutionResponse = { runId, startedAt };
    return response;
  });

  ipcMain.handle(IPCChannels.history.list, (_event, filter) => dataStore.listHistory(filter));

  ipcMain.handle(IPCChannels.history.get, (_event, runId: number) => dataStore.getRun(runId));

  ipcMain.handle(IPCChannels.system.pickExecutable, async () => {
    const browserWindow = getWindow();
    const result = await dialog.showOpenDialog(browserWindow ?? undefined, {
      properties: ['openFile'],
    });
    return result.canceled ? undefined : result.filePaths[0];
  });

  ipcMain.handle(IPCChannels.system.pickFiles, async () => {
    const browserWindow = getWindow();
    const result = await dialog.showOpenDialog(browserWindow ?? undefined, {
      properties: ['openFile', 'multiSelections'],
    });
    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPCChannels.system.reveal, (_event, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });

  ipcMain.handle(IPCChannels.dashboard.stats, () => dataStore.stats());

  ipcMain.handle(IPCChannels.settings.get, () => settings.get());

  ipcMain.handle(IPCChannels.settings.update, (_event, partial) => {
    const next = settings.update(partial);
    executor.updateParallelism();
    return next;
  });

  executor.on('progress', (event: RunProgressEvent) => {
    const target = getWindow();
    if (target && !target.isDestroyed()) {
      target.webContents.send(`${IPCChannels.run.progress}:${event.runId}`, event);
    }
  });
}
