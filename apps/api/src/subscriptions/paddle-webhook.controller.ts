import {
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { EventEntity } from '@paddle/paddle-node-sdk';
import { Public } from '../common/decorators/public.decorator';
import { PaddleClient } from './paddle.client';
import { PaddleWebhookService } from './paddle-webhook.service';

/**
 * Paddle webhook 수신 엔드포인트
 * 외부 콜백이라 REST API용 api/ 접두어 없이 루트에 둔다 (/health, /caldav처럼)
 * 서명 검증(paddle-signature)에 raw body가 필요 — main.ts의 rawBody: true에 의존
 * 처리 실패는 5xx로 전파해 Paddle 재시도(live 기준 3일)에 맡긴다
 */
@Controller('webhooks/paddle')
export class PaddleWebhookController {
  private readonly logger = new Logger(PaddleWebhookController.name);

  constructor(
    private readonly paddleClient: PaddleClient,
    private readonly webhookService: PaddleWebhookService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<FastifyRequest>,
    @Headers('paddle-signature') signature?: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody || !signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    let event: EventEntity;
    try {
      event = await this.paddleClient.unmarshal(rawBody, signature);
    }
    catch (error) {
      if (error instanceof Error && error.message.includes('not configured')) {
        throw error;
      }
      this.logger.warn(`Paddle webhook signature verification failed: ${error}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    await this.webhookService.handleEvent(event);
    return { success: true };
  }
}
