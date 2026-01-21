import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable raw body for DAV requests
    rawBody: true,
  });

  app.enableCors({
    origin: process.env.WEB_URL || 'http://localhost:3000',
    credentials: true,
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: '', method: RequestMethod.GET },
      { path: 'dav', method: RequestMethod.ALL },
      { path: 'dav/{*path}', method: RequestMethod.ALL },
      { path: '.well-known/caldav', method: RequestMethod.ALL },
      { path: '.well-known/carddav', method: RequestMethod.ALL },
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
  await app.listen(port);

  console.log(`NestJS API server running on port ${port}`);
}
bootstrap();
