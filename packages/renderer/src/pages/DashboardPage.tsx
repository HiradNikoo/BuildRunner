import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Timeline, Button, Space, Typography, message } from 'antd';
import type { DashboardStats, RunHistoryRecord } from '@shared/index';
import dayjs from 'dayjs';
import { PlayCircleOutlined } from '@ant-design/icons';
import { useRunStore } from '../store/runStore';

function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>();
  const [loading, setLoading] = useState(true);
  const startRun = useRunStore((state) => state.startRun);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const data = await window.api.dashboard.stats();
    setStats(data);
    setLoading(false);
  };

  const handleRunAllPending = async () => {
    try {
      const files = await window.api.files.list();
      for (const file of files) {
        const mapping = await window.api.mapping.get(file.id);
        for (const entry of mapping.mappings) {
          if (entry.status !== 'success') {
            await startRun({ fileId: file.id, commandId: entry.commandId });
          }
        }
      }
      message.success('Triggered all pending runs');
      refresh();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const renderTimelineItem = (item: RunHistoryRecord) => {
    const statusColor = item.exitCode === 0 ? 'green' : 'red';
    return {
      color: statusColor,
      children: (
        <Space direction="vertical">
          <Typography.Text strong>
            File #{item.fileId} · Command #{item.commandId}
          </Typography.Text>
          <Typography.Text type="secondary">
            {dayjs(item.startedAt).format('MMM D, HH:mm:ss')} → {item.exitCode}
          </Typography.Text>
        </Space>
      ),
    };
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Row gutter={16}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Commands" value={stats?.commands ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Files" value={stats?.files ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Failures" value={stats?.failures ?? 0} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic title="Queued" value={stats?.queued ?? 0} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>
      <Card
        title="Recent Activity"
        extra={
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRunAllPending}>
            Run All Pending
          </Button>
        }
      >
        <Timeline items={stats?.recentRuns?.map(renderTimelineItem) ?? []} />
      </Card>
    </Space>
  );
}

export default DashboardPage;
