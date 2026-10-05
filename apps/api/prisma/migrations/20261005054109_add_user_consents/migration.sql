-- 약관·개인정보 동의 이력 (추가 전용). user_id = Cognito sub.
-- 가입 직후 SignUp 응답의 UserSub 로 기록되므로 이메일 미인증 상태에서도 행이 존재한다.

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('terms', 'privacy', 'overseas_transfer');

-- CreateTable
CREATE TABLE "user_consents" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "ConsentType" NOT NULL,
    "doc_version" TEXT NOT NULL,
    "agreed" BOOLEAN NOT NULL DEFAULT true,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(512),
    "consented_at" TIMESTAMPTZ(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_consents_user_id_type_consented_at_idx" ON "user_consents"("user_id", "type", "consented_at");
