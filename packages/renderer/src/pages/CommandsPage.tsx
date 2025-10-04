import { useEffect, useState } from 'react';
import { Button, Card, Drawer, Form, Input, Select, Space, Switch, Table, Typography, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExperimentOutlined, FolderOpenOutlined } from '@ant-design/icons';
import type { CommandArgDefinition, CommandRecord } from '@shared/index';

const argTypes = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Select', value: 'select' },
];

type SchemaFormValue = CommandArgDefinition & { optionsText?: string };

type CommandFormValue = {
  name: string;
  description?: string;
  executablePath: string;
  workingDir?: string;
  argSchema: SchemaFormValue[];
};

function CommandsPage() {
  const [commands, setCommands] = useState<CommandRecord[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<CommandFormValue>();
  const [editing, setEditing] = useState<CommandRecord>();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const list = await window.api.commands.list();
    setCommands(list);
  };

  const openDrawer = (command?: CommandRecord) => {
    if (command) {
      setEditing(command);
      form.setFieldsValue({
        name: command.name,
        description: command.description,
        executablePath: command.executablePath,
        workingDir: command.workingDir,
        argSchema: command.argSchema.map((field) => ({
          ...field,
          optionsText: field.options?.map((option) => `${option.label}:${option.value}`).join(', '),
        })),
      });
    } else {
      setEditing(undefined);
      form.resetFields();
      form.setFieldsValue({ argSchema: [] });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditing(undefined);
    form.resetFields();
  };

  const parseSchema = (schema: SchemaFormValue[]): CommandArgDefinition[] =>
    schema.map((item) => ({
      key: item.key,
      label: item.label,
      type: item.type,
      required: item.required,
      allowMultiple: item.allowMultiple,
      helpText: item.helpText,
      defaultValue: parseDefaultValue(item),
      options:
        item.type === 'select'
          ? (item.optionsText || '')
              .split(',')
              .map((option) => option.trim())
              .filter(Boolean)
              .map((entry) => {
                const [label, value] = entry.split(':');
                return { label: label?.trim() ?? entry, value: value?.trim() ?? label?.trim() ?? entry };
              })
          : undefined,
    }));

  const parseDefaultValue = (item: SchemaFormValue) => {
    if (item.defaultValue === undefined) return undefined;
    if (item.type === 'number') {
      return Number(item.defaultValue);
    }
    if (item.type === 'boolean') {
      return Boolean(item.defaultValue);
    }
    if (item.allowMultiple) {
      if (Array.isArray(item.defaultValue)) {
        return item.defaultValue;
      }
      if (typeof item.defaultValue === 'string') {
        return item.defaultValue.split(',').map((value) => value.trim()).filter(Boolean);
      }
    }
    return item.defaultValue;
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const argSchema = parseSchema(values.argSchema ?? []);
    const defaultArgs: CommandRecord['defaultArgs'] = {};
    argSchema.forEach((field) => {
      if (field.defaultValue !== undefined) {
        defaultArgs[field.key] = field.defaultValue;
      }
    });
    const payload: Omit<CommandRecord, 'id'> = {
      name: values.name,
      description: values.description,
      executablePath: values.executablePath,
      workingDir: values.workingDir,
      defaultArgs,
      argSchema,
    };

    if (editing) {
      await window.api.commands.update({ ...payload, id: editing.id });
      message.success('Command updated');
    } else {
      await window.api.commands.create(payload);
      message.success('Command created');
    }
    closeDrawer();
    load();
  };

  const handleDelete = (command: CommandRecord) => {
    Modal.confirm({
      title: `Delete ${command.name}?`,
      okType: 'danger',
      onOk: async () => {
        await window.api.commands.delete(command.id);
        message.success('Command deleted');
        load();
      },
    });
  };

  const handleTestExecutable = async () => {
    const executablePath = form.getFieldValue('executablePath');
    if (!executablePath) {
      message.warning('Select an executable first');
      return;
    }
    setTesting(true);
    try {
      const result = await window.api.commands.testExecutable(executablePath);
      if (result.exists && result.executable) {
        message.success('Executable looks good');
      } else if (!result.exists) {
        message.error('Executable not found');
      } else {
        message.error(result.reason ?? 'Executable is not runnable');
      }
    } finally {
      setTesting(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Executable',
      dataIndex: 'executablePath',
      key: 'executablePath',
      render: (value: string) => <Typography.Text code>{value}</Typography.Text>,
    },
    {
      title: 'Arguments',
      key: 'args',
      render: (_: unknown, record: CommandRecord) => {
        if (!record.argSchema.length) {
          return '—';
        }
        const preview = record.argSchema
          .map((field) => {
            const flag = field.key.length === 1 ? `-${field.key}` : `--${field.key}`;
            if (field.type === 'boolean') {
              return flag;
            }
            return `${flag} <${field.key}>`;
          })
          .join(' ');
        return <Typography.Text>{preview}</Typography.Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: CommandRecord) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openDrawer(record)}>
            Edit
          </Button>
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="Commands"
      extra={
        <Button icon={<PlusOutlined />} type="primary" onClick={() => openDrawer()}>
          New Command
        </Button>
      }
    >
      <Table rowKey="id" dataSource={commands} columns={columns as any} pagination={{ pageSize: 8 }} />
      <Drawer
        title={editing ? `Edit ${editing.name}` : 'New Command'}
        width={720}
        open={drawerOpen}
        onClose={closeDrawer}
        extra={
          <Space>
            <Button icon={<FolderOpenOutlined />} onClick={async () => {
              const path = await window.api.system.pickExecutable();
              if (path) {
                form.setFieldValue('executablePath', path);
              }
            }}>
              Pick Executable
            </Button>
            <Button icon={<ExperimentOutlined />} loading={testing} onClick={handleTestExecutable}>
              Test Executable
            </Button>
            <Button onClick={handleSubmit} type="primary">
              Save
            </Button>
          </Space>
        }
      >
        <Form layout="vertical" form={form} initialValues={{ argSchema: [] }}>
          <Form.Item name="name" label="Command Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. ESLint" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="What does this command do?" />
          </Form.Item>
          <Form.Item
            name="executablePath"
            label="Executable Path"
            rules={[{ required: true, message: 'Executable path is required' }]}
          >
            <Input placeholder="/usr/bin/npm" />
          </Form.Item>
          <Form.Item name="workingDir" label="Working Directory">
            <Input placeholder="Optional working directory" />
          </Form.Item>
          <Typography.Title level={5}>Arguments Schema</Typography.Title>
          <Form.List name="argSchema">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }}>
                {fields.map((field) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={<Form.Item name={[field.name, 'label']} rules={[{ required: true }]}><Input placeholder="Label" /></Form.Item>}
                    extra={<Button danger size="small" onClick={() => remove(field.name)}>Remove</Button>}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item
                        label="Key"
                        name={[field.name, 'key']}
                        rules={[{ required: true, message: 'Key is required' }]}
                      >
                        <Input placeholder="flag-name" />
                      </Form.Item>
                      <Form.Item label="Type" name={[field.name, 'type']} rules={[{ required: true }]}>
                        <Select options={argTypes} />
                      </Form.Item>
                      <Form.Item label="Required" name={[field.name, 'required']} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                      <Form.Item label="Allow Multiple" name={[field.name, 'allowMultiple']} valuePropName="checked">
                        <Switch />
                      </Form.Item>
                      <Form.Item shouldUpdate noStyle>
                        {() => {
                          const type = form.getFieldValue(['argSchema', field.name, 'type']);
                          if (type === 'boolean') {
                            return (
                              <Form.Item
                                label="Default Value"
                                name={[field.name, 'defaultValue']}
                                valuePropName="checked"
                              >
                                <Switch />
                              </Form.Item>
                            );
                          }
                          if (type === 'number') {
                            return (
                              <Form.Item label="Default Value" name={[field.name, 'defaultValue']}>
                                <Input type="number" />
                              </Form.Item>
                            );
                          }
                          if (type === 'select') {
                            return (
                              <Form.Item label="Default Value" name={[field.name, 'defaultValue']}>
                                <Input placeholder="Comma separated defaults" />
                              </Form.Item>
                            );
                          }
                          return (
                            <Form.Item label="Default Value" name={[field.name, 'defaultValue']}>
                              <Input placeholder="Optional" />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                      <Form.Item label="Help Text" name={[field.name, 'helpText']}>
                        <Input placeholder="Shown in UI as helper" />
                      </Form.Item>
                      <Form.Item
                        label="Select Options"
                        name={[field.name, 'optionsText']}
                        tooltip="Comma separated list like Label:value"
                      >
                        <Input placeholder="Option A:A, Option B:B" />
                      </Form.Item>
                    </Space>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Add argument
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Drawer>
    </Card>
  );
}

export default CommandsPage;
