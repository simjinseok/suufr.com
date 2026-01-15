'use server';
import type { ServerActionState } from '@/types/index';

import {
  InitiateAuthCommand,
  AuthFlowType,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  RespondToAuthChallengeCommand,
  ChallengeNameType,
  NotAuthorizedException,
  UserNotFoundException,
  UsernameExistsException,
  CodeMismatchException,
  ExpiredCodeException,
  InvalidPasswordException,
  UserNotConfirmedException,
  LimitExceededException,
} from '@aws-sdk/client-cognito-identity-provider';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { cognitoClient, COGNITO_CLIENT_ID, computeSecretHash } from '@/utils/cognito.server';
import {
  loginSchema,
  signupSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  mfaSchema,
} from '@/schemas/auth';

// Login action
type LoginFields = { email: string; password: string };
type LoginState = ServerActionState<LoginFields> & {
  requiresMfa?: boolean;
  challengeName?: string;
};

export async function login(
  prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const data = Object.fromEntries(formData);
  const state: LoginState = {
    success: false,
    fields: {
      email: (data.email as string) || '',
      password: '',
    },
    timestamp: Date.now(),
  };

  const validation = loginSchema.safeParse(data);
  if (!validation.success) {
    state.fieldErrors = z.flattenError(validation.error).fieldErrors;
    return state;
  }

  try {
    const secretHash = computeSecretHash(validation.data.email);
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: validation.data.email,
        PASSWORD: validation.data.password,
        ...(secretHash && { SECRET_HASH: secretHash }),
      },
    });

    const response = await cognitoClient.send(command);

    // MFA required
    if (response.ChallengeName) {
      const cookieStore = await cookies();
      cookieStore.set('mfa_session', response.Session!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 300, // 5 minutes
      });
      cookieStore.set('mfa_email', validation.data.email, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 300,
      });

      state.requiresMfa = true;
      state.challengeName = response.ChallengeName;
      return state;
    }

    // Authentication successful
    if (response.AuthenticationResult) {
      const { AccessToken, RefreshToken, ExpiresIn }
        = response.AuthenticationResult;

      const cookieStore = await cookies();
      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('access_token', AccessToken!, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: (ExpiresIn || 3600) - 60,
      });

      cookieStore.set('refresh_token', RefreshToken!, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
      });

      // Store username for token refresh
      cookieStore.set('cognito_username', validation.data.email, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
      });

      state.success = true;
    }
  }
  catch (error) {
    if (error instanceof NotAuthorizedException) {
      state.message = '이메일 또는 비밀번호가 올바르지 않습니다';
    }
    else if (error instanceof UserNotFoundException) {
      state.message = '등록되지 않은 사용자입니다';
    }
    else if (error instanceof UserNotConfirmedException) {
      state.message = '이메일 인증이 필요합니다';
      state.fields!.email = validation.data.email;
    }
    else {
      state.message = '로그인 중 오류가 발생했습니다';
    }
  }

  return state;
}

// MFA response action
type MfaFields = { code: string };
type MfaState = ServerActionState<MfaFields>;

export async function respondToMfa(
  prevState: MfaState,
  formData: FormData,
): Promise<MfaState> {
  const data = Object.fromEntries(formData);
  const state: MfaState = {
    success: false,
    fields: {
      code: '',
    },
    timestamp: Date.now(),
  };

  const validation = mfaSchema.safeParse(data);
  if (!validation.success) {
    state.fieldErrors = z.flattenError(validation.error).fieldErrors;
    return state;
  }

  const cookieStore = await cookies();
  const session = cookieStore.get('mfa_session')?.value;
  const email = cookieStore.get('mfa_email')?.value;

  if (!session || !email) {
    state.message = 'MFA 세션이 만료되었습니다. 다시 로그인해주세요.';
    return state;
  }

  try {
    const secretHash = computeSecretHash(email);
    const command = new RespondToAuthChallengeCommand({
      ClientId: COGNITO_CLIENT_ID,
      ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        SOFTWARE_TOKEN_MFA_CODE: validation.data.code,
        ...(secretHash && { SECRET_HASH: secretHash }),
      },
    });

    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult) {
      const { AccessToken, RefreshToken, ExpiresIn }
        = response.AuthenticationResult;

      const isProduction = process.env.NODE_ENV === 'production';

      cookieStore.set('access_token', AccessToken!, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: (ExpiresIn || 3600) - 60,
      });

      cookieStore.set('refresh_token', RefreshToken!, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
      });

      // Store username for token refresh
      cookieStore.set('cognito_username', email, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
      });

      // Clear MFA session cookies
      cookieStore.delete('mfa_session');
      cookieStore.delete('mfa_email');

      state.success = true;
    }
  }
  catch (error) {
    if (error instanceof CodeMismatchException) {
      state.message = 'MFA 코드가 올바르지 않습니다';
    }
    else if (error instanceof ExpiredCodeException) {
      state.message = 'MFA 코드가 만료되었습니다';
    }
    else {
      state.message = 'MFA 인증 중 오류가 발생했습니다';
    }
  }

  return state;
}

// Signup action
type SignupFields = { email: string; password: string; passwordConfirm: string };
type SignupState = ServerActionState<SignupFields>;

export async function signup(
  prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const data = Object.fromEntries(formData);
  const state: SignupState = {
    success: false,
    fields: {
      email: (data.email as string) || '',
      password: '',
      passwordConfirm: '',
    },
    timestamp: Date.now(),
  };

  const validation = signupSchema.safeParse(data);
  if (!validation.success) {
    state.fieldErrors = z.flattenError(validation.error).fieldErrors;
    return state;
  }

  try {
    const secretHash = computeSecretHash(validation.data.email);
    const command = new SignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: validation.data.email,
      Password: validation.data.password,
      ...(secretHash && { SecretHash: secretHash }),
      UserAttributes: [
        {
          Name: 'email',
          Value: validation.data.email,
        },
      ],
    });

    await cognitoClient.send(command);
    state.success = true;
    state.message = '인증 이메일이 발송되었습니다';
  }
  catch (error) {
    if (error instanceof UsernameExistsException) {
      state.message = '이미 가입된 이메일입니다';
    }
    else if (error instanceof InvalidPasswordException) {
      state.message
        = '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다';
    }
    else if (error instanceof LimitExceededException) {
      state.message = '요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    else {
      state.message = '회원가입 중 오류가 발생했습니다';
    }
  }

  return state;
}

// Verify email action
type VerifyEmailFields = { email: string; code: string };
type VerifyEmailState = ServerActionState<VerifyEmailFields>;

export async function verifyEmail(
  prevState: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const data = Object.fromEntries(formData);
  const state: VerifyEmailState = {
    success: false,
    fields: {
      email: (data.email as string) || '',
      code: '',
    },
    timestamp: Date.now(),
  };

  const validation = verifyEmailSchema.safeParse(data);
  if (!validation.success) {
    state.fieldErrors = z.flattenError(validation.error).fieldErrors;
    return state;
  }

  try {
    const secretHash = computeSecretHash(validation.data.email);
    const command = new ConfirmSignUpCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: validation.data.email,
      ConfirmationCode: validation.data.code,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);
    state.success = true;
    state.message = '이메일 인증이 완료되었습니다';
  }
  catch (error) {
    if (error instanceof CodeMismatchException) {
      state.message = '인증코드가 올바르지 않습니다';
    }
    else if (error instanceof ExpiredCodeException) {
      state.message = '인증코드가 만료되었습니다. 다시 발송해주세요.';
    }
    else if (error instanceof LimitExceededException) {
      state.message = '요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    else {
      state.message = '이메일 인증 중 오류가 발생했습니다';
    }
  }

  return state;
}

// Resend verification code action
type ResendVerificationFields = { email: string };
type ResendVerificationState = ServerActionState<ResendVerificationFields>;

export async function resendVerification(
  prevState: ResendVerificationState,
  formData: FormData,
): Promise<ResendVerificationState> {
  const data = Object.fromEntries(formData);
  const state: ResendVerificationState = {
    success: false,
    fields: {
      email: (data.email as string) || '',
    },
    timestamp: Date.now(),
  };

  const email = data.email as string;
  if (!email) {
    state.message = '이메일을 입력해주세요';
    return state;
  }

  try {
    const secretHash = computeSecretHash(email);
    const command = new ResendConfirmationCodeCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);
    state.success = true;
    state.message = '인증코드가 재발송되었습니다';
  }
  catch (error) {
    if (error instanceof LimitExceededException) {
      state.message = '요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    else {
      state.message = '인증코드 발송 중 오류가 발생했습니다';
    }
  }

  return state;
}

// Forgot password action
type ForgotPasswordFields = { email: string };
type ForgotPasswordState = ServerActionState<ForgotPasswordFields>;

export async function forgotPassword(
  prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const data = Object.fromEntries(formData);
  const state: ForgotPasswordState = {
    success: false,
    fields: {
      email: (data.email as string) || '',
    },
    timestamp: Date.now(),
  };

  const validation = forgotPasswordSchema.safeParse(data);
  if (!validation.success) {
    state.fieldErrors = z.flattenError(validation.error).fieldErrors;
    return state;
  }

  try {
    const secretHash = computeSecretHash(validation.data.email);
    const command = new ForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: validation.data.email,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);
    state.success = true;
    state.message = '비밀번호 재설정 코드가 이메일로 발송되었습니다';
  }
  catch (error) {
    if (error instanceof UserNotFoundException) {
      state.message = '등록되지 않은 이메일입니다';
    }
    else if (error instanceof LimitExceededException) {
      state.message = '요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    else {
      state.message = '비밀번호 재설정 요청 중 오류가 발생했습니다';
    }
  }

  return state;
}

// Reset password action
type ResetPasswordFields = {
  email: string;
  code: string;
  password: string;
  passwordConfirm: string;
};
type ResetPasswordState = ServerActionState<ResetPasswordFields>;

export async function resetPassword(
  prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const data = Object.fromEntries(formData);
  const state: ResetPasswordState = {
    success: false,
    fields: {
      email: (data.email as string) || '',
      code: '',
      password: '',
      passwordConfirm: '',
    },
    timestamp: Date.now(),
  };

  const validation = resetPasswordSchema.safeParse(data);
  if (!validation.success) {
    state.fieldErrors = z.flattenError(validation.error).fieldErrors;
    return state;
  }

  try {
    const secretHash = computeSecretHash(validation.data.email);
    const command = new ConfirmForgotPasswordCommand({
      ClientId: COGNITO_CLIENT_ID,
      Username: validation.data.email,
      ConfirmationCode: validation.data.code,
      Password: validation.data.password,
      ...(secretHash && { SecretHash: secretHash }),
    });

    await cognitoClient.send(command);
    state.success = true;
    state.message = '비밀번호가 재설정되었습니다';
  }
  catch (error) {
    if (error instanceof CodeMismatchException) {
      state.message = '인증코드가 올바르지 않습니다';
    }
    else if (error instanceof ExpiredCodeException) {
      state.message = '인증코드가 만료되었습니다. 다시 요청해주세요.';
    }
    else if (error instanceof InvalidPasswordException) {
      state.message
        = '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다';
    }
    else if (error instanceof LimitExceededException) {
      state.message = '요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.';
    }
    else {
      state.message = '비밀번호 재설정 중 오류가 발생했습니다';
    }
  }

  return state;
}
