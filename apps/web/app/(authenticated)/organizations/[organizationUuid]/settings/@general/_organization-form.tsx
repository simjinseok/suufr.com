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
import ProfileImageUpload from '@/components/organization/profile-image-upload';

type Props = {
  organizationUuid: string;
  initialData: {
    name: string;
    phone: string;
    address: string;
    logoImageKey: string | null;
    logoUrl: string | null;
    profileName: string | null;
    profileImageKey: string | null;
    profileImageUrl: string | null;
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
  const [profileImageKey, setProfileImageKey] = React.useState<string | null>(null);
  const [profileImagePublicId, setProfileImagePublicId] = React.useState<string | null>(null);

  // state가 업데이트되면 이미지 URL도 업데이트
  const currentLogoUrl = state.fields?.logoUrl || initialData.logoUrl;
  const currentProfileImageUrl = state.fields?.profileImageUrl || initialData.profileImageUrl;

  const { control } = useForm({
    values: {
      name: state.fields?.name || initialData.name,
      phone: state.fields?.phone || initialData.phone,
      address: state.fields?.address || initialData.address,
      profileName: state.fields?.profileName || initialData.profileName || '',
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
            <Input variant="secondary" type="text" placeholder="과외방 이름" />
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
            <Input variant="secondary" type="tel" placeholder="010-0000-0000" />
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
            <TextArea variant="secondary" placeholder="과외 장소 주소 (선택)" />
            <FieldError />
          </TextField>
        )}
      />

      <div className="border-t border-gray-200 pt-6 mt-2">
        <h3 className="text-lg font-medium text-gray-900 mb-4">선생님 프로필</h3>
        <div className="flex flex-col gap-6">
          <ProfileImageUpload
            value={profileImageKey}
            onChange={setProfileImageKey}
            onPublicIdChange={setProfileImagePublicId}
            currentImageUrl={currentProfileImageUrl}
            disabled={isPending}
          />
          <input type="hidden" name="profileImageKey" value={profileImageKey || ''} />
          <input type="hidden" name="profileImagePublicId" value={profileImagePublicId || ''} />

          <Controller
            control={control}
            name="profileName"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
              >
                <Label>프로필 이름</Label>
                <Input variant="secondary" type="text" placeholder="학생에게 표시될 이름 (선택)" />
                <FieldError />
              </TextField>
            )}
          />
        </div>
      </div>

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
