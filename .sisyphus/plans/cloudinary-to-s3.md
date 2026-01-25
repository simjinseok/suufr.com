# Cloudinary to AWS S3 Migration

## Context

### Original Request
Cloudinary에서 AWS S3로 파일 스토리지를 마이그레이션. 브라우저에서 직접 업로드(presigned URL)를 원하며, CardDAV는 서버에서 직접 업로드.

### Interview Summary
**Key Discussions**:
- 마이그레이션 범위: 전체 교체 (신규 + 기존 파일 이전)
- 브라우저 업로드: presigned URL 방식
- CardDAV 업로드: 서버 직접 업로드 (presigned URL과 병행)
- 이미지 변환: 클라이언트 측에서 업로드 전 처리 (현재 패턴 유지)
- 파일 타입: 이미지 + 동영상 모두
- CDN: Bunny CDN (이미 설정됨, Origin을 S3로 연결)
- S3 인프라: 버킷 및 IAM 이미 준비됨

**Research Findings**:
- 현재 Cloudinary 사용: unsigned preset으로 temp 폴더 업로드 → 서버에서 최종 폴더로 이동
- 이미지 변환: 프로필 200x200 크롭, WebP 자동변환, 품질 자동조정
- S3는 AWS SDK v3 사용 (presigned URL + 서버 직접 업로드 모두 지원)

### Metis Review
**Identified Gaps** (addressed):
- CardDAV 서버 사이드 업로드: S3Client.send(PutObjectCommand)로 직접 업로드
- 누락된 서비스: curriculums.service.ts 포함
- Asset routes: student/[key], organization/[key] 업데이트 필요
- image.util.ts: optimizeCloudinaryUrl → Bunny CDN URL로 변경

---

## Work Objectives

### Core Objective
Cloudinary 의존성을 완전히 제거하고 AWS S3 + Bunny CDN 기반의 파일 스토리지 시스템으로 전환

### Concrete Deliverables
- S3 서비스 (NestJS): presigned URL 생성 + 서버 직접 업로드
- Presigned URL API 엔드포인트 (NestJS)
- 클라이언트 업로드 유틸리티 (Next.js)
- 7개 서비스 업데이트 (students, organizations, storage, sessions, curriculums, carddav, carddav/utils)
- 5개 컴포넌트 업데이트 (profile uploads, logo, media zone, filter bar)
- 2개 asset routes 업데이트 (student, organization)
- URL 유틸리티 업데이트 (Bunny CDN 패턴)
- 마이그레이션 스크립트 (Cloudinary → S3)
- S3 CORS 설정 가이드

### Definition of Done
- [ ] 모든 파일 업로드가 S3로 전송됨
- [ ] 기존 Cloudinary 파일이 S3로 이전됨
- [ ] 모든 이미지/동영상이 Bunny CDN을 통해 제공됨
- [ ] Cloudinary 관련 코드 및 환경변수 제거됨
- [ ] 브라우저 및 서버 업로드 모두 정상 동작

### Must Have
- presigned URL로 브라우저 직접 업로드
- 서버 직접 업로드 (CardDAV용)
- 기존 파일 마이그레이션 스크립트
- Bunny CDN URL 패턴 적용

### Must NOT Have (Guardrails)
- Cloudinary SDK 사용 금지 (완전 제거)
- 서버를 통한 파일 프록시 금지 (presigned URL 직접 업로드)
- 새로운 이미지 변환 서비스 도입 금지 (클라이언트 측 처리 유지)
- S3 버킷 퍼블릭 액세스 금지 (Bunny CDN Origin으로만 접근)

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (Vitest in web app)
- **User wants tests**: NO (Manual QA)
- **Framework**: N/A

### Manual QA Only

**CRITICAL**: 테스트 코드 없이 진행. 각 TODO에 상세한 수동 검증 절차 포함.

**검증 방법:**
| Type | Tool | Procedure |
|------|------|-----------|
| API 엔드포인트 | curl / httpie | presigned URL 생성 및 업로드 테스트 |
| 브라우저 업로드 | Playwright | 파일 선택 → 업로드 → 확인 |
| 이미지 표시 | 브라우저 | Bunny CDN URL로 이미지 로드 확인 |
| 마이그레이션 | 스크립트 실행 | 파일 카운트 및 URL 검증 |

---

## Task Flow

```
1. S3 서비스 생성 (API)
    ↓
2. Presigned URL API 엔드포인트 (API)
    ↓
3. 클라이언트 업로드 유틸리티 (Web)
    ↓
4~10. 서비스/컴포넌트 업데이트 (병렬 가능)
    ↓
11. Asset routes 업데이트
    ↓
12. 환경변수 정리
    ↓
13. 마이그레이션 스크립트 작성 및 실행
    ↓
14. Cloudinary 코드 제거
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 4, 5, 6, 7, 8, 9, 10 | 독립적인 서비스/컴포넌트 업데이트 |

| Task | Depends On | Reason |
|------|------------|--------|
| 2 | 1 | S3Service 필요 |
| 3 | 2 | API 엔드포인트 필요 |
| 4-10 | 1, 3 | S3Service + 클라이언트 유틸리티 필요 |
| 11 | 1 | S3Service 필요 |
| 13 | 4-12 | 모든 코드 업데이트 완료 후 |
| 14 | 13 | 마이그레이션 완료 후 |

---

## TODOs

- [x] 1. S3 서비스 생성 (NestJS)

  **What to do**:
  - `apps/api/src/s3/s3.service.ts` 생성
  - `apps/api/src/s3/s3.module.ts` 생성
  - AWS SDK v3 설치: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`
  - 메서드 구현:
    - `getPresignedUploadUrl(key, contentType, expiresIn)` - presigned PUT URL 생성
    - `uploadFile(key, body, contentType)` - 서버 직접 업로드 (CardDAV용)
    - `deleteFile(key)` - 파일 삭제
    - `moveFile(sourceKey, destKey)` - 파일 이동 (복사 후 삭제)
  - S3Client 설정: region, credentials from env

  **Must NOT do**:
  - Cloudinary SDK 사용
  - 파일 다운로드 후 재업로드 (S3 copy 사용)

  **Parallelizable**: NO (기반 작업)

  **References**:
  - `apps/api/src/cloudinary/cloudinary.service.ts` - 현재 구조 참고 (교체 대상)
  - `apps/api/src/cloudinary/cloudinary.module.ts` - 모듈 구조 참고
  - AWS SDK v3 S3 docs: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/javascript_s3_code_examples.html

  **Acceptance Criteria**:
  - [ ] `apps/api/src/s3/s3.service.ts` 생성됨
  - [ ] `apps/api/src/s3/s3.module.ts` 생성됨
  - [ ] curl로 presigned URL 생성 테스트:
    ```bash
    # NestJS 서버 실행 후
    curl http://localhost:3000/api/storage/presigned-url \
      -H "Content-Type: application/json" \
      -d '{"fileName": "test.jpg", "contentType": "image/jpeg"}'
    ```
    → presignedUrl, key 반환 확인
  - [ ] presigned URL로 파일 업로드 테스트:
    ```bash
    curl -X PUT "<presigned-url>" \
      -H "Content-Type: image/jpeg" \
      --data-binary @test.jpg
    ```
    → HTTP 200 응답

  **Commit**: YES
  - Message: `feat(api): add S3 service with presigned URL support`
  - Files: `apps/api/src/s3/*`, `apps/api/package.json`
  - Pre-commit: `cd apps/api && pnpm build`

---

- [x] 2. Presigned URL API 엔드포인트 생성

  **What to do**:
  - `apps/api/src/storage/storage.controller.ts`에 presigned URL 엔드포인트 추가
  - POST `/storage/presigned-url` - 업로드용 presigned URL 생성
  - 요청 본문: `{ fileName, contentType, fileSize }`
  - 응답: `{ presignedUrl, key, expiresAt }`
  - 파일 크기 검증 (이미지 10MB, 동영상 100MB)
  - 허용된 contentType 검증

  **Must NOT do**:
  - 인증 없이 presigned URL 생성 허용
  - 파일 크기 제한 없이 허용

  **Parallelizable**: NO (Task 1 완료 필요)

  **References**:
  - `apps/api/src/storage/storage.controller.ts` - 현재 storage 컨트롤러 (확장)
  - `apps/web/utils/cloudinary-upload.ts:14-15` - 파일 크기 제한 참고 (IMAGE_MAX_SIZE, VIDEO_MAX_SIZE)

  **Acceptance Criteria**:
  - [ ] POST `/storage/presigned-url` 엔드포인트 동작
  - [ ] 인증된 요청만 허용 (401 for unauthenticated)
  - [ ] 파일 크기 초과 시 400 에러
  - [ ] 허용되지 않은 contentType 시 400 에러
  - [ ] curl 테스트:
    ```bash
    curl -X POST http://localhost:3000/api/storage/presigned-url \
      -H "Authorization: Bearer <token>" \
      -H "Content-Type: application/json" \
      -d '{"fileName": "test.jpg", "contentType": "image/jpeg", "fileSize": 1024}'
    ```
    → `{ presignedUrl, key, expiresAt }` 반환

  **Commit**: YES
  - Message: `feat(api): add presigned URL endpoint for S3 uploads`
  - Files: `apps/api/src/storage/storage.controller.ts`
  - Pre-commit: `cd apps/api && pnpm build`

---

- [x] 3. 클라이언트 업로드 유틸리티 생성 (Next.js)

  **What to do**:
  - `apps/web/utils/s3-upload.ts` 생성 (cloudinary-upload.ts 대체)
  - 함수: `uploadToS3(file, options)` 
    - presigned URL API 호출
    - 브라우저에서 직접 S3로 PUT 요청
    - 진행률 콜백 지원
  - 함수: `getS3PublicUrl(key)` - Bunny CDN URL 생성
  - 파일 타입 및 크기 검증 (클라이언트 측 사전 검증)

  **Must NOT do**:
  - 서버를 통한 파일 프록시
  - Cloudinary SDK 사용

  **Parallelizable**: NO (Task 2 완료 필요)

  **References**:
  - `apps/web/utils/cloudinary-upload.ts` - 현재 업로드 유틸리티 (교체 대상)
  - `apps/web/utils/cloudinary-url.ts` - URL 유틸리티 참고

  **Acceptance Criteria**:
  - [ ] `apps/web/utils/s3-upload.ts` 생성됨
  - [ ] 브라우저에서 파일 업로드 테스트 (개발자 도구 Network 탭):
    - presigned URL API 호출 확인
    - S3로 PUT 요청 확인 (CORS 에러 없음)
    - 업로드 완료 후 key 반환 확인
  - [ ] Bunny CDN URL 생성 테스트:
    ```typescript
    getS3PublicUrl('uploads/test.jpg')
    // → https://<bunny-cdn-domain>/uploads/test.jpg
    ```

  **Commit**: YES
  - Message: `feat(web): add S3 upload utility with presigned URL`
  - Files: `apps/web/utils/s3-upload.ts`
  - Pre-commit: `cd apps/web && pnpm build`

---

- [x] 4. Students 서비스 업데이트

  **What to do**:
  - `apps/api/src/students/students.service.ts` 업데이트
  - CloudinaryService → S3Service 교체
  - `moveProfileImage` 로직: temp key → final key 이동
  - 프로필 이미지 삭제 시 S3 삭제 호출

  **Must NOT do**:
  - 이미지 변환 서버 측 처리 (클라이언트에서 이미 처리됨)

  **Parallelizable**: YES (with 5, 6, 7, 8, 9, 10)

  **References**:
  - `apps/api/src/students/students.service.ts` - 현재 구현 (업데이트 대상)
  - `apps/api/src/cloudinary/cloudinary.service.ts:moveProfileImage` - 현재 로직 참고

  **Acceptance Criteria**:
  - [ ] CloudinaryService import 제거됨
  - [ ] S3Service 주입 및 사용
  - [ ] 프로필 이미지 업데이트 API 호출 → S3에 파일 존재 확인
  - [ ] 수동 테스트: 프로필 이미지 변경 후 Bunny CDN URL로 이미지 로드

  **Commit**: YES (with 5, 6, 7, 8, 9, 10)
  - Message: `refactor(api): migrate services from Cloudinary to S3`
  - Files: `apps/api/src/students/students.service.ts`, `apps/api/src/organizations/organizations.service.ts`, etc.
  - Pre-commit: `cd apps/api && pnpm build`

---

- [x] 5. Organizations 서비스 업데이트

  **What to do**:
  - `apps/api/src/organizations/organizations.service.ts` 업데이트
  - CloudinaryService → S3Service 교체
  - 프로필 이미지, 로고 이미지 처리

  **Must NOT do**:
  - 이미지 변환 서버 측 처리

  **Parallelizable**: YES (with 4, 6, 7, 8, 9, 10)

  **References**:
  - `apps/api/src/organizations/organizations.service.ts` - 현재 구현

  **Acceptance Criteria**:
  - [ ] CloudinaryService import 제거됨
  - [ ] 조직 프로필/로고 업데이트 → S3에 파일 존재 확인

  **Commit**: YES (with 4)

---

- [x] 6. Sessions 서비스 업데이트

  **What to do**:
  - `apps/api/src/sessions/sessions.service.ts` 업데이트
  - CloudinaryService → S3Service 교체
  - 미디어 파일 (이미지/동영상) 처리

  **Must NOT do**:
  - 동영상 변환 처리

  **Parallelizable**: YES (with 4, 5, 7, 8, 9, 10)

  **References**:
  - `apps/api/src/sessions/sessions.service.ts` - 현재 구현

  **Acceptance Criteria**:
  - [ ] CloudinaryService import 제거됨
  - [ ] 세션 미디어 업로드 → S3에 파일 존재 확인

  **Commit**: YES (with 4)

---

- [x] 7. Curriculums 서비스 업데이트

  **What to do**:
  - `apps/api/src/curriculums/curriculums.service.ts` 업데이트
  - CloudinaryService → S3Service 교체
  - 커리큘럼 미디어 파일 처리

  **Must NOT do**:
  - 미디어 변환 처리

  **Parallelizable**: YES (with 4, 5, 6, 8, 9, 10)

  **References**:
  - `apps/api/src/curriculums/curriculums.service.ts` - 현재 구현

  **Acceptance Criteria**:
  - [ ] CloudinaryService import 제거됨
  - [ ] 커리큘럼 미디어 업로드 → S3에 파일 존재 확인

  **Commit**: YES (with 4)

---

- [x] 8. CardDAV 서비스 업데이트 (서버 직접 업로드)

  **What to do**:
  - `apps/api/src/carddav/carddav.service.ts` 업데이트
  - CloudinaryService → S3Service 교체
  - `uploadPhoto(base64Data)`: S3Service.uploadFile() 사용 (서버 직접 업로드)
  - base64 → Buffer 변환 후 S3 업로드

  **Must NOT do**:
  - presigned URL 사용 (서버에서 직접 업로드해야 함)

  **Parallelizable**: YES (with 4, 5, 6, 7, 9, 10)

  **References**:
  - `apps/api/src/carddav/carddav.service.ts` - 현재 구현
  - `apps/api/src/cloudinary/cloudinary.service.ts:uploadPhoto` - 현재 로직 참고

  **Acceptance Criteria**:
  - [ ] CloudinaryService import 제거됨
  - [ ] CardDAV 사진 동기화 테스트:
    - Apple Contacts에서 사진 포함 연락처 동기화
    - S3에 사진 파일 존재 확인

  **Commit**: YES (with 4)

---

- [x] 9. CardDAV 이미지 유틸리티 업데이트

  **What to do**:
  - `apps/api/src/carddav/utils/image.util.ts` 업데이트
  - `optimizeCloudinaryUrl()` → Bunny CDN URL 패턴으로 변경
  - `fetchImageAsBase64()`: Bunny CDN URL에서 이미지 fetch

  **Must NOT do**:
  - Cloudinary URL 패턴 유지

  **Parallelizable**: YES (with 4, 5, 6, 7, 8, 10)

  **References**:
  - `apps/api/src/carddav/utils/image.util.ts` - 현재 구현

  **Acceptance Criteria**:
  - [ ] Cloudinary URL 패턴 제거됨
  - [ ] Bunny CDN URL로 이미지 fetch 성공

  **Commit**: YES (with 4)

---

- [x] 10. Storage 컨트롤러 업데이트

  **What to do**:
  - `apps/api/src/storage/storage.controller.ts` 업데이트
  - CloudinaryService → S3Service 교체
  - 파일 삭제 로직 업데이트

  **Must NOT do**:
  - Cloudinary 호출

  **Parallelizable**: YES (with 4, 5, 6, 7, 8, 9)

  **References**:
  - `apps/api/src/storage/storage.controller.ts` - 현재 구현

  **Acceptance Criteria**:
  - [ ] CloudinaryService import 제거됨
  - [ ] 파일 삭제 API → S3에서 파일 삭제 확인

  **Commit**: YES (with 4)

---

- [x] 11. 클라이언트 컴포넌트 업데이트

  **What to do**:
  - 5개 컴포넌트에서 cloudinary-upload → s3-upload 교체:
    - `apps/web/components/student/profile-image-upload.tsx`
    - `apps/web/components/organization/profile-image-upload.tsx`
    - `apps/web/components/organization/logo-upload.tsx`
    - `apps/web/components/media/media-file-upload-zone.tsx`
    - `apps/web/app/(app)/settings/files/_filter-bar.tsx`
  - URL 유틸리티도 교체 (cloudinary-url → bunny-url)

  **Must NOT do**:
  - 클라이언트 이미지 리사이즈 로직 변경 (유지)

  **Parallelizable**: NO (Task 3 완료 필요)

  **References**:
  - `apps/web/components/student/profile-image-upload.tsx` - 현재 구현
  - `apps/web/utils/cloudinary-upload.ts` - 교체 대상

  **Acceptance Criteria**:
  - [ ] cloudinary-upload import 제거됨
  - [ ] s3-upload import 사용
  - [ ] Playwright 테스트:
    - 프로필 이미지 업로드 페이지 방문
    - 파일 선택 및 업로드
    - 이미지 표시 확인 (Bunny CDN URL)

  **Commit**: YES
  - Message: `refactor(web): migrate upload components to S3`
  - Files: `apps/web/components/**/*upload*.tsx`, `apps/web/app/(app)/settings/files/_filter-bar.tsx`
  - Pre-commit: `cd apps/web && pnpm build`

---

- [x] 12. Asset Routes 업데이트

  **What to do**:
  - `apps/web/app/assets/student/[key]/route.ts` 업데이트
  - `apps/web/app/assets/organization/[key]/route.ts` 업데이트
  - Cloudinary URL → Bunny CDN URL로 redirect

  **Must NOT do**:
  - 이미지 프록시 (redirect만 사용)

  **Parallelizable**: YES (with 11)

  **References**:
  - `apps/web/app/assets/student/[key]/route.ts` - 현재 구현
  - `apps/web/app/assets/organization/[key]/route.ts` - 현재 구현

  **Acceptance Criteria**:
  - [ ] Cloudinary URL 패턴 제거됨
  - [ ] `/assets/student/<key>` 접근 → Bunny CDN URL로 redirect
  - [ ] `/assets/organization/<key>` 접근 → Bunny CDN URL로 redirect

  **Commit**: YES
  - Message: `refactor(web): update asset routes to use Bunny CDN`
  - Files: `apps/web/app/assets/**/*.ts`
  - Pre-commit: `cd apps/web && pnpm build`

---

- [x] 13. URL 유틸리티 업데이트

  **What to do**:
  - `apps/web/utils/cloudinary-url.ts` → `apps/web/utils/bunny-url.ts`로 교체 또는 업데이트
  - `apps/web/utils/cloudinary-url.server.ts` → 업데이트 또는 제거
  - Bunny CDN URL 패턴 적용
  - Bunny Optimizer 파라미터 사용 (width, height, quality)

  **Must NOT do**:
  - Cloudinary 변환 파라미터 유지

  **Parallelizable**: YES (with 11, 12)

  **References**:
  - `apps/web/utils/cloudinary-url.ts` - 현재 구현
  - `apps/web/utils/cloudinary-url.server.ts` - 현재 구현
  - Bunny Optimizer docs: https://docs.bunny.net/docs/stream-image-processing

  **Acceptance Criteria**:
  - [ ] Cloudinary URL 함수 제거됨
  - [ ] Bunny CDN URL 생성 함수 동작
  - [ ] 이미지 최적화 파라미터 적용 확인

  **Commit**: YES
  - Message: `refactor(web): replace Cloudinary URL utils with Bunny CDN`
  - Files: `apps/web/utils/bunny-url.ts` (or updated files)
  - Pre-commit: `cd apps/web && pnpm build`

---

- [x] 14. 환경변수 설정

  **What to do**:
  - API 환경변수 추가:
    ```
    AWS_REGION=ap-northeast-2
    AWS_ACCESS_KEY_ID=xxx
    AWS_SECRET_ACCESS_KEY=xxx
    S3_BUCKET_NAME=xxx
    ```
  - Web 환경변수 추가:
    ```
    NEXT_PUBLIC_CDN_URL=https://<bunny-cdn-domain>
    ```
  - .env.example 파일 업데이트

  **Must NOT do**:
  - AWS credentials를 클라이언트에 노출

  **Parallelizable**: YES (언제든 가능)

  **References**:
  - `apps/api/.env` - 현재 환경변수
  - `apps/web/.env` - 현재 환경변수

  **Acceptance Criteria**:
  - [ ] API에서 S3 환경변수 사용 가능
  - [ ] Web에서 CDN URL 환경변수 사용 가능
  - [ ] .env.example 파일에 새 변수 문서화

  **Commit**: YES
  - Message: `chore: add S3 and Bunny CDN environment variables`
  - Files: `.env.example` files (NOT actual .env files)
  - Pre-commit: N/A

---

- [x] 15. S3 CORS 설정

  **What to do**:
  - S3 버킷 CORS 정책 설정 (AWS Console 또는 CLI)
  - 허용 origin: 프로덕션 도메인 + localhost (개발용)
  - 허용 메서드: PUT
  - 허용 헤더: Content-Type

  **Must NOT do**:
  - 와일드카드 origin 사용 (프로덕션)

  **Parallelizable**: YES (언제든 가능)

  **References**:
  - AWS S3 CORS docs: https://docs.aws.amazon.com/AmazonS3/latest/userguide/enabling-cors-examples.html

  **Acceptance Criteria**:
  - [ ] CORS 정책 적용됨
  - [ ] 브라우저에서 presigned URL 업로드 시 CORS 에러 없음

  **Commit**: NO (AWS 콘솔 설정)

---

- [x] 16. 마이그레이션 스크립트 작성

  **What to do**:
  - `scripts/migrate-cloudinary-to-s3.ts` 생성
  - DB에서 Cloudinary URL을 가진 모든 레코드 조회
  - 각 파일을 Cloudinary에서 다운로드 → S3에 업로드
  - DB URL 업데이트 (Cloudinary → Bunny CDN)
  - 진행률 로깅
  - 실패 시 재시도 로직
  - dry-run 모드 지원

  **Must NOT do**:
  - 마이그레이션 중 서비스 중단
  - 원본 Cloudinary 파일 즉시 삭제 (검증 후 삭제)

  **Parallelizable**: NO (모든 코드 업데이트 완료 필요)

  **References**:
  - DB 스키마에서 이미지 URL 필드 확인 필요
  - Cloudinary 파일 URL 패턴: `https://res.cloudinary.com/...`

  **Acceptance Criteria**:
  - [ ] dry-run 모드로 마이그레이션 대상 파일 수 확인
  - [ ] 실제 마이그레이션 실행 → S3에 파일 존재 확인
  - [ ] DB URL이 Bunny CDN 패턴으로 업데이트됨
  - [ ] 마이그레이션된 이미지가 Bunny CDN URL로 정상 로드

  **Commit**: YES
  - Message: `feat(scripts): add Cloudinary to S3 migration script`
  - Files: `scripts/migrate-cloudinary-to-s3.ts`
  - Pre-commit: `npx tsc scripts/migrate-cloudinary-to-s3.ts --noEmit`

---

- [x] 17. Cloudinary 코드 제거

  **What to do**:
  - `apps/api/src/cloudinary/` 디렉토리 삭제
  - `apps/web/utils/cloudinary-upload.ts` 삭제
  - `apps/web/utils/cloudinary-url.ts` 삭제 (또는 bunny-url.ts로 교체됨)
  - `apps/web/utils/cloudinary-url.server.ts` 삭제
  - `apps/web/utils/cloudinary.ts` 삭제
  - package.json에서 cloudinary 의존성 제거
  - 환경변수에서 CLOUDINARY_* 제거

  **Must NOT do**:
  - 마이그레이션 완료 전 삭제
  - 환경변수 히스토리에 시크릿 남기기

  **Parallelizable**: NO (마이그레이션 완료 필요)

  **References**:
  - 모든 Cloudinary 관련 파일 목록

  **Acceptance Criteria**:
  - [ ] Cloudinary 관련 파일 없음
  - [ ] package.json에 cloudinary 의존성 없음
  - [ ] pnpm build 성공 (API + Web)
  - [ ] 모든 기능 정상 동작 (최종 검증)

  **Commit**: YES
  - Message: `chore: remove Cloudinary dependencies and code`
  - Files: Deleted files, package.json
  - Pre-commit: `pnpm build`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(api): add S3 service with presigned URL support` | s3/* | pnpm build |
| 2 | `feat(api): add presigned URL endpoint for S3 uploads` | storage.controller | pnpm build |
| 3 | `feat(web): add S3 upload utility with presigned URL` | s3-upload.ts | pnpm build |
| 4-10 | `refactor(api): migrate services from Cloudinary to S3` | services/* | pnpm build |
| 11 | `refactor(web): migrate upload components to S3` | components/* | pnpm build |
| 12 | `refactor(web): update asset routes to use Bunny CDN` | assets/* | pnpm build |
| 13 | `refactor(web): replace Cloudinary URL utils with Bunny CDN` | utils/* | pnpm build |
| 14 | `chore: add S3 and Bunny CDN environment variables` | .env.example | N/A |
| 16 | `feat(scripts): add Cloudinary to S3 migration script` | scripts/* | tsc check |
| 17 | `chore: remove Cloudinary dependencies and code` | deleted files | pnpm build |

---

## Success Criteria

### Verification Commands
```bash
# API 빌드
cd apps/api && pnpm build  # Expected: 성공, 에러 없음

# Web 빌드
cd apps/web && pnpm build  # Expected: 성공, 에러 없음

# S3 업로드 테스트
curl -X PUT "<presigned-url>" -H "Content-Type: image/jpeg" --data-binary @test.jpg
# Expected: HTTP 200

# Bunny CDN 이미지 로드
curl -I https://<bunny-cdn>/uploads/test.jpg
# Expected: HTTP 200, Content-Type: image/jpeg
```

### Final Checklist
- [ ] 모든 파일 업로드가 S3로 전송됨
- [ ] 기존 Cloudinary 파일이 S3로 이전됨
- [ ] 모든 이미지가 Bunny CDN URL로 표시됨
- [ ] Cloudinary 관련 코드 완전 제거됨
- [ ] API + Web 빌드 성공
- [ ] 프로필 이미지 업로드/표시 정상
- [ ] 미디어 파일 업로드/표시 정상
- [ ] CardDAV 사진 동기화 정상
