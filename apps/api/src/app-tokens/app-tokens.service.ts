import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAppTokenDto } from './dto/create-app-token.dto';
import * as crypto from 'crypto';
import { timingSafeEqual } from 'crypto';
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  try {
    return timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
  }
  catch {
    return false;
  }
}

export type DavSession = {
  user: {
    id: string;
    email: string;
  };
  organization: {
    id: number;
    uuid: string;
    name: string;
  };
  tokenId: number;
};

@Injectable()
export class AppTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const tokens = await this.prisma.appToken.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        uuid: true,
        name: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: tokens };
  }

  async create(userId: string, dto: CreateAppTokenDto) {
    const token = generateToken();
    const tokenHash = hashToken(token);

    const appToken = await this.prisma.appToken.create({
      data: {
        name: dto.name,
        tokenHash,
        userId,
      },
      select: {
        uuid: true,
        name: true,
        createdAt: true,
      },
    });

    // Return the token only once at creation time
    return {
      success: true,
      data: {
        ...appToken,
        token, // This is the only time the plain token is returned
      },
    };
  }

  async remove(uuid: string, userId: string) {
    const token = await this.prisma.appToken.findUnique({
      where: { uuid },
    });

    if (!token || token.deletedAt) {
      throw new NotFoundException(`Token with UUID ${uuid} not found`);
    }

    if (token.userId !== userId) {
      throw new NotFoundException(`Token with UUID ${uuid} not found`);
    }

    await this.prisma.appToken.update({
      where: { uuid },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  }

  async validateToken(email: string, token: string): Promise<DavSession | null> {
    // Find all tokens (DAV auth doesn't have a good way to include userId in request)
    const appTokens = await this.prisma.appToken.findMany({
      where: {
        deletedAt: null,
      },
    });

    // Try to find a matching token
    for (const appToken of appTokens) {
      const isValid = verifyToken(token, appToken.tokenHash);
      if (!isValid) continue;

      // Token is valid, now verify the user has the expected email
      // Find the user's organization
      const organization = await this.prisma.organization.findFirst({
        where: {
          userId: appToken.userId,
          deletedAt: null,
        },
      });

      if (!organization) continue;

      // Update lastUsedAt
      await this.prisma.appToken.update({
        where: { id: appToken.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        user: {
          id: appToken.userId,
          email,
        },
        organization: {
          id: organization.id,
          uuid: organization.uuid,
          name: organization.name,
        },
        tokenId: appToken.id,
      };
    }

    return null;
  }
}
