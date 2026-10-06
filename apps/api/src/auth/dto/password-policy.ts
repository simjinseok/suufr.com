/**
 * 비밀번호 정책 — 8자 이상, 대문자·소문자·숫자·특수문자.
 * better-auth 자체는 길이(8~128)만 검사하므로 DTO 에서 강제한다. apps/web/schemas/auth.ts 의 passwordSchema 와 같은 규칙.
 */
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;
export const PASSWORD_POLICY_MESSAGE = '비밀번호는 8자 이상이며 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다';
