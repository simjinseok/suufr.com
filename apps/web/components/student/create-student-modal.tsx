'use client';
import { ModalProps, toast } from '@heroui/react';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import {
  Button,
  FieldError,
  Form,
  Modal,
  Input,
  Select,
  TextArea,
  ListBox,
  Spinner,
  TextField,
  Label,
} from '@heroui/react';
import { Crown } from 'lucide-react';

import { createStudent } from '@/actions/student';
import { getSubscription } from '@/actions/subscription';

interface Props {
  isOpen: ModalProps['isOpen'];
  onOpenChange: ModalProps['onOpenChange'];
}
export default function StudentModal({ isOpen, onOpenChange }: Props) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center">
        <Modal.Dialog className="min-w-[320px]">
          {({ close }) => (
            <Content close={close} />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// api students.service 의 STUDENT_LIMIT_EXCEEDED 메시지와 같은 문구
function limitMessage(maxStudents: number) {
  return `무료 플랜에서는 수강생을 최대 ${maxStudents}명까지 등록할 수 있어요. 프로 플랜으로 업그레이드하면 제한 없이 등록할 수 있습니다.`;
}

type LimitCheck
  = | { status: 'loading' }
    | { status: 'ok' }
    | { status: 'exceeded'; message: string };

interface ContentProps {
  close: () => void;
}
function Content({ close }: ContentProps) {
  const [limitCheck, setLimitCheck] = React.useState<LimitCheck>({ status: 'loading' });

  // 한도에 이미 걸렸으면 폼 대신 안내만 보여준다. 조회 실패는 폼을 열고 저장 시 서버 판정에 맡긴다
  React.useEffect(() => {
    let ignore = false;
    getSubscription()
      .then((subscription) => {
        if (ignore) {
          return;
        }
        const maxStudents = subscription?.limits.maxStudents ?? null;
        const studentCount = subscription?.usage.studentCount ?? null;
        if (maxStudents !== null && studentCount !== null && studentCount >= maxStudents) {
          setLimitCheck({ status: 'exceeded', message: limitMessage(maxStudents) });
        }
        else {
          setLimitCheck({ status: 'ok' });
        }
      })
      .catch(() => {
        if (!ignore) {
          setLimitCheck({ status: 'ok' });
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (limitCheck.status === 'loading') {
    return (
      <React.Fragment>
        <Modal.Header>
          <Modal.Heading>수강생 추가</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onPress={close}>
            닫기
          </Button>
        </Modal.Footer>
      </React.Fragment>
    );
  }

  if (limitCheck.status === 'exceeded') {
    return <LimitNotice message={limitCheck.message} close={close} />;
  }

  return (
    <StudentForm
      close={close}
      onLimitExceeded={message => setLimitCheck({ status: 'exceeded', message })}
    />
  );
}

interface LimitNoticeProps {
  message: string;
  close: () => void;
}
function LimitNotice({ message, close }: LimitNoticeProps) {
  const router = useRouter();

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>수강생 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <div className="p-4 rounded-lg bg-indigo-50 text-sm">
          <p className="font-medium text-indigo-900 flex items-center gap-1.5">
            <Crown className="w-4 h-4 text-indigo-600" />
            프로 플랜이 필요해요
          </p>
          <p className="mt-1 text-indigo-800">{message}</p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onPress={close}>
          닫기
        </Button>
        <Button
          variant="primary"
          onPress={() => {
            close();
            router.push('/settings/subscription');
          }}
        >
          요금제 보기
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}

interface StudentFormProps {
  close: () => void;
  onLimitExceeded: (message: string) => void;
}
function StudentForm({ close, onLimitExceeded }: StudentFormProps) {
  const formId = React.useId();

  const [state, formAction, isPending] = React.useActionState(createStudent, {
    fields: {
      name: '',
      status: 'active',
      notes: '',
    },
  });

  const { control } = useForm({
    values: {
      name: state.fields?.name,
      status: state.fields?.status,
      notes: state.fields?.notes,
    },
  });

  React.useEffect(() => {
    // 폼을 연 뒤 다른 탭 등에서 한도가 찬 경우 — 서버 거부를 받으면 안내 화면으로 바꾼다
    if (state.errorCode === 'STUDENT_LIMIT_EXCEEDED') {
      onLimitExceeded(state.message ?? '');
      return;
    }

    if (typeof state.success !== 'boolean') {
      return;
    }

    if (state.success) {
      toast.success('수강생 추가', {
        description: state.message,
        timeout: 3000,
      });
      close();
    }
  }, [state]);

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>수강생 추가</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          className="p-1"
          id={formId}
          action={formAction}
          validationErrors={state?.errors}
        >

          <Controller
            control={control}
            name="name"
            render={({ field: { name, value, onChange } }) => (
              <TextField
                name={name}
                value={value}
                onChange={onChange}
                isReadOnly={isPending}
              >
                <Label>이름</Label>
                <Input variant="secondary" />
                <FieldError />
              </TextField>
            )}
          />
          <Select
            variant="secondary"
            className="mt-4"
            name="status"
            defaultValue={state.fields.status}
            isDisabled={isPending}
          >
            <Label>상태</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="pending">
                  대기중
                </ListBox.Item>
                <ListBox.Item id="active">
                  수강중
                </ListBox.Item>
                <ListBox.Item id="paused">
                  일시정지
                </ListBox.Item>
                <ListBox.Item id="leave">
                  그만둠
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
          <TextField className="mt-4" name="notes" defaultValue={state.fields.notes}>
            <Label>참고사항</Label>
            <TextArea
              variant="secondary"
              rows={5}
            />
          </TextField>
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
