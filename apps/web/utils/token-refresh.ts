import {
  InitiateAuthCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { cognitoClient, COGNITO_CLIENT_ID, computeSecretHash } from './cognito.server';

export async function refreshAccessToken(
  refreshToken: string,
  username: string,
): Promise<{
  access_token: string;
  expires_in: number;
} | null> {
  try {
    const secretHash = computeSecretHash(username);
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        ...(secretHash && { SECRET_HASH: secretHash }),
      },
    });

    const response = await cognitoClient.send(command);

    if (response.AuthenticationResult?.AccessToken) {
      return {
        access_token: response.AuthenticationResult.AccessToken,
        expires_in: response.AuthenticationResult.ExpiresIn || 3600,
      };
    }
  }
  catch (error) {
    console.error('Token refresh failed:', error);
  }

  return null;
}
