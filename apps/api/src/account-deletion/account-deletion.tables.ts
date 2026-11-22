import type { Prisma } from '@prisma/generated/client';

/**
 * 계정 삭제 시 모든 Prisma 모델의 처리 분류. 모델을 추가·변경하면 account-deletion.tables.spec.ts 가
 * "어느 목록에도 없는 모델"로 실패하므로, 여기에 분류를 정하고 AccountDeletionService.deleteUserRows 에 삭제를 넣는다.
 */

/** 탈퇴 트랜잭션이 직접 deleteMany 하는 모델 (소프트 삭제된 행 포함). 순서는 AccountDeletionService.deleteUserRows 참고 */
export const DELETED_MODELS = [
  'Organization',
  'Student',
  'Invoice',
  'Payment',
  'InvoicePayment',
  'Session',
  'Feedback',
  'Lesson',
  'LessonShare',
  'StudentShare',
  'StudentComment',
  'StudentStatus',
  'Meeting',
  'Curriculum',
  'CurriculumSection',
  'CurriculumItem',
  'CurriculumItemMediaFile',
  'Folder',
  'MediaFile',
  'SessionMediaFile',
  'UserSettings',
  'UserStorageQuota',
  'AppToken',
  'ExternalServiceToken',
  'GoogleSyncToken',
  'SessionGoogleEvent',
  'StudentGoogleContact',
  'UserSubscription',
  // better-auth 검증 값 중 그 사용자의 것(이메일 OTP 식별자, 탈퇴 OTP, 값이 userId 인 재설정 토큰)
  'Verification',
  'User',
] as const satisfies readonly Prisma.ModelName[];

/** users 행 삭제 때 FK onDelete: Cascade 로 함께 지워지는 모델 (better-auth 테이블) */
export const CASCADE_MODELS = [
  'AuthSession',
  'Account',
  'TwoFactor',
] as const satisfies readonly Prisma.ModelName[];

/**
 * 탈퇴 후에도 남기는 모델 (개인정보처리방침 3조 분리 보관). 파기 크론(AccountDeletionCleanupService)이 기간이 지나면 지운다.
 * - SubscriptionOrder: 대금결제 기록 5년 (전자상거래법)
 * - UserConsent: 동의 이력 탈퇴 후 3년 (IP·UA 포함)
 * - AccountDeletion: 탈퇴 기록(이메일 HMAC) — 보존 데이터와 사람을 잇는 고리. 5년
 */
export const RETAINED_MODELS = [
  'SubscriptionOrder',
  'UserConsent',
  'AccountDeletion',
] as const satisfies readonly Prisma.ModelName[];

/**
 * 사용자와 무관한 모델.
 * - Jwks: 서명 키
 * - BillingWebhookEvent: 웹훅 원문. 고객 이메일이 들어 있을 수 있지만 대금결제 기록의 일부로 보고 subscription_orders 와 같이
 *   5년 보존한다(계획 결정 4). 사용자 컬럼이 없어 탈퇴 트랜잭션은 건드리지 않고, 파기 크론이 원문의 custom_data.userId 로 찾아 지운다
 */
export const UNRELATED_MODELS = [
  'Jwks',
  'BillingWebhookEvent',
] as const satisfies readonly Prisma.ModelName[];

/** Prisma.ModelName → 클라이언트 delegate 이름 (UserSettings → userSettings) */
export function delegateName(model: Prisma.ModelName): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}
