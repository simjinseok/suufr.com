/**
 * Phase 0 — Cognito 유저풀·앱클라이언트 설정 확인
 *
 * 이전 계획의 열린 질문에 답하는 값들을 출력한다:
 *   - 이메일 발신 방식 (COGNITO_DEFAULT vs DEVELOPER=SES, SourceArn, From 주소)
 *   - MFA 구성 (OFF/OPTIONAL/ON, 소프트웨어 토큰 활성 여부)
 *   - 비밀번호 정책 (better-auth 정책 결정용)
 *   - 앱클라이언트 토큰 수명 (refresh 토큰 수명 = Cognito 병행 운영 최소 기간)
 *   - 사용자명 속성 / alias (이메일 대소문자 처리 추정)
 *
 * 실행 (apps/api 에서):
 *   node --env-file=.env scripts/cognito/describe-pool.mts
 * 필요 환경변수: COGNITO_USERPOOL_ID, COGNITO_CLIENT_ID, AWS_REGION
 *   - IAM 권한: cognito-idp:DescribeUserPool, cognito-idp:DescribeUserPoolClient
 */
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolCommand,
  DescribeUserPoolClientCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const userPoolId = process.env.COGNITO_USERPOOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;
if (!userPoolId || !clientId) {
  console.error('COGNITO_USERPOOL_ID, COGNITO_CLIENT_ID 가 필요합니다');
  process.exit(1);
}

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || 'ap-northeast-2' });

async function main() {
  const { UserPool: pool } = await client.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId }));
  const { UserPoolClient: app } = await client.send(new DescribeUserPoolClientCommand({ UserPoolId: userPoolId, ClientId: clientId }));
  if (!pool || !app) throw new Error('유저풀 또는 앱클라이언트를 찾을 수 없습니다');

  const unit = app.TokenValidityUnits;
  const report = {
    userPool: {
      id: pool.Id,
      name: pool.Name,
      estimatedUsers: pool.EstimatedNumberOfUsers,
      usernameAttributes: pool.UsernameAttributes, // ['email'] 이면 이메일이 사용자명
      aliasAttributes: pool.AliasAttributes,
      usernameCaseSensitive: pool.UsernameConfiguration?.CaseSensitive,
      autoVerifiedAttributes: pool.AutoVerifiedAttributes,
      deletionProtection: pool.DeletionProtection,
    },
    email: {
      // COGNITO_DEFAULT: Cognito 기본 발신(일 50건 제한). DEVELOPER: SES 자격증명(SourceArn)으로 발신
      sendingAccount: pool.EmailConfiguration?.EmailSendingAccount,
      sesSourceArn: pool.EmailConfiguration?.SourceArn,
      from: pool.EmailConfiguration?.From,
      replyTo: pool.EmailConfiguration?.ReplyToEmailAddress,
      verificationType: pool.VerificationMessageTemplate?.DefaultEmailOption, // CONFIRM_WITH_CODE | CONFIRM_WITH_LINK
      verificationSubject: pool.VerificationMessageTemplate?.EmailSubject,
    },
    mfa: {
      configuration: pool.MfaConfiguration, // OFF | OPTIONAL | ON
      // 상세(소프트웨어 토큰 활성 여부)는 GetUserPoolMfaConfig 로 확인 가능 — 필요 시 추가
    },
    passwordPolicy: pool.Policies?.PasswordPolicy,
    appClient: {
      id: app.ClientId,
      name: app.ClientName,
      hasSecret: Boolean(app.ClientSecret),
      explicitAuthFlows: app.ExplicitAuthFlows,
      accessTokenValidity: `${app.AccessTokenValidity ?? 60} ${unit?.AccessToken ?? 'minutes'}`,
      idTokenValidity: `${app.IdTokenValidity ?? 60} ${unit?.IdToken ?? 'minutes'}`,
      refreshTokenValidity: `${app.RefreshTokenValidity ?? 30} ${unit?.RefreshToken ?? 'days'}`, // Phase 6 대기 기간의 근거
      preventUserExistenceErrors: app.PreventUserExistenceErrors,
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
