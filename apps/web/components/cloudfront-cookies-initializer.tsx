'use client';

import { useEffect, useRef } from 'react';

/**
 * CloudFront Signed Cookies를 초기화하는 컴포넌트
 * 앱 레이아웃에 포함하여 인증된 사용자가 보호된 파일에 접근할 수 있도록 함
 */
export function CloudFrontCookiesInitializer() {
  const initialized = useRef(false);

  useEffect(() => {
    // 이미 초기화되었으면 스킵 (StrictMode에서 중복 호출 방지)
    if (initialized.current) return;
    initialized.current = true;

    // CloudFront 쿠키 설정 API 호출
    // credentials: 'include'로 크로스 도메인 쿠키 설정 가능
    fetch('/api/auth/session/cookies', {
      method: 'POST',
      credentials: 'include',
    }).catch((error) => {
      // 실패해도 앱 동작에 영향 없음 (파일 접근만 제한됨)
      console.warn('Failed to initialize CloudFront cookies:', error);
    });
  }, []);

  return null;
}
