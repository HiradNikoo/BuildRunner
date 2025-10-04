import { Form, Input, InputNumber, Switch, Select } from 'antd';
import { useEffect } from 'react';
import type { CommandArgDefinition, ArgPrimitive } from '@shared/index';

type Props = {
  schema: CommandArgDefinition[];
  value?: Record<string, ArgPrimitive | ArgPrimitive[]>;
  onChange?: (values: Record<string, ArgPrimitive | ArgPrimitive[]>) => void;
};

function CommandArgForm({ schema, value, onChange }: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (value) {
      form.setFieldsValue(value);
    }
  }, [value, form]);

  const renderField = (field: CommandArgDefinition) => {
    if (field.type === 'boolean') {
      return <Switch />;
    }
    if (field.type === 'number') {
      return <InputNumber style={{ width: '100%' }} />;
    }
    if (field.type === 'select') {
      return (
        <Select
          mode={field.allowMultiple ? 'multiple' : undefined}
          options={field.options?.map((option) => ({ label: option.label, value: option.value }))}
        />
      );
    }
    return <Input />;
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={(_, values) => onChange?.(values)}
      initialValues={value}
    >
      {schema.map((field) => (
        <Form.Item
          key={field.key}
          label={field.label}
          name={field.key}
          valuePropName={field.type === 'boolean' ? 'checked' : 'value'}
          rules={[{ required: Boolean(field.required), message: `${field.label} is required` }]}
          extra={field.helpText}
        >
          {renderField(field)}
        </Form.Item>
      ))}
    </Form>
  );
}

export default CommandArgForm;
