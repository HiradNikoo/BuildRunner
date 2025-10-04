import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Upload, message, Typography, Space, Button, Modal, Tag, Input, Select } from 'antd';
import type { CommandRecord, EffectiveCommandMapping, FileRecord } from '@shared/index';
import { InboxOutlined, PlayCircleOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import FileMappingDrawer from '../components/FileMappingDrawer';
import RunStatusTag from '../components/RunStatusTag';
import { useRunStore } from '../store/runStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const [mappings, setMappings] = useState<Record<number, EffectiveCommandMapping[]>>({});
  const [loading, setLoading] = useState(true);
  const [drawerFile, setDrawerFile] = useState<FileRecord>();
  const [query, setQuery] = useState('');
  const startRun = useRunStore((state) => state.startRun);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    const [fileList, commandList] = await Promise.all([window.api.files.list(), window.api.commands.list()]);
    setFiles(fileList);
    setCommands(commandList);
    const mappingEntries = await Promise.all(
      fileList.map(async (file) => {
        const mapping = await window.api.mapping.get(file.id);
        return [file.id, mapping.mappings] as const;
      }),
    );
    const map: Record<number, EffectiveCommandMapping[]> = {};
    mappingEntries.forEach(([fileId, entries]) => {
      map[fileId] = entries;
    });
    setMappings(map);
    setLoading(false);
  };

  const filteredFiles = useMemo(() => {
    if (!query) return files;
    const lower = query.toLowerCase();
    return files.filter((file) => file.displayName.toLowerCase().includes(lower) || file.filePath.toLowerCase().includes(lower));
  }, [files, query]);

  const runCommand = async (file: FileRecord, commandId: number) => {
    try {
      await startRun({ fileId: file.id, commandId });
      message.success('Run started');
      await load();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const confirmRemove = (file: FileRecord) => {
    Modal.confirm({
      title: `Remove ${file.displayName}?`,
      content: 'This will delete all mappings and history for this file.',
      okType: 'danger',
      onOk: async () => {
        await window.api.files.remove(file.id);
        message.success('File removed');
        load();
      },
    });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'displayName',
      key: 'name',
      render: (_: unknown, record: FileRecord) => (
        <Space direction="vertical" size={0}>
          <Typography.Link onClick={() => setDrawerFile(record)}>{record.displayName}</Typography.Link>
          <Typography.Text type="secondary">{record.filePath}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Commands',
      key: 'commands',
      render: (_: unknown, record: FileRecord) => {
        const entries = mappings[record.id] ?? [];
        if (!entries.length) {
          return <Typography.Text type="secondary">None</Typography.Text>;
        }
        return (
          <Space wrap>
            {entries.map((entry) => {
              const command = commands.find((c) => c.id === entry.commandId);
              return <Tag key={entry.commandId}>{command?.name ?? `Command ${entry.commandId}`}</Tag>;
            })}
          </Space>
        );
      },
    },
    {
      title: 'Last Status',
      key: 'status',
      render: (_: unknown, record: FileRecord) => {
        const entries = mappings[record.id] ?? [];
        if (!entries.length) {
          return <RunStatusTag status="idle" />;
        }
        const latest = entries.slice().sort((a, b) => (b.lastRunAt ?? '').localeCompare(a.lastRunAt ?? ''))[0];
        return <RunStatusTag status={latest.status ?? 'idle'} />;
      },
    },
    {
      title: 'Last Run',
      key: 'lastRun',
      render: (_: unknown, record: FileRecord) => {
        const entries = mappings[record.id] ?? [];
        const latest = entries.slice().sort((a, b) => (b.lastRunAt ?? '').localeCompare(a.lastRunAt ?? ''))[0];
        const last = latest?.lastRunAt;
        return last ? dayjs(last).fromNow() : 'Never';
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: FileRecord) => {
        const entries = mappings[record.id] ?? [];
        return (
          <Space>
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              disabled={!entries.length}
              onClick={async () => {
                if (entries.length === 1) {
                  await runCommand(record, entries[0].commandId);
                  return;
                }
                const commandId = await pickCommand(entries, commands);
                if (commandId !== undefined) {
                  await runCommand(record, commandId);
                }
              }}
            >
              Run
            </Button>
            <Button icon={<EditOutlined />} size="small" onClick={() => setDrawerFile(record)}>
              Edit
            </Button>
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => window.api.system.revealInFinder(record.filePath)}
            >
              Reveal
            </Button>
            <Button icon={<DeleteOutlined />} size="small" danger onClick={() => confirmRemove(record)}>
              Remove
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Upload.Dragger
          multiple
          beforeUpload={async (file) => {
            const filePath = (file as unknown as { path: string }).path;
            await window.api.files.add([filePath]);
            message.success(`${file.name} added`);
            load();
            return Upload.LIST_IGNORE;
          }}
          showUploadList={false}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Drag and drop files or click to select</p>
        </Upload.Dragger>
      </Card>
      <Input.Search placeholder="Search files" value={query} onChange={(event) => setQuery(event.target.value)} />
      <Card>
        <Table
          loading={loading}
          columns={columns as any}
          rowKey="id"
          dataSource={filteredFiles}
          pagination={{ pageSize: 10 }}
        />
      </Card>
      <FileMappingDrawer
        open={Boolean(drawerFile)}
        file={drawerFile}
        commands={commands}
        onClose={() => setDrawerFile(undefined)}
        onSaved={load}
      />
    </Space>
  );
}

export default FilesPage;

async function pickCommand(
  entries: EffectiveCommandMapping[],
  commands: CommandRecord[],
): Promise<number | undefined> {
  return new Promise((resolve) => {
    let selected = entries[0]?.commandId;
    Modal.confirm({
      title: 'Select command to run',
      icon: null,
      okText: 'Run',
      onOk: () => {
        resolve(selected);
      },
      onCancel: () => resolve(undefined),
      content: (
        <Select
          style={{ width: '100%' }}
          value={selected}
          onChange={(value) => {
            selected = value;
          }}
          options={entries.map((entry) => {
            const command = commands.find((c) => c.id === entry.commandId);
            return {
              label: command?.name ?? `Command ${entry.commandId}`,
              value: entry.commandId,
            };
          })}
        />
      ),
    });
  });
}
