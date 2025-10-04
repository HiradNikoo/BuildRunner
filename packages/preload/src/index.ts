import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { IPCChannels, WindowApi } from '@shared/index';

declare global {
  interface Window {
    api: WindowApi;
  }
}

const api: WindowApi = {
  commands: {
    list: () => ipcRenderer.invoke(IPCChannels.commands.list),
    create: (payload) => ipcRenderer.invoke(IPCChannels.commands.create, payload),
    update: (payload) => ipcRenderer.invoke(IPCChannels.commands.update, payload),
    delete: (id) => ipcRenderer.invoke(IPCChannels.commands.delete, id),
    testExecutable: (path) => ipcRenderer.invoke(IPCChannels.commands.test, path),
  },
  files: {
    add: (paths) => ipcRenderer.invoke(IPCChannels.files.add, paths),
    list: () => ipcRenderer.invoke(IPCChannels.files.list),
    remove: (id) => ipcRenderer.invoke(IPCChannels.files.remove, id),
  },
  mapping: {
    get: (fileId) => ipcRenderer.invoke(IPCChannels.mapping.get, fileId),
    set: (fileId, commandId, overrideArgs) =>
      ipcRenderer.invoke(IPCChannels.mapping.set, fileId, commandId, overrideArgs),
  },
  run: {
    execute: (request) => ipcRenderer.invoke(IPCChannels.run.execute, request),
    subscribe: (runId, listener) => {
      const channel = `${IPCChannels.run.progress}:${runId}`;
      const handler = (_event: IpcRendererEvent, data: Parameters<typeof listener>[0]) => {
        listener(data);
      };
      ipcRenderer.on(channel, handler);
      return () => ipcRenderer.removeListener(channel, handler);
    },
  },
  history: {
    list: (filter) => ipcRenderer.invoke(IPCChannels.history.list, filter),
    get: (runId) => ipcRenderer.invoke(IPCChannels.history.get, runId),
  },
  system: {
    pickExecutable: () => ipcRenderer.invoke(IPCChannels.system.pickExecutable),
    pickFiles: () => ipcRenderer.invoke(IPCChannels.system.pickFiles),
    revealInFinder: (filePath) => ipcRenderer.invoke(IPCChannels.system.reveal, filePath),
  },
  dashboard: {
    stats: () => ipcRenderer.invoke(IPCChannels.dashboard.stats),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPCChannels.settings.get),
    update: (payload) => ipcRenderer.invoke(IPCChannels.settings.update, payload),
  },
};

contextBridge.exposeInMainWorld('api', api);
