import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

export interface JwtPayload {
  'sub': string;
  'email'?: string;
  'cognito:username'?: string;
  'iss': string;
  'aud': string;
  'token_use': 'access' | 'id';
  'exp': number;
  'iat': number;
}

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    const cognitoRegion = configService.get<string>('COGNITO_REGION', 'ap-northeast-2');
    const userPoolId = configService.get<string>('COGNITO_USER_POOL_ID');
    const cognitoDomain = configService.get<string>('COGNITO_DOMAIN');

    // Extract region and user pool ID from domain if not provided
    let jwksUri: string;
    if (userPoolId) {
      jwksUri = `https://cognito-idp.${cognitoRegion}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    }
    else if (cognitoDomain) {
      // Parse domain to get region and pool ID
      // Domain format: https://{domain}.auth.{region}.amazoncognito.com
      const match = cognitoDomain.match(/\.auth\.([^.]+)\.amazoncognito\.com/);
      const region = match ? match[1] : cognitoRegion;
      jwksUri = `https://cognito-idp.${region}.amazonaws.com/${configService.get<string>('COGNITO_USER_POOL_ID', '')}/.well-known/jwks.json`;
    }
    else {
      throw new Error('COGNITO_USER_POOL_ID or COGNITO_DOMAIN must be provided');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,
      }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token: missing sub claim');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      username: payload['cognito:username'],
    };
  }
}
