import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
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
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CognitoService {
  private client: CognitoIdentityProviderClient;
  private clientId: string;
  private clientSecret: string | undefined;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new CognitoIdentityProviderClient({
      region: this.configService.get('AWS_REGION') || 'ap-northeast-2',
    });
    this.clientId = this.configService.get('COGNITO_CLIENT_ID')!;
    this.clientSecret = this.configService.get('COGNITO_CLIENT_SECRET');
  }

  private computeSecretHash(username: string): string | undefined {
    if (!this.clientSecret) return undefined;
    return createHmac('sha256', this.clientSecret)
      .update(username + this.clientId)
      .digest('base64');
  }

  private decodeJwt(token: string): Record<string, unknown> {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  }

  async login(email: string, password: string) {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
          ...(secretHash && { SECRET_HASH: secretHash }),
        },
      });

      const response = await this.client.send(command);

      if (response.ChallengeName) {
        return {
          success: true,
          requiresMfa: true,
          challengeName: response.ChallengeName,
          session: response.Session,
        };
      }

      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, ExpiresIn } = response.AuthenticationResult;
        const payload = this.decodeJwt(AccessToken!);
        const userId = payload.sub as string;

        await this.ensureUserWithOrganization(userId, payload.email as string, payload.name as string);

        return {
          success: true,
          accessToken: AccessToken,
          refreshToken: RefreshToken,
          expiresIn: ExpiresIn,
          cognitoUsername: userId,
        };
      }

      throw new UnauthorizedException('로그인에 실패했습니다');
    }
    catch (error) {
      if (error instanceof NotAuthorizedException) {
        throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
      }
      if (error instanceof UserNotFoundException) {
        throw new UnauthorizedException('등록되지 않은 사용자입니다');
      }
      if (error instanceof UserNotConfirmedException) {
        throw new BadRequestException('이메일 인증이 필요합니다');
      }
      throw error;
    }
  }

  async respondToMfa(email: string, code: string, session: string) {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          SOFTWARE_TOKEN_MFA_CODE: code,
          ...(secretHash && { SECRET_HASH: secretHash }),
        },
      });

      const response = await this.client.send(command);

      if (response.AuthenticationResult) {
        const { AccessToken, RefreshToken, ExpiresIn } = response.AuthenticationResult;
        const payload = this.decodeJwt(AccessToken!);
        const userId = payload.sub as string;

        await this.ensureUserWithOrganization(userId, payload.email as string, payload.name as string);

        return {
          success: true,
          accessToken: AccessToken,
          refreshToken: RefreshToken,
          expiresIn: ExpiresIn,
          cognitoUsername: userId,
        };
      }

      throw new UnauthorizedException('MFA 인증에 실패했습니다');
    }
    catch (error) {
      if (error instanceof CodeMismatchException) {
        throw new BadRequestException('MFA 코드가 올바르지 않습니다');
      }
      if (error instanceof ExpiredCodeException) {
        throw new BadRequestException('MFA 코드가 만료되었습니다');
      }
      throw error;
    }
  }

  async signup(name: string, email: string, password: string) {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        ...(secretHash && { SecretHash: secretHash }),
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name },
        ],
      });

      await this.client.send(command);
      return { success: true, message: '인증 이메일이 발송되었습니다' };
    }
    catch (error) {
      if (error instanceof UsernameExistsException) {
        throw new ConflictException('이미 가입된 이메일입니다');
      }
      if (error instanceof InvalidPasswordException) {
        throw new BadRequestException('비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다');
      }
      if (error instanceof LimitExceededException) {
        throw new BadRequestException('요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  async verifyEmail(email: string, code: string) {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        ...(secretHash && { SecretHash: secretHash }),
      });

      await this.client.send(command);
      return { success: true, message: '이메일 인증이 완료되었습니다' };
    }
    catch (error) {
      if (error instanceof CodeMismatchException) {
        throw new BadRequestException('인증코드가 올바르지 않습니다');
      }
      if (error instanceof ExpiredCodeException) {
        throw new BadRequestException('인증코드가 만료되었습니다. 다시 발송해주세요.');
      }
      if (error instanceof LimitExceededException) {
        throw new BadRequestException('요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  async resendVerification(email: string) {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new ResendConfirmationCodeCommand({
        ClientId: this.clientId,
        Username: email,
        ...(secretHash && { SecretHash: secretHash }),
      });

      await this.client.send(command);
      return { success: true, message: '인증코드가 재발송되었습니다' };
    }
    catch (error) {
      if (error instanceof LimitExceededException) {
        throw new BadRequestException('요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  async forgotPassword(email: string) {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ...(secretHash && { SecretHash: secretHash }),
      });

      await this.client.send(command);
      return { success: true, message: '비밀번호 재설정 코드가 이메일로 발송되었습니다' };
    }
    catch (error) {
      if (error instanceof UserNotFoundException) {
        throw new BadRequestException('등록되지 않은 이메일입니다');
      }
      if (error instanceof LimitExceededException) {
        throw new BadRequestException('요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  async resetPassword(email: string, code: string, password: string) {
    try {
      const secretHash = this.computeSecretHash(email);
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: password,
        ...(secretHash && { SecretHash: secretHash }),
      });

      await this.client.send(command);
      return { success: true, message: '비밀번호가 재설정되었습니다' };
    }
    catch (error) {
      if (error instanceof CodeMismatchException) {
        throw new BadRequestException('인증코드가 올바르지 않습니다');
      }
      if (error instanceof ExpiredCodeException) {
        throw new BadRequestException('인증코드가 만료되었습니다. 다시 요청해주세요.');
      }
      if (error instanceof InvalidPasswordException) {
        throw new BadRequestException('비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다');
      }
      if (error instanceof LimitExceededException) {
        throw new BadRequestException('요청 횟수가 초과되었습니다. 잠시 후 다시 시도해주세요.');
      }
      throw error;
    }
  }

  async refreshToken(refreshToken: string, username: string) {
    try {
      const secretHash = this.computeSecretHash(username);
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
          ...(secretHash && { SECRET_HASH: secretHash }),
        },
      });

      const response = await this.client.send(command);

      if (response.AuthenticationResult?.AccessToken) {
        return {
          success: true,
          accessToken: response.AuthenticationResult.AccessToken,
          expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
        };
      }

      throw new UnauthorizedException('토큰 갱신에 실패했습니다');
    }
    catch (error) {
      if (error instanceof NotAuthorizedException) {
        throw new UnauthorizedException('세션이 만료되었습니다. 다시 로그인해주세요.');
      }
      throw error;
    }
  }

  private async ensureUserWithOrganization(userId: string, email: string, name?: string) {
    const existingOrganization = await this.prisma.organization.findFirst({
      where: { userId },
    });

    if (existingOrganization) return;

    await this.prisma.$transaction(async (tx) => {
      const orgName = name || email.split('@')[0];
      const org = await tx.organization.create({
        data: {
          name: orgName,
          userId,
          profileName: orgName,
        },
      });

      await tx.userSettings.upsert({
        where: { userId },
        create: { userId, currentOrganizationId: org.id },
        update: { currentOrganizationId: org.id },
      });
    });
  }
}
