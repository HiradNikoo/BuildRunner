import os from 'node:os';
import path from 'node:path';
import { DataStore } from '../packages/main/src/db/index.js';

const dbPath = path.join(process.cwd(), 'buildrunner-demo.sqlite');
const store = new DataStore(dbPath);

const command = store.createCommand({
  name: 'Echo',
  description: 'Echo command for demo',
  executablePath: process.platform === 'win32' ? 'cmd.exe' : '/bin/echo',
  workingDir: undefined,
  defaultArgs: { message: 'Hello BuildRunner' },
  argSchema: [
    {
      key: 'message',
      label: 'Message',
      type: 'string',
      required: true,
      helpText: 'Message to echo to stdout',
      defaultValue: 'Hello BuildRunner',
    },
  ],
});

const files = store.addFiles([
  path.join(os.tmpdir(), 'sample1.txt'),
  path.join(os.tmpdir(), 'sample2.txt'),
]);

files.forEach((file) => {
  store.setMapping(file.id, command.id, { message: `Processing ${file.displayName}` });
});

store.close();
console.log('Seeded demo database at', dbPath);
