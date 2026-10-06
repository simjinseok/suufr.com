'use client';
import * as React from 'react';
import { Button, FieldError, Form, Input, Label, Surface, TextField } from '@heroui/react';
import { Controller, useForm } from 'react-hook-form';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import QRCode from 'qrcode';

import {
  disableTwoFactor,
  enableTwoFactor,
  regenerateBackupCodes,
  verifyTwoFactorSetup,
  type BackupCodesState,
  type EnableTwoFactorState,
} from '@/actions/two-factor';

type Props = {
  enabled: boolean;
};

/**
 * 2단계 인증(TOTP) 설정. better-auth twoFactor 플러그인.
 * 등록: 비밀번호 확인 → QR(인증 앱) + 백업코드 표시 → 인증 앱 코드 확인 → 활성화.
 * QR 은 브라우저에서 그린다(TOTP URI 는 비밀이므로 외부 QR 서비스에 보내지 않는다).
 */
export default function TwoFactorSection({ enabled }: Props) {
  const [mode, setMode] = React.useState<'idle' | 'enroll' | 'disable' | 'backup'>('idle');

  return (
    <Surface className="p-5 border border-gray-50 rounded-xl shadow-xs">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            {enabled ? <ShieldCheck className="w-5 h-5 text-success" /> : <ShieldOff className="w-5 h-5 text-gray-400" />}
            2단계 인증
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {enabled
              ? '로그인할 때 비밀번호와 함께 인증 앱의 코드를 요구합니다.'
              : 'Google Authenticator, 1Password 같은 인증 앱으로 로그인을 한 번 더 보호합니다.'}
          </p>
        </div>
        {mode === 'idle' && (
          enabled
            ? (
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" onClick={() => setMode('backup')}>백업코드 재발급</Button>
                  <Button variant="danger-soft" size="sm" onClick={() => setMode('disable')}>해제</Button>
                </div>
              )
            : <Button variant="primary" size="sm" className="shrink-0" onClick={() => setMode('enroll')}>설정</Button>
        )}
      </div>

      {mode === 'enroll' && <EnrollFlow onDone={() => setMode('idle')} />}
      {mode === 'disable' && <DisableFlow onDone={() => setMode('idle')} />}
      {mode === 'backup' && <BackupCodesFlow onDone={() => setMode('idle')} />}
    </Surface>
  );
}

function PasswordField({ control, label = '현재 비밀번호' }: { control: any; label?: string }) {
  return (
    <Controller
      control={control}
      name="password"
      render={({ field: { name, value, onChange } }) => (
        <TextField name={name} value={value} onChange={onChange} isRequired>
          <Label>{label}</Label>
          <Input variant="secondary" type="password" autoComplete="current-password" placeholder="비밀번호" />
          <FieldError />
        </TextField>
      )}
    />
  );
}

function BackupCodesList({ codes }: { codes: string[] }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-700">백업코드</p>
      <p className="mt-1 text-xs text-gray-500">
        인증 앱을 쓸 수 없을 때 코드 대신 입력합니다. 각 코드는 한 번만 쓸 수 있습니다. 지금 안전한 곳에 보관하세요 — 다시 볼 수 없습니다.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-1 font-mono text-sm text-gray-900">
        {codes.map(code => <li key={code}>{code}</li>)}
      </ul>
      <Button variant="secondary" size="sm" className="mt-3" onClick={handleCopy}>
        {copied ? '복사됨' : '모두 복사'}
      </Button>
    </div>
  );
}

function EnrollFlow({ onDone }: { onDone: () => void }) {
  const [enableState, enableAction, isEnabling] = React.useActionState<EnableTwoFactorState, FormData>(enableTwoFactor, { fields: { password: '' } });
  const [verifyState, verifyAction, isVerifying] = React.useActionState(verifyTwoFactorSetup, { fields: { code: '' } });
  const passwordForm = useForm({ values: { password: '' } });
  const codeForm = useForm({ values: { code: '' } });
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enableState.totpURI) return;
    QRCode.toDataURL(enableState.totpURI, { width: 192, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [enableState.totpURI]);

  if (verifyState.success) {
    return (
      <div className="mt-5 flex flex-col gap-3">
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">2단계 인증이 활성화되었습니다.</div>
        <Button variant="secondary" size="sm" className="self-start" onClick={onDone}>닫기</Button>
      </div>
    );
  }

  if (enableState.success && enableState.totpURI) {
    const secret = new URL(enableState.totpURI).searchParams.get('secret');
    return (
      <div className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="shrink-0">
            {qrDataUrl
              ? <img src={qrDataUrl} alt="인증 앱 등록 QR 코드" width={192} height={192} className="rounded-lg border border-gray-100" />
              : <div className="w-48 h-48 rounded-lg bg-gray-100" />}
          </div>
          <div className="text-sm text-gray-600 flex flex-col gap-2">
            <p>1. 인증 앱에서 QR 코드를 스캔하세요.</p>
            {secret && (
              <p>
                스캔이 어려우면 키를 직접 입력:
                <code className="ml-1 font-mono text-xs break-all text-gray-900">{secret}</code>
              </p>
            )}
            <p>2. 앱에 표시된 6자리 코드를 아래에 입력하면 활성화됩니다.</p>
          </div>
        </div>

        {enableState.backupCodes && <BackupCodesList codes={enableState.backupCodes} />}

        <Form className="flex flex-col gap-3" action={verifyAction} validationErrors={verifyState.fieldErrors}>
          {verifyState.message && !verifyState.success && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{verifyState.message}</div>
          )}
          <Controller
            control={codeForm.control}
            name="code"
            render={({ field: { name, value, onChange } }) => (
              <TextField name={name} value={value} onChange={onChange} isRequired>
                <Label>인증 앱 코드</Label>
                <Input variant="secondary" type="text" inputMode="numeric" maxLength={6} placeholder="000000" autoComplete="one-time-code" />
                <FieldError />
              </TextField>
            )}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" size="sm" isPending={isVerifying}>활성화</Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>취소</Button>
          </div>
        </Form>
      </div>
    );
  }

  return (
    <Form className="mt-5 flex flex-col gap-3" action={enableAction} validationErrors={enableState.fieldErrors}>
      <p className="text-sm text-gray-600">계속하려면 현재 비밀번호를 입력하세요.</p>
      {enableState.message && !enableState.success && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{enableState.message}</div>
      )}
      <PasswordField control={passwordForm.control} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" isPending={isEnabling}>다음</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>취소</Button>
      </div>
    </Form>
  );
}

function DisableFlow({ onDone }: { onDone: () => void }) {
  const [state, action, isPending] = React.useActionState(disableTwoFactor, { fields: { password: '' } });
  const form = useForm({ values: { password: '' } });

  React.useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <Form className="mt-5 flex flex-col gap-3" action={action} validationErrors={state.fieldErrors}>
      <p className="text-sm text-gray-600">2단계 인증을 해제하면 비밀번호만으로 로그인할 수 있게 됩니다. 등록된 인증 앱과 백업코드는 삭제됩니다.</p>
      {state.message && !state.success && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{state.message}</div>
      )}
      <PasswordField control={form.control} />
      <div className="flex gap-2">
        <Button type="submit" variant="danger" size="sm" isPending={isPending}>해제</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>취소</Button>
      </div>
    </Form>
  );
}

function BackupCodesFlow({ onDone }: { onDone: () => void }) {
  const [state, action, isPending] = React.useActionState<BackupCodesState, FormData>(regenerateBackupCodes, { fields: { password: '' } });
  const form = useForm({ values: { password: '' } });

  if (state.success && state.backupCodes) {
    return (
      <div className="mt-5 flex flex-col gap-3">
        <BackupCodesList codes={state.backupCodes} />
        <Button variant="secondary" size="sm" className="self-start" onClick={onDone}>닫기</Button>
      </div>
    );
  }

  return (
    <Form className="mt-5 flex flex-col gap-3" action={action} validationErrors={state.fieldErrors}>
      <p className="text-sm text-gray-600">새 백업코드를 발급하면 기존 백업코드는 모두 쓸 수 없게 됩니다.</p>
      {state.message && !state.success && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{state.message}</div>
      )}
      <PasswordField control={form.control} />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" isPending={isPending}>재발급</Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>취소</Button>
      </div>
    </Form>
  );
}
