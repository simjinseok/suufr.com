'use client';
import * as React from 'react';
import { Button, FieldError, Form, Input, InputOTP, Label, Modal, Surface, TextField } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { AlertTriangle, UserX } from 'lucide-react';

import {
  deleteAccount,
  requestAccountDeletionOtp,
  type AccountDeletionMethod,
  type DeleteAccountState,
} from '@/actions/account-deletion';

// api 의 재요청 쿨다운과 같은 값. 화면은 버튼만 잠그고, 실제 제한은 api 가 429 로 건다
const OTP_RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  email?: string;
  // 비밀번호가 있으면 비밀번호로, 없으면(Google 전용 등) 이메일 코드로 재인증한다
  hasPassword: boolean;
  // 프로 구독 중이면 즉시 해지·환불 없음을 알린다
  isPro: boolean;
};

/**
 * 계정 삭제(회원 탈퇴). 안내 확인 → 재인증(비밀번호 또는 이메일 코드) → 삭제.
 * 성공하면 서버 액션이 로그인 쿠키를 지우고 /login?deleted=1 로 보낸다.
 */
export default function AccountDeletionSection({ email, hasPassword, isPro }: Props) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <UserX className="w-5 h-5 text-danger" />
            계정 삭제
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            계정과 스프에 저장한 모든 데이터를 삭제합니다. 삭제한 계정은 복구할 수 없습니다.
          </p>
        </div>
        <Button variant="danger-soft" size="sm" className="shrink-0" onPress={() => setIsOpen(true)}>
          계정 삭제
        </Button>
      </div>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={setIsOpen}>
        <Modal.Container>
          <Modal.Dialog>
            {({ close }) => (
              <Content email={email} hasPassword={hasPassword} isPro={isPro} close={close} />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Surface>
  );
}

type ContentProps = Props & { close: () => void };

function Content({ email, hasPassword, isPro, close }: ContentProps) {
  const [step, setStep] = React.useState<'notice' | 'verify'>('notice');

  if (step === 'notice') {
    return (
      <React.Fragment>
        <Modal.Header>
          <Modal.Heading>계정을 삭제할까요?</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-danger-soft rounded-full shrink-0">
              <AlertTriangle className="w-6 h-6 text-danger" />
            </div>
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">지워지는 것</p>
                <p className="mt-1 text-gray-600">
                  과외방, 수강생, 수강권, 입금 내역, 수업 기록, 커리큘럼, 업로드한 파일, 설정과 Google 캘린더 연동까지
                  계정의 모든 데이터가 즉시 삭제됩니다. 삭제한 뒤에는 복구할 수 없습니다.
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-900">남는 것</p>
                <p className="mt-1 text-gray-600">
                  법령과 개인정보처리방침에 따라 결제 기록은 5년, 약관·개인정보 동의 이력은 3년, 탈퇴 기록(이메일을 알아볼 수 없게
                  바꾼 값)은 5년 동안 분리 보관한 뒤 파기합니다.
                </p>
              </div>
              {isPro && (
                <div className="p-3 bg-warning-soft rounded-lg">
                  <p className="font-medium text-warning-700">프로 구독 중입니다</p>
                  <p className="mt-1 text-gray-700">
                    계정을 삭제하면 구독이 즉시 해지되며, 남은 이용 기간은 환불되지 않습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onPress={close}>
            취소
          </Button>
          <Button variant="danger" onPress={() => setStep('verify')}>
            계속
          </Button>
        </Modal.Footer>
      </React.Fragment>
    );
  }

  return <VerifyStep email={email} method={hasPassword ? 'password' : 'otp'} close={close} />;
}

function VerifyStep({ email, method, close }: { email?: string; method: AccountDeletionMethod; close: () => void }) {
  const router = useRouter();
  const formId = React.useId();
  const [state, action, isPending] = React.useActionState<DeleteAccountState, FormData>(deleteAccount, {
    fields: { method, password: '', otp: '' },
  });
  const form = useForm({ values: { password: '', otp: '' } });

  // 이메일 코드 발송 상태
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpMessage, setOtpMessage] = React.useState<string | null>(null);
  // 쿨다운 중 재요청처럼 오류가 아닌 안내
  const [otpNotice, setOtpNotice] = React.useState<string | null>(null);
  const [isSending, startSending] = React.useTransition();
  const [cooldown, setCooldown] = React.useState(0);
  // InputOTP 는 Form 의 validationErrors 를 모르므로 직접 넘기고, 다시 입력하면 지운다 (로그인 2단계 인증과 같은 방식)
  const [otpErrorDismissedAt, setOtpErrorDismissedAt] = React.useState<number | undefined>();

  // 다른 탭에서 재인증 수단이 바뀐 경우(Google 연결로 비밀번호 삭제 등) 화면의 hasPassword 를 다시 읽는다
  React.useEffect(() => {
    if (state.code === 'ACCOUNT_DELETE_REAUTH_REQUIRED') router.refresh();
  }, [state.code, state.timestamp, router]);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSendOtp = () => {
    startSending(async () => {
      let result: Awaited<ReturnType<typeof requestAccountDeletionOtp>>;
      try {
        result = await requestAccountDeletionOtp();
      }
      catch {
        // 서버 액션 호출 자체가 실패한 경우(오프라인 등). 예외가 트랜지션 밖으로 나가면 error boundary 가 화면을 덮는다
        setOtpNotice(null);
        setOtpMessage('인증 코드를 보내지 못했습니다. 연결을 확인한 뒤 다시 시도해주세요');
        return;
      }
      if (result.success) {
        setOtpSent(true);
        setOtpMessage(null);
        setOtpNotice(null);
        setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
        form.setValue('otp', '');
      }
      else if (result.code === 'ACCOUNT_DELETE_OTP_COOLDOWN') {
        // 방금 받은 코드가 아직 유효하다(모달을 닫았다 다시 연 경우 등). 입력칸을 열어 그 코드를 쓰게 한다
        setOtpSent(true);
        setOtpMessage(null);
        setOtpNotice('방금 보낸 코드가 아직 유효합니다. 메일로 받은 코드를 입력해주세요. 새 코드는 1분 뒤에 받을 수 있습니다.');
        setCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      }
      else {
        setOtpNotice(null);
        setOtpMessage(result.message ?? null);
        if (result.code === 'ACCOUNT_DELETE_REAUTH_REQUIRED') router.refresh();
      }
    });
  };

  const otpError = otpErrorDismissedAt === state.timestamp ? undefined : state.fieldErrors?.otp?.[0];
  const canSubmit = method === 'password' || otpSent;

  return (
    <React.Fragment>
      <Modal.Header>
        <Modal.Heading>본인 확인</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <Form
          id={formId}
          className="p-1 flex flex-col gap-4"
          action={action}
          validationErrors={state.fieldErrors}
        >
          <input type="hidden" name="method" value={method} />

          {state.message && !state.success && (
            <div role="alert" className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{state.message}</div>
          )}

          {method === 'password'
            ? (
                <>
                  <p className="text-sm text-gray-600">계정을 삭제하려면 현재 비밀번호를 입력하세요.</p>
                  <Controller
                    control={form.control}
                    name="password"
                    render={({ field: { name, value, onChange } }) => (
                      <TextField name={name} value={value} onChange={onChange} isRequired>
                        <Label>현재 비밀번호</Label>
                        <Input variant="secondary" type="password" autoComplete="current-password" placeholder="비밀번호" autoFocus />
                        <FieldError />
                      </TextField>
                    )}
                  />
                </>
              )
            : (
                <>
                  <p className="text-sm text-gray-600">
                    {otpSent
                      ? `${email ?? '계정 이메일'}(으)로 보낸 6자리 코드를 입력하세요. 코드는 10분 동안 유효합니다.`
                      : `계정을 삭제하려면 ${email ?? '계정 이메일'}(으)로 인증 코드를 받아 입력하세요.`}
                  </p>

                  {otpMessage && (
                    <div role="alert" className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{otpMessage}</div>
                  )}
                  {otpNotice && (
                    <div role="status" className="p-3 bg-gray-50 text-gray-700 rounded-lg text-sm">{otpNotice}</div>
                  )}

                  {otpSent && (
                    <Controller
                      control={form.control}
                      name="otp"
                      render={({ field: { name, value, onChange } }) => (
                        <div className="flex flex-col items-center gap-2">
                          <InputOTP
                            name={name}
                            value={value}
                            onChange={(next) => {
                              onChange(next);
                              setOtpErrorDismissedAt(state.timestamp);
                            }}
                            maxLength={6}
                            pattern={'^\\d*$'}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            autoFocus
                            variant="secondary"
                            className="w-auto"
                            aria-label="인증 코드"
                            isInvalid={!!otpError}
                            validationErrors={otpError ? [otpError] : undefined}
                          >
                            <InputOTP.Group>
                              {Array.from({ length: 6 }, (_, i) => (
                                <InputOTP.Slot key={i} index={i} />
                              ))}
                            </InputOTP.Group>
                          </InputOTP>
                          {otpError && <p className="text-sm text-danger">{otpError}</p>}
                        </div>
                      )}
                    />
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onPress={handleSendOtp}
                    isPending={isSending}
                    isDisabled={cooldown > 0 || isPending}
                  >
                    {otpSent
                      ? (cooldown > 0 ? `코드 다시 받기 (${cooldown}초)` : '코드 다시 받기')
                      : '인증 코드 받기'}
                  </Button>
                </>
              )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" isDisabled={isPending} onPress={close}>
          취소
        </Button>
        <Button form={formId} type="submit" variant="danger" isPending={isPending} isDisabled={!canSubmit}>
          계정 삭제
        </Button>
      </Modal.Footer>
    </React.Fragment>
  );
}
