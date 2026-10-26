import { Transform } from 'class-transformer';

/**
 * 요청 원본 값을 그대로 두어 `@IsBoolean()` 이 문자열을 거부하게 한다.
 * 전역 ValidationPipe 의 enableImplicitConversion 은 boolean 필드를 `Boolean(값)` 으로 바꿔 "false" 도 true 가 된다.
 * class-transformer 는 implicit conversion 다음에 @Transform 을 실행하므로, 여기서 원본을 되돌린다.
 * `@IsBoolean()` 이 붙은 body 필드에는 항상 함께 붙인다.
 */
export const StrictBoolean = () => Transform(({ obj, key }) => (obj as Record<string, unknown>)[key]);
