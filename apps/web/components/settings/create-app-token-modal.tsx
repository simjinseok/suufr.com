'use client';
import React from 'react';
import {
  Form,
  Input,
  Modal,
  Button,
  TextField,
  Label,
  FieldError,
} from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { Copy, Check } from 'lucide-react';

import { createAppToken } from '@/actions/app-token';

interface CreateAppTokenModalProps {
  userEmail?: string;
  onCreated?: () => void;
}

export default function CreateAppTokenModal({ userEmail, onCreated }: CreateAppTokenModalProps) {
  return (
    <Modal.Backdrop>
      <Modal.Container>
        <Modal.Dialog>
          {({ close }) => (
            <Content
              userEmail={userEmail}
              close={() => {
                close();
                onCreated?.();
              }}
            />
          )}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

interface ContentProps {
  userEmail?: string;
  close: () => void;
}

function Content({ userEmail, close }: ContentProps) {
  const formId = React.useId();
  const [copied, setCopied] = React.useState(false);

  const [state, formAction, isPending] = React.useActionState(createAppToken, {
    fields: {
      name: '',
    },
  });

  const { control } = useForm({
    values: {
      name: state.fields?.name || '',
    },
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Token was created successfully
  if (state.success && state.token) {
    return (
      <React.Fragment>
        <Modal.Header>
          <Modal.Heading>앱 토큰이 생성되었습니다</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-warning-soft rounded-lg">
              <p className="text-sm font-medium text-warning-700">
                이 토큰은 다시 표시되지 않습니다. 지금 복사해주세요.
              </p>
            </div>

            <div>
              <Label className="text-sm text-gray-500 mb-1">토큰</Label>
              <div className="flex items-center gap-2">
                <Input
                  variant="secondary"
                  value={state.token}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(state.token!)}
                >
                  {copied
                    ? (
                        <Check className="w-4 h-4 text-success" />
                      )
                    : (
                        <Copy className="w-4 h-4" />
                      )}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium mb-2">Apple 기기 설정 방법</p>
              <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                <li>설정 → 캘린더 (또는 연락처) → 계정</li>
                <li>계정 추가 → 기타</li>
                <li>CalDAV (또는 CardDAV) 계정 추가</li>
                <li>아래 정보 입력:</li>
              </ol>
              <div className="mt-3 p-3 bg-white rounded border text-sm font-mono">
                <p>
                  <span className="text-gray-500">서버:</span>
                  {' '}
                  {typeof window !== 'undefined' ? window.location.host : 'suufr.com'}
                </p>
                <p>
                  <span className="text-gray-500">사용자 이름:</span>
                  {' '}
                  {userEmail || '(스프 이메일)'}
                </p>
                <p>
                  <span className="text-gray-500">비밀번호:</span>
                  {' '}
                  (위 토큰)
                </p>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={close}>
            확인
          </Button>
        </Modal.Footer>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>앱 토큰 생성</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={formAction}
          validationErrors={state.fieldErrors}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>토큰 이름</Label>
                <Input variant="secondary" placeholder="예: iPhone, MacBook" />
                <FieldError />
              </TextField>
            )}
          />
          <p className="text-sm text-gray-500">
            어떤 기기에서 사용하는 토큰인지 구분할 수 있도록 이름을 입력해주세요.
          </p>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onClick={close}>
          취소
        </Button>
        <Button
          form={formId}
          variant="primary"
          type="submit"
          isPending={isPending}
        >
          생성
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
