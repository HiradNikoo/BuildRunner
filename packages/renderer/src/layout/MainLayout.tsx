import { Layout, Menu, Typography, Button, Space, Badge } from 'antd';
import {
  DashboardOutlined,
  FileOutlined,
  ThunderboltOutlined,
  HistoryOutlined,
  SettingOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useRunStore } from '../store/runStore';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
  { key: '/files', icon: <FileOutlined />, label: <Link to="/files">Files</Link> },
  { key: '/commands', icon: <ThunderboltOutlined />, label: <Link to="/commands">Commands</Link> },
  { key: '/history', icon: <HistoryOutlined />, label: <Link to="/history">History</Link> },
  { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">Settings</Link> },
];

function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const { currentRunId, status } = useRunStore((state) => ({
    currentRunId: state.currentRunId,
    status: state.status,
  }));

  useEffect(() => {
    document.title = 'BuildRunner';
  }, []);

  return (
    <Layout hasSider>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} breakpoint="lg">
        <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
            {collapsed ? 'BR' : 'BuildRunner'}
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[`/${location.pathname.split('/')[1]}`]}
          items={menuItems}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              BuildRunner
            </Typography.Title>
            <Space>
              <Badge status={status === 'running' ? 'processing' : status === 'error' ? 'error' : 'success'}>
                <Typography.Text type="secondary">
                  {status === 'running' ? 'Running...' : status === 'error' ? 'Last run failed' : 'Ready'}
                </Typography.Text>
              </Badge>
              {currentRunId && (
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={() => navigate(`/run/${currentRunId}`)}
                  type="primary"
                >
                  View Run
                </Button>
              )}
            </Space>
          </Space>
        </Header>
        <Content style={{ margin: '24px', minHeight: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default MainLayout;
