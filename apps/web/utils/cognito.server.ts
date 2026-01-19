import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';

export const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION!,
});

export const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;
const COGNITO_CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;

export function computeSecretHash(username: string): string | undefined {
  if (!COGNITO_CLIENT_SECRET) {
    return undefined;
  }

  const hmac = createHmac('sha256', COGNITO_CLIENT_SECRET);
  hmac.update(username + COGNITO_CLIENT_ID);
  return hmac.digest('base64');
}
