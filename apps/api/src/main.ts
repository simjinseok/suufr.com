// Import Sentry instrumentation before anything else
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    ignoreTrailingSlash: true,
    // 로드밸런서 뒤에서 실제 클라이언트 IP(X-Forwarded-For)를 사용 — rate limiting 정확도
    trustProxy: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      rawBody: true,
      logger: ['error', 'warn', 'log'],
    },
  );

  app.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const origin = process.env.WEB_URL || 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      res.statusCode = 204;
      return res.end();
    }
    next();
  });

  // 전역 예외 필터는 HttpExceptionFilter(APP_FILTER, common.module) 하나로 통일한다.
  // Sentry 리포팅은 그 필터 내부에서 처리한다.

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT || 5001;
  await app.listen(port, '0.0.0.0');

  console.log(`NestJS API server running on port ${port}`);
}
bootstrap();
