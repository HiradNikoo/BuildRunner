import Store from 'electron-store';
import { AppSettings } from '@shared/index';

const defaults: AppSettings = {
  databasePath: '',
  logRetentionDays: 30,
  maxParallelRuns: 2,
  defaultShell: undefined,
  theme: 'system',
};

export class SettingsManager {
  private store: Store<AppSettings>;

  constructor() {
    this.store = new Store<AppSettings>({
      name: 'settings',
      defaults,
    });
  }

  get(): AppSettings {
    const data = this.store.store;
    return { ...defaults, ...data };
  }

  update(partial: Partial<AppSettings>): AppSettings {
    const next = { ...this.get(), ...partial };
    this.store.store = next;
    return next;
  }

  onDidChange<T extends keyof AppSettings>(key: T, callback: (value: AppSettings[T]) => void) {
    this.store.onDidChange(key, callback);
  }
}
