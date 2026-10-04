# 작업 계획 요청: 개인정보처리방침 갱신 + 회원가입 약관/개인정보 동의

이 저장소(스프, 과외 일정·수업 관리 SaaS)의 출시를 앞두고 **개인정보처리방침을 실제 서비스 동작과 일치시키고, 회원가입 시 약관·개인정보 동의를 받는 작업의 구현 계획**을 세워줘. 이번 턴에서는 **코드를 수정하지 말고 계획만** 작성해. 계획은 `docs/plans/privacy-consent.md`에 저장하고, 각 단계가 어떤 파일을 왜 바꾸는지와 수용 기준(acceptance criteria)을 포함해야 해.

## 배경 (사전 점검에서 확인된 사실)

Monorepo: `apps/web`(Next.js 16 App Router, HeroUI v3, React Hook Form + Zod, 서버 액션은 `Sentry.withServerActionInstrumentation` 래핑), `apps/api`(NestJS 12 + Fastify, Prisma 7, AWS Cognito 인증). web은 Prisma를 쓰지 않고 `utils/api/*`를 통해 api를 HTTP로만 호출한다. 자세한 규칙은 `.claude/CLAUDE.md`를 먼저 읽어.

### 1. 개인정보처리방침이 실제 코드와 어긋나는 지점

파일: `apps/web/app/(legal)/privacy/page.tsx` (섹션 컴포넌트는 `apps/web/app/(legal)/_legal.tsx`의 `LegalTitle`/`LegalSection`/`LegalList`, 시행일 2026년 7월 8일, 섹션 1~12).

- **10. 쿠키의 사용** 섹션은 "광고·추적 목적의 쿠키는 사용하지 않는다"고 쓰여 있지만, `apps/web/app/layout.tsx`에서 `<GoogleAnalytics gaId="G-70QL7WW6SQ" />`로 Google Analytics를 하드코딩 로드하고 있다.
- `apps/web/instrumentation-client.ts`에서 Sentry Session Replay가 켜져 있다 (`replaysSessionSampleRate: 0.1`, `replaysOnErrorSampleRate: 1.0`, `maskAllText`/`blockAllMedia` on).
- **5. 개인정보 처리의 위탁 및 국외 이전** 섹션에 Paddle, AWS 서울 리전, Sentry는 있지만 **Google Analytics(Google LLC, 미국)와 Sentry Session Replay**가 빠져 있다.
- **11. 개인정보 보호책임자 및 문의처** 섹션에 이메일(support@suufr.com)만 있고 **성명·직책**이 없다. 개인정보보호법 제31조상 필수.
- 개인정보 **파기 절차·방법** 섹션과 **권익침해 구제방법**(개인정보침해신고센터, 개인정보분쟁조정위원회, 대검찰청, 경찰청 사이버수사국 연락처) 섹션이 없다. 둘 다 표준 필수 항목.
- 수집 항목 섹션(1)이 Cognito에 저장되는 이름·이메일·비밀번호 외에, 서비스가 실제로 수집하는 접속 로그·IP·기기 정보(Sentry/GA가 수집), Google 캘린더 연동 토큰(`apps/api/src/crypto/crypto.service.ts`로 암호화 저장) 등을 빠짐없이 다루는지 검토가 필요하다.
- 같은 폴더의 `terms/page.tsx`는 "설정에서 탈퇴 가능"이라고 쓰여 있지만 회원탈퇴 기능은 아직 없다. **탈퇴 기능 구현은 이 작업의 범위 밖**이지만, 방침·약관 문구가 미구현 기능을 약속하지 않도록 어떻게 다룰지는 계획에 포함해(예: 문구를 "문의를 통해 탈퇴 요청" 으로 임시 수정할지, 탈퇴 기능과 동시에 출시할지 선택지와 권고).

### 2. 회원가입에 동의 절차가 전혀 없다

- 폼: `apps/web/app/(auth)/signup/signup-form.tsx` (HeroUI `Form`/`TextField` + `Controller`, `useActionState`로 `signup` 서버 액션 호출). 필드는 name/email/password/passwordConfirm뿐.
- Zod 스키마: `apps/web/schemas/auth.ts`의 `signupSchema`.
- 서버 액션: `apps/web/actions/auth.ts`의 `signup` → `authApi.signup({ name, email, password })`.
- API: `apps/api/src/auth/auth.controller.ts`의 `POST /api/auth/signup` → `apps/api/src/auth/dto/signup.dto.ts`의 `SignupDto`(name/email/password) → `apps/api/src/auth/cognito.service.ts`의 `signup()`이 Cognito `SignUpCommand`로 가입.
- **Prisma에 User 테이블이 없다.** 사용자 주 저장소는 Cognito이고, DB에는 `UserSettings`(`userId`가 Cognito sub를 직접 참조, `apps/api/prisma/schema.prisma`)처럼 Cognito sub를 키로 쓰는 테이블만 있다. 첫 로그인 때 `cognito.service.ts`의 `ensureUserWithOrganization()`이 Organization을 만든다. 가입 시점(이메일 미인증 상태)에는 DB 레코드가 없다는 점을 고려해 **동의 이력을 어디에 어떻게 기록할지** 설계가 필요하다.
- 법적 요건: 이용약관 동의(필수), 개인정보 수집·이용 동의(필수), **개인정보 국외이전 동의(필수)** — Paddle(결제, 영국/미국), Sentry(미국), Google Analytics(미국)로 이전되므로 별도 고지·동의가 필요하다. 마케팅 수신 동의는 현재 이메일 발송 기능이 없으므로 넣지 않는 쪽을 기본으로 하되 근거를 적어.

## 계획에 반드시 포함할 내용

1. **방침 개정안 목차**: 현재 12개 섹션 중 수정할 섹션과 신설할 섹션을 번호별로 명시. 각 섹션에 들어갈 핵심 문장 초안(한국어)을 포함. 시행일을 어떻게 갱신하고 개정 이력을 어디에 남길지(12. 고지 의무 섹션 활용 등).
2. **GA·Replay 처리 결정**: 다음 세 선택지의 장단점과 권고 1개 — (a) 방침에 고지만 하고 그대로 유지, (b) 쿠키/추적 동의 배너 뒤로 게이팅, (c) GA 제거 또는 Replay 비활성화. GA 측정 ID를 하드코딩 대신 환경변수로 옮기는 작업 포함 여부.
3. **동의 수집 UX 설계**: 가입 폼에 들어갈 체크박스 구성(전체 동의, 필수 3개 개별 동의), 각 항목 옆 약관/방침 링크(`/terms`, `/privacy`, 새 탭), 미동의 시 에러 메시지 문구와 HeroUI v3 컴포넌트 선택(`Checkbox`, `CheckboxGroup` 등 실제 v3 API 확인). Zod 스키마 변경안(`z.literal(true)` 등).
4. **동의 이력 저장 설계**: 선택지 비교 후 권고 — (a) Cognito custom attribute, (b) Prisma에 `UserConsent`(또는 유사) 테이블 신설 후 가입 직후 또는 첫 로그인 시 기록, (c) 둘 다. 저장할 필드(동의 종류, 동의한 문서 버전/시행일, 동의 시각, IP·UA 저장 여부와 그에 따른 방침 반영). 테이블을 만든다면 CLAUDE.md의 Prisma 절차(`prisma:migrate -- --create-only`, 마이그레이션 파일명 정렬 주의)를 계획에 그대로 반영.
5. **API 변경**: `SignupDto`에 동의 필드 추가와 class-validator 검증, `cognito.service.ts` `signup()` 흐름 변경, 가입 시점에 DB 레코드가 없을 때 이력을 남기는 방법. 기존 가입자(동의 이력 없음)를 어떻게 처리할지 — 다음 로그인 시 재동의 모달을 띄울지, 방침 개정 고지로 갈음할지 선택지와 권고.
6. **방침 개정 시 재동의 체계**: 문서 버전(시행일)을 코드 상수로 관리하고 사용자의 동의 버전과 비교하는 구조를 둘지 여부. 이번 범위에 넣을지, 후속으로 미룰지 명시.
7. **단계별 작업 순서와 파일 목록**: 각 단계마다 수정 파일(경로), 변경 요지, 수용 기준, 테스트 방법(현재 저장소에 테스트가 0개이므로 최소한 `signupSchema` 유닛 테스트와 `SignupDto` 검증 테스트를 추가하는 안 포함). web은 `pnpm --filter web exec tsc --noEmit`, api는 `pnpm --filter api exec tsc --noEmit -p tsconfig.json`으로 타입 확인.
8. **사용자에게 받아야 할 입력 목록**: 개인정보 보호책임자 성명·직책, 사업자 상호·주소 등 방침에 들어가야 하지만 코드에서 알 수 없는 값. 계획서 상단에 "확인 필요" 표로 정리하고, 값이 올 때까지는 플레이스홀더로 두되 빌드가 플레이스홀더를 잡아낼 방법(예: 특정 토큰 grep)을 제안해.

## 제약

- 코드 수정 금지. 계획 문서만 작성.
- 법률 자문이 아님을 전제로, 개인정보보호법·정보통신망법·전자상거래법상 일반적으로 요구되는 항목을 근거로 작성하고, 확신이 없는 조항은 "법률 검토 권장"으로 표시.
- 기존 UI 스타일(HeroUI v3, Tailwind CSS 4 — v3 문법 금지, CLAUDE.md 표 참고)을 따르는 방향으로 설계.
- 계획서는 한국어로.
