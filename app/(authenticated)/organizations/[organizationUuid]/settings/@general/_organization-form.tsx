'use client';

import * as React from 'react';
import {
  Form,
  Input,
  Button,
  TextField,
  Label,
  FieldError,
  TextArea,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { updateOrganization } from '@/actions/organization';
import OrganizationLogoUpload from '@/components/organization/logo-upload';

type Props = {
  organizationUuid: string;
  initialData: {
    name: string;
    phone: string;
    address: string;
    logoImageKey: string | null;
    logoUrl: string | null;
  };
};

export function OrganizationForm({ organizationUuid, initialData }: Props) {
  const boundUpdateOrganization = updateOrganization.bind(null, organizationUuid);

  const [state, formAction, isPending] = React.useActionState(
    boundUpdateOrganization,
    {
      fields: initialData,
    },
  );

  const [logoImageKey, setLogoImageKey] = React.useState<string | null>(null);
  const [logoImagePublicId, setLogoImagePublicId] = React.useState<string | null>(null);

  // state가 업데이트되면 로고 URL도 업데이트
  const currentLogoUrl = state.fields?.logoUrl || initialData.logoUrl;

  const { control } = useForm({
    values: {
      name: state.fields?.name || initialData.name,
      phone: state.fields?.phone || initialData.phone,
      address: state.fields?.address || initialData.address,
    },
  });

  return (
    <Form
      className="flex flex-col gap-6"
      action={formAction}
      validationErrors={state.fieldErrors}
    >
      {state.message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            state.success
              ? 'bg-green-50 text-green-600'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {state.message}
        </div>
      )}

      <OrganizationLogoUpload
        value={logoImageKey}
        onChange={setLogoImageKey}
        onPublicIdChange={setLogoImagePublicId}
        currentImageUrl={currentLogoUrl}
        disabled={isPending}
      />
      <input type="hidden" name="logoImageKey" value={logoImageKey || ''} />
      <input type="hidden" name="logoImagePublicId" value={logoImagePublicId || ''} />

      <Controller
        control={control}
        name="name"
        render={({ field: { name, value, onChange } }) => (
          <TextField
            name={name}
            value={value}
            onChange={onChange}
            isRequired
          >
            <Label>상호명</Label>
            <Input type="text" placeholder="과외방 이름" />
            <FieldError />
          </TextField>
        )}
      />

      <Controller
        control={control}
        name="phone"
        render={({ field: { name, value, onChange } }) => (
          <TextField
            name={name}
            value={value}
            onChange={onChange}
          >
            <Label>연락처</Label>
            <Input type="tel" placeholder="010-0000-0000" />
            <FieldError />
          </TextField>
        )}
      />

      <Controller
        control={control}
        name="address"
        render={({ field: { name, value, onChange } }) => (
          <TextField
            name={name}
            value={value}
            onChange={onChange}
          >
            <Label>주소</Label>
            <TextArea placeholder="과외 장소 주소 (선택)" />
            <FieldError />
          </TextField>
        )}
      />

      <div className="flex justify-end pt-4">
        <Button
          type="submit"
          variant="primary"
          isPending={isPending}
        >
          저장
        </Button>
      </div>
    </Form>
  );
}
