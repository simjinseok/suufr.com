import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { IncomingMessage, ServerResponse } from 'http';
import { AppModule } from './app.module';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    ignoreTrailingSlash: true,
  });

  // Register custom HTTP methods for CardDAV/CalDAV (WebDAV)
  // Fastify 5 doesn't support these by default
  const fastifyInstance = fastifyAdapter.getInstance();
  fastifyInstance.addHttpMethod('PROPFIND', { hasBody: true });
  fastifyInstance.addHttpMethod('PROPPATCH', { hasBody: true });
  fastifyInstance.addHttpMethod('REPORT', { hasBody: true });
  fastifyInstance.addHttpMethod('MKCOL');
  fastifyInstance.addHttpMethod('COPY');
  fastifyInstance.addHttpMethod('MOVE');
  fastifyInstance.addHttpMethod('LOCK', { hasBody: true });
  fastifyInstance.addHttpMethod('UNLOCK');

  // Add content type parser for XML and vCard (CardDAV/CalDAV)
  fastifyInstance.addContentTypeParser(
    ['text/xml', 'application/xml', 'text/vcard'],
    { parseAs: 'buffer' },
    (_req: unknown, body: Buffer, done: (err: null, body: Buffer) => void) => {
      done(null, body);
    },
  );

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
    {
      rawBody: true,
      logger: ['error', 'warn', 'log'],
    },
  );

  // Skip CORS for CardDAV/CalDAV routes
  app.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = req.url || '';
    if (path.startsWith('/carddav') || path.startsWith('/.well-known/carddav')
      || path.startsWith('/caldav') || path.startsWith('/.well-known/caldav')) {
      return next();
    }
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

  app.setGlobalPrefix('api', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: '.well-known/caldav', method: RequestMethod.ALL },
      { path: '.well-known/carddav', method: RequestMethod.ALL },
      { path: 'carddav', method: RequestMethod.ALL },
      { path: 'carddav/principals/:userId', method: RequestMethod.ALL },
      { path: 'carddav/principals/:userId/contacts', method: RequestMethod.ALL },
      { path: 'carddav/principals/:userId/contacts/:filename', method: RequestMethod.ALL },
    ],
  });

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
