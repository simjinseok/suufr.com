'use client';
import * as React from 'react';
import { Button, Form, Modal } from '@heroui/react';

import { submitReconsent } from '@/actions/consent';
import ConsentCheckboxes, { EMPTY_CONSENTS, isAllConsented, type ConsentValues } from '@/components/auth/consent-checkboxes';

/**
 * 약관·개인정보 재동의 모달. 동의 이력이 없는 기존 가입자, 또는 문서 버전이 올라간 뒤 첫 로그인에 뜬다.
 * 닫기 불가 — 동의를 마쳐야 앱을 계속 쓸 수 있다. 제출 성공 시 레이아웃이 revalidate 되어 모달이 사라진다.
 */
export default function ReconsentModal() {
  const [consents, setConsents] = React.useState<ConsentValues>(EMPTY_CONSENTS);
  const [state, formAction, isPending] = React.useActionState(submitReconsent, { fields: EMPTY_CONSENTS });

  return (
    <Modal.Backdrop isOpen isDismissable={false} isKeyboardDismissDisabled>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>약관 및 개인정보 처리 동의</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <Form className="p-1 flex flex-col gap-4" action={formAction} validationErrors={state.fieldErrors}>
              <p className="text-sm text-gray-600">
                스프를 계속 이용하려면 이용약관과 개인정보 수집·이용, 국외 이전에 동의해주세요.
              </p>

              {state.message && !state.success && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{state.message}</div>
              )}

              <ConsentCheckboxes values={consents} onChange={setConsents} errors={state.fieldErrors} />

              <Button
                type="submit"
                variant="primary"
                isPending={isPending}
                isDisabled={!isAllConsented(consents)}
                className="w-full"
              >
                동의하고 계속하기
              </Button>
            </Form>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
