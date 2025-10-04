import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Space,
  Typography,
  Spin,
  Button,
  message,
  Tabs,
  Table,
  Empty,
} from 'antd';
import type {
  CommandRecord,
  EffectiveCommandMapping,
  FileRecord,
  RunHistoryRecord,
  ArgPrimitive,
} from '@shared/index';
import CommandArgForm from '../components/CommandArgForm';
import { buildCliArgs } from '../utils/args';
import { useRunStore } from '../store/runStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

function FileDetailPage() {
  const params = useParams();
  const fileId = Number(params.id);
  const [file, setFile] = useState<FileRecord>();
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const [mappings, setMappings] = useState<EffectiveCommandMapping[]>([]);
  const [overrides, setOverrides] = useState<Record<number, Record<string, ArgPrimitive | ArgPrimitive[]>>>({});
  const [history, setHistory] = useState<RunHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const startRun = useRunStore((state) => state.startRun);

  useEffect(() => {
    load();
  }, [fileId]);

  const load = async () => {
    if (!fileId) return;
    setLoading(true);
    const [fileList, commandList, mapping] = await Promise.all([
      window.api.files.list(),
      window.api.commands.list(),
      window.api.mapping.get(fileId),
    ]);
    setFile(fileList.find((item) => item.id === fileId));
    setCommands(commandList);
    setMappings(mapping.mappings);
    const overrideMap: Record<number, Record<string, ArgPrimitive | ArgPrimitive[]>> = {};
    mapping.mappings.forEach((entry) => {
      overrideMap[entry.commandId] = entry.effectiveArgs;
    });
    setOverrides(overrideMap);
    const historyEntries = await window.api.history.list({ fileId });
    setHistory(historyEntries);
    setLoading(false);
  };

  const commandCards = useMemo(() => {
    if (!mappings.length) {
      return <Empty description="No commands configured. Use the Files page to add commands." />;
    }
    return mappings.map((mapping) => {
      const command = commands.find((item) => item.id === mapping.commandId);
      if (!command) return null;
      const values = overrides[mapping.commandId] ?? {};
      const previewArgs = buildCliArgs(command.argSchema, values);
      return (
        <Card
          key={mapping.commandId}
          title={command.name}
          extra={
            <Space>
              <Button onClick={() => handleSave(mapping.commandId)}>Save Overrides</Button>
              <Button onClick={() => execute(mapping.commandId, false)} type="primary">
                Run
              </Button>
              <Button onClick={() => execute(mapping.commandId, true)}>Dry Run</Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Typography.Paragraph>{command.description}</Typography.Paragraph>
          <CommandArgForm
            schema={command.argSchema}
            value={values}
            onChange={(valueMap) => setOverrides((prev) => ({ ...prev, [mapping.commandId]: valueMap }))}
          />
          <Typography.Paragraph>
            <Typography.Text strong>Preview:</Typography.Text>{' '}
            <Typography.Text code>
              {command.executablePath} {previewArgs.join(' ')}
            </Typography.Text>
          </Typography.Paragraph>
        </Card>
      );
    });
  }, [mappings, commands, overrides]);

  const handleSave = async (commandId: number) => {
    await window.api.mapping.set(fileId, commandId, overrides[commandId] ?? {});
    message.success('Overrides saved');
    load();
  };

  const execute = async (commandId: number, dryRun: boolean) => {
    try {
      await startRun({ fileId, commandId, dryRun });
      message.success(dryRun ? 'Dry run queued' : 'Run started');
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const historyColumns = [
    { title: 'Command', dataIndex: 'commandId', key: 'command' },
    {
      title: 'Started',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (value: string) => dayjs(value).format('MMM D HH:mm:ss'),
    },
    {
      title: 'Duration',
      key: 'duration',
      render: (_: unknown, record: RunHistoryRecord) => {
        if (!record.finishedAt) return 'Running';
        const duration = dayjs(record.finishedAt).diff(dayjs(record.startedAt), 'second');
        return `${duration}s`;
      },
    },
    {
      title: 'Exit Code',
      dataIndex: 'exitCode',
      key: 'exitCode',
      render: (value: number | undefined) => (value === undefined ? '—' : value),
    },
  ];

  if (loading || !file) {
    return (
      <Space style={{ width: '100%', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </Space>
    );
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Descriptions title={file.displayName} bordered column={1}>
          <Descriptions.Item label="Path">{file.filePath}</Descriptions.Item>
          <Descriptions.Item label="Created">{dayjs(file.createdAt).fromNow()}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Tabs
        items={[
          {
            key: 'commands',
            label: 'Commands',
            children: <Space direction="vertical" style={{ width: '100%' }}>{commandCards}</Space>,
          },
          {
            key: 'history',
            label: 'History',
            children: (
              <Card>
                <Table
                  rowKey="id"
                  dataSource={history}
                  columns={historyColumns as any}
                  pagination={{ pageSize: 8 }}
                  onRow={(record) => ({
                    onClick: () => window.open(`#run/${record.id}`, '_self'),
                  })}
                />
              </Card>
            ),
          },
        ]}
      />
    </Space>
  );
}

export default FileDetailPage;
