'use client';
import type { ModalProps } from '@heroui/react';

import React from 'react';

import {
  Button,
  Form,
  Modal,
  Spinner,
} from '@heroui/react';

import { updateStudentProfileImage } from '@/actions/student';
import { useForm, Controller } from 'react-hook-form';
import { Student } from '@/types/index';
import ProfileImageUpload from '@/components/student/profile-image-upload';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
  student: Student;
}
export default function EditProfileImageModal({ isOpen, onOpenChange, student }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <Content student={student} close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  student: Props['student'];
  close: () => void;
}
function Content({ student, close }: ContentProps) {
  const formId = React.useId();

  const { control, watch } = useForm<{
    profileImageKey: string | null;
  }>({
    values: {
      profileImageKey: student.profileImageKey ?? null,
    },
  });

  const [state, formAction, isPending] = React.useActionState(updateStudentProfileImage, {});

  React.useEffect(() => {
    if (!state.timestamp) {
      return;
    }

    if (state.success) {
      alert('프로필 사진을 변경하였습니다');
      close();
    }
  }, [state?.timestamp, state?.success, state?.message]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>프로필 사진 변경</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          className="p-1"
          id={formId}
          action={formAction}
          validationErrors={state?.fieldErrors}
        >
          <input type="hidden" name="studentUuid" value={student.uuid} />
          <Controller
            control={control}
            name="profileImageKey"
            render={({ field: { value, onChange } }) => (
              <ProfileImageUpload
                name={student.name}
                value={value}
                onChange={onChange}
                disabled={isPending}
              />
            )}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onPress={close}>
          닫기
        </Button>
        <Button
          form={formId}
          variant="primary"
          type="submit"
          isPending={isPending}
        >
          {({ isPending }) => (
            <>
              {isPending ? <Spinner color="current" size="sm" /> : null}
              저장
            </>
          )}
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
