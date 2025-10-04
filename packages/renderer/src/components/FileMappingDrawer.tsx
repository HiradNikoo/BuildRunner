import { useEffect, useMemo, useState } from 'react';
import { Drawer, Space, Select, Card, Button, Typography, Divider, Empty, message } from 'antd';
import type { CommandRecord, FileRecord, ArgPrimitive } from '@shared/index';
import CommandArgForm from './CommandArgForm';
import { buildCliArgs } from '../utils/args';

interface Props {
  open: boolean;
  file?: FileRecord;
  commands: CommandRecord[];
  onClose: () => void;
  onSaved: () => void;
}

type ArgMap = Record<number, Record<string, ArgPrimitive | ArgPrimitive[]>>;

function FileMappingDrawer({ open, file, commands, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [overrides, setOverrides] = useState<ArgMap>({});
  const [initialSelection, setInitialSelection] = useState<number[]>([]);

  useEffect(() => {
    if (open && file) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.id]);

  const load = async () => {
    if (!file) return;
    const mapping = await window.api.mapping.get(file.id);
    const newSelected = mapping.mappings.map((entry) => entry.commandId);
    const nextOverrides: ArgMap = {};
    mapping.mappings.forEach((entry) => {
      nextOverrides[entry.commandId] = entry.effectiveArgs;
    });
    setSelected(newSelected);
    setInitialSelection(newSelected);
    setOverrides(nextOverrides);
  };

  const handleSelectChange = (ids: number[]) => {
    const nextOverrides: ArgMap = { ...overrides };
    ids.forEach((id) => {
      if (!nextOverrides[id]) {
        const command = commands.find((c) => c.id === id);
        nextOverrides[id] = command?.defaultArgs ?? {};
      }
    });
    setSelected(ids);
    setOverrides(nextOverrides);
  };

  const handleSave = async () => {
    if (!file) return;
    try {
      const removed = initialSelection.filter((id) => !selected.includes(id));
      await Promise.all(
        removed.map((id) => window.api.mapping.set(file.id, id, null)),
      );
      for (const commandId of selected) {
        const values = overrides[commandId] ?? {};
        await window.api.mapping.set(file.id, commandId, values);
      }
      message.success('Mappings saved');
      onSaved();
      onClose();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const cards = useMemo(() => {
    if (!selected.length) {
      return <Empty description="Select commands to configure overrides" />;
    }
    return selected.map((id) => {
      const command = commands.find((c) => c.id === id);
      if (!command) return null;
      const values = overrides[id] ?? {};
      const preview = buildCliArgs(command.argSchema, values).join(' ');
      return (
        <Card
          key={id}
          title={command.name}
          extra={
            <Button danger size="small" onClick={() => handleSelectChange(selected.filter((key) => key !== id))}>
              Remove
            </Button>
          }
          style={{ marginBottom: 16 }}
        >
          <Typography.Paragraph type="secondary">{command.description}</Typography.Paragraph>
          <CommandArgForm
            schema={command.argSchema}
            value={values}
            onChange={(valueMap) => setOverrides((prev) => ({ ...prev, [id]: valueMap }))}
          />
          <Divider orientation="left">CLI Preview</Divider>
          <Typography.Text code>
            {command.executablePath} {preview}
          </Typography.Text>
        </Card>
      );
    });
  }, [selected, commands, overrides]);

  return (
    <Drawer
      width={720}
      title={`Configure commands · ${file?.displayName ?? ''}`}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={<Button type="primary" onClick={handleSave}>Save</Button>}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Typography.Text strong>Select commands</Typography.Text>
          <Select
            mode="multiple"
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Choose commands"
            value={selected}
            onChange={handleSelectChange}
            options={commands.map((command) => ({ label: command.name, value: command.id }))}
          />
        </div>
        {cards}
      </Space>
    </Drawer>
  );
}

export default FileMappingDrawer;
