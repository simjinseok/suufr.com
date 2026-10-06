'use client';
import * as React from 'react';
import { Checkbox } from '@heroui/react';

export type ConsentKey = 'agreeTerms' | 'agreePrivacy';
export type ConsentValues = Record<ConsentKey, boolean>;

export const EMPTY_CONSENTS: ConsentValues = {
  agreeTerms: false,
  agreePrivacy: false,
};

export function isAllConsented(values: ConsentValues): boolean {
  return values.agreeTerms && values.agreePrivacy;
}

const ITEMS: Array<{ key: ConsentKey; label: string; href: string; description?: string }> = [
  { key: 'agreeTerms', label: '이용약관 동의', href: '/terms' },
  {
    key: 'agreePrivacy',
    label: '개인정보 수집·이용 동의',
    href: '/privacy',
    description: '서버·데이터베이스·이메일 발송은 AWS 일본(도쿄) 리전에서 처리되며, 결제(Paddle, 영국)·오류 분석(Sentry, 미국)·이용 통계(Google, 미국) 위탁을 포함합니다.',
  },
];

type Props = {
  values: ConsentValues;
  onChange: (values: ConsentValues) => void;
  // 서버 액션 fieldErrors — Checkbox 에는 FieldError 슬롯이 없어 블록 아래에 직접 표시한다
  errors?: Record<string, string | string[]>;
};

/**
 * 가입·재동의 공용 동의 체크박스 (전체 동의 + 필수 2개).
 * 각 항목은 hidden input 으로 'true' | 'false' 를 FormData 에 싣는다 (name 은 schemas/auth consentFields 와 동일).
 * "보기" 링크는 Checkbox.Content(클릭 영역) 바깥에 두어 링크 클릭이 체크를 토글하지 않게 한다.
 */
export default function ConsentCheckboxes({ values, onChange, errors }: Props) {
  const allChecked = isAllConsented(values);
  const someChecked = !allChecked && Object.values(values).some(Boolean);

  const setAll = (checked: boolean) =>
    onChange({ agreeTerms: checked, agreePrivacy: checked });

  const messages = ITEMS
    .map(item => errors?.[item.key])
    .flatMap(error => (Array.isArray(error) ? error : error ? [error] : []));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <Checkbox
        isSelected={allChecked}
        isIndeterminate={someChecked}
        onChange={setAll}
        variant="secondary"
      >
        <Checkbox.Content>
          <Checkbox.Control className="size-5">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <span className="text-sm font-semibold text-gray-900">전체 동의</span>
        </Checkbox.Content>
      </Checkbox>

      <div className="mt-3 border-t border-gray-200 pt-3 space-y-2.5">
        {ITEMS.map(item => (
          <div key={item.key}>
            <div className="flex items-start justify-between gap-3">
              <Checkbox
                isSelected={values[item.key]}
                onChange={checked => onChange({ ...values, [item.key]: checked })}
                variant="secondary"
              >
                <Checkbox.Content>
                  <Checkbox.Control className="size-5">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <span className="text-sm text-gray-700">
                    <span className="text-xs text-gray-400 mr-1">(필수)</span>
                    {item.label}
                  </span>
                </Checkbox.Content>
              </Checkbox>
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs text-gray-500 underline underline-offset-2 hover:text-gray-900"
              >
                보기
              </a>
            </div>
            {item.description && (
              <p className="mt-1 pl-7 text-xs leading-relaxed text-gray-400">{item.description}</p>
            )}
            <input type="hidden" name={item.key} value={values[item.key] ? 'true' : 'false'} />
          </div>
        ))}
      </div>

      {messages.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-sm text-danger">
          {messages.map(message => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
