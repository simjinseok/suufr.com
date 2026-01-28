'use client';

import * as React from 'react';
import { Form, TextField, Input, FieldError } from '@heroui/react';

interface InlineEditInputProps {
  initialValue: string;
  onSave: (formData: FormData) => void;
  onCancel: () => void;
  isPending: boolean;
  errors?: Record<string, string[]>;
  fieldName: string;
  placeholder?: string;
  maxLength?: number;
  suffix?: string;
  hiddenFields?: Record<string, string>;
}

export default function InlineEditInput({
  initialValue,
  onSave,
  onCancel,
  isPending,
  errors,
  fieldName,
  placeholder,
  maxLength = 100,
  suffix,
  hiddenFields,
}: InlineEditInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [value, setValue] = React.useState(initialValue);

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget?.closest('form') === e.currentTarget.closest('form')) {
      return;
    }
    onCancel();
  };

  return (
    <Form
      action={onSave}
      validationErrors={errors}
      className="flex-1 min-w-0"
    >
      {hiddenFields && Object.entries(hiddenFields).map(([name, fieldValue]) => (
        <input key={name} type="hidden" name={name} value={fieldValue} />
      ))}
      <TextField
        name={fieldName}
        value={value}
        onChange={setValue}
        isReadOnly={isPending}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            variant="secondary"
            placeholder={placeholder}
            maxLength={suffix ? maxLength - suffix.length : maxLength}
            className="flex-1"
          />
          {suffix && (
            <span className="text-sm text-gray-500 shrink-0">{suffix}</span>
          )}
        </div>
        <FieldError className="text-xs mt-1" />
      </TextField>
    </Form>
  );
}
