import { useEffect, useState } from 'react';
import { Card, Form, Input, InputNumber, Select, Space, Button, Typography, message } from 'antd';
import type { AppSettings } from '@shared/index';

const themeOptions = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

function SettingsPage() {
  const [form] = Form.useForm<AppSettings>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const settings = await window.api.settings.get();
    form.setFieldsValue(settings);
  };

  const handleSubmit = async (values: AppSettings) => {
    setLoading(true);
    try {
      await window.api.settings.update(values);
      message.success('Settings updated');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Settings">
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        <Form.Item label="Database Location" name="databasePath">
          <Input addonAfter={<Button onClick={async () => {
            const [path] = await window.api.system.pickFiles();
            if (path) {
              form.setFieldValue('databasePath', path);
            }
          }}>Browse</Button>} placeholder="Defaults to app data directory" />
        </Form.Item>
        <Form.Item
          label="Log retention (days)"
          name="logRetentionDays"
          rules={[{ required: true, type: 'number', min: 1 }]}
        >
          <InputNumber min={1} max={365} />
        </Form.Item>
        <Form.Item
          label="Max parallel runs"
          name="maxParallelRuns"
          rules={[{ required: true, type: 'number', min: 1, max: 8 }]}
        >
          <InputNumber min={1} max={8} />
        </Form.Item>
        <Form.Item label="Default shell" name="defaultShell">
          <Input placeholder="Optional shell for *nix systems" />
        </Form.Item>
        <Form.Item label="Theme" name="theme" rules={[{ required: true }]}> 
          <Select options={themeOptions} style={{ width: 200 }} />
        </Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            Save
          </Button>
          <Button onClick={load}>Reset</Button>
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          Database location changes require a restart to take effect.
        </Typography.Paragraph>
      </Form>
    </Card>
  );
}

export default SettingsPage;
