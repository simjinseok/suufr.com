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
    logoImageUrl: string | null;
    profileName: string | null;
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

  // undefined: 변경 안함, null: 삭제, string: 새 이미지
  const [logoImageUrl, setLogoImageUrl] = React.useState<string | null | undefined>(undefined);
  const [profileImageUrl, setProfileImageUrl] = React.useState<string | null | undefined>(undefined);

  // 현재 표시할 이미지 URL
  const currentLogoUrl = logoImageUrl !== undefined
    ? logoImageUrl
    : (state.fields?.logoImageUrl ?? initialData.logoImageUrl);
  const currentProfileImageUrl = profileImageUrl !== undefined
    ? profileImageUrl
    : (state.fields?.profileImageUrl ?? initialData.profileImageUrl);

  // hidden input에 전달할 값 (undefined면 기존 값 유지, null이면 삭제)
  const logoInputValue = logoImageUrl !== undefined
    ? (logoImageUrl ?? '')
    : (state.fields?.logoImageUrl ?? initialData.logoImageUrl ?? '');
  const profileInputValue = profileImageUrl !== undefined
    ? (profileImageUrl ?? '')
    : (state.fields?.profileImageUrl ?? initialData.profileImageUrl ?? '');

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
        value={logoImageUrl}
        onChange={setLogoImageUrl}
        currentImageUrl={currentLogoUrl}
        disabled={isPending}
      />
      <input type="hidden" name="logoImageUrl" value={logoInputValue} />

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
            value={profileImageUrl}
            onChange={setProfileImageUrl}
            currentImageUrl={currentProfileImageUrl}
            disabled={isPending}
          />
          <input type="hidden" name="profileImageUrl" value={profileInputValue} />

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
