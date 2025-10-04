import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Space, Typography, Button, Badge, message } from 'antd';
import type { RunHistoryRecord } from '@shared/index';
import { useRunStore } from '../store/runStore';
import dayjs from 'dayjs';

function RunConsolePage() {
  const params = useParams();
  const runId = Number(params.runId);
  const { currentRunId, logs, status, exitCode, startedAt, finishedAt } = useRunStore();
  const [runRecord, setRunRecord] = useState<RunHistoryRecord>();

  useEffect(() => {
    if (!runId) return;
    if (currentRunId === runId) return;
    window.api.history.get(runId).then((record) => {
      if (record) {
        setRunRecord(record);
      }
    });
  }, [runId, currentRunId]);

  const displayLogs = useMemo(() => {
    if (currentRunId === runId) {
      return logs.map((entry) => `[${entry.timestamp}] ${entry.type.toUpperCase()} ${entry.message}`).join('\n');
    }
    if (runRecord) {
      return `${runRecord.stdout}\n${runRecord.stderr}`.trim();
    }
    return 'No logs available yet.';
  }, [logs, currentRunId, runId, runRecord]);

  const meta = currentRunId === runId ? { startedAt, finishedAt, exitCode } : runRecord;
  const effectiveStatus =
    currentRunId === runId
      ? status
      : runRecord?.exitCode === undefined
      ? 'running'
      : runRecord.exitCode === 0
      ? 'success'
      : 'error';

  const copyLogs = async () => {
    await navigator.clipboard.writeText(displayLogs);
    message.success('Logs copied');
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Title level={4}>Run #{runId}</Typography.Title>
          <Space>
            <Badge status={effectiveStatus === 'running' ? 'processing' : effectiveStatus === 'error' ? 'error' : 'success'} />
            <Typography.Text>
              {meta?.startedAt ? `Started ${dayjs(meta.startedAt).format('MMM D HH:mm:ss')}` : 'Pending'}
            </Typography.Text>
            {meta?.finishedAt && (
              <Typography.Text type="secondary">
                Finished {dayjs(meta.finishedAt).format('MMM D HH:mm:ss')} (code {meta.exitCode})
              </Typography.Text>
            )}
          </Space>
          <Space>
            <Button onClick={copyLogs}>Copy Logs</Button>
            <Button
              onClick={() => {
                const blob = new Blob([displayLogs], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `run-${runId}.log`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Save Logs
            </Button>
          </Space>
          <Typography.Paragraph>
            <pre style={{ maxHeight: 400, overflow: 'auto' }}>{displayLogs}</pre>
          </Typography.Paragraph>
        </Space>
      </Card>
    </Space>
  );
}

export default RunConsolePage;
