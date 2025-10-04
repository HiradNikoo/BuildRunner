import { useEffect, useState } from 'react';
import { Card, Select, Space, Table, Tag } from 'antd';
import type { CommandRecord, FileRecord, RunHistoryRecord } from '@shared/index';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

function HistoryPage() {
  const [history, setHistory] = useState<RunHistoryRecord[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const [filters, setFilters] = useState<{ fileId?: number; commandId?: number }>({});
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, [filters]);

  const load = async () => {
    const [historyEntries, fileList, commandList] = await Promise.all([
      window.api.history.list(filters),
      window.api.files.list(),
      window.api.commands.list(),
    ]);
    setHistory(historyEntries);
    setFiles(fileList);
    setCommands(commandList);
  };

  const columns = [
    {
      title: 'Run ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'File',
      dataIndex: 'fileId',
      key: 'file',
      render: (fileId: number) => files.find((file) => file.id === fileId)?.displayName ?? `File ${fileId}`,
    },
    {
      title: 'Command',
      dataIndex: 'commandId',
      key: 'command',
      render: (commandId: number) => commands.find((command) => command.id === commandId)?.name ?? `Command ${commandId}`,
    },
    {
      title: 'Started',
      dataIndex: 'startedAt',
      key: 'startedAt',
      render: (value: string) => dayjs(value).format('MMM D HH:mm:ss'),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, record: RunHistoryRecord) => (
        <Tag color={record.exitCode === 0 ? 'green' : record.exitCode === undefined ? 'blue' : 'red'}>
          {record.exitCode === undefined ? 'Running' : record.exitCode === 0 ? 'Success' : 'Failed'}
        </Tag>
      ),
    },
  ];

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space wrap>
          <Select
            placeholder="Filter by file"
            allowClear
            style={{ width: 240 }}
            options={files.map((file) => ({ label: file.displayName, value: file.id }))}
            value={filters.fileId}
            onChange={(value) => setFilters((prev) => ({ ...prev, fileId: value ?? undefined }))}
          />
          <Select
            placeholder="Filter by command"
            allowClear
            style={{ width: 240 }}
            options={commands.map((command) => ({ label: command.name, value: command.id }))}
            value={filters.commandId}
            onChange={(value) => setFilters((prev) => ({ ...prev, commandId: value ?? undefined }))}
          />
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          dataSource={history}
          columns={columns as any}
          onRow={(record) => ({
            onClick: () => navigate(`/run/${record.id}`),
          })}
          pagination={{ pageSize: 12 }}
        />
      </Card>
    </Space>
  );
}

export default HistoryPage;
