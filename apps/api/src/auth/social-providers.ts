/** 소셜 로그인 제공자 (현재 Google). 경로 파라미터 :provider 는 이 목록으로만 허용한다 */
export const SUPPORTED_SOCIAL_PROVIDERS = ['google'] as const;
export type SocialProvider = (typeof SUPPORTED_SOCIAL_PROVIDERS)[number];

export function isSupportedSocialProvider(provider: string): provider is SocialProvider {
  return (SUPPORTED_SOCIAL_PROVIDERS as readonly string[]).includes(provider);
}
