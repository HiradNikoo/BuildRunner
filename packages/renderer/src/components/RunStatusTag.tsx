import { Tag } from 'antd';
import type { RunStatus } from '@shared/index';

const statusColor: Record<RunStatus, string> = {
  idle: 'default',
  queued: 'gold',
  running: 'processing',
  success: 'green',
  error: 'red',
};

const statusLabel: Record<RunStatus, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  success: 'Success',
  error: 'Error',
};

function RunStatusTag({ status }: { status: RunStatus }) {
  return <Tag color={statusColor[status]}>{statusLabel[status]}</Tag>;
}

export default RunStatusTag;
