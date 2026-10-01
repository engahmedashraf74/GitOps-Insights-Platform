import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  frontendOrigins,
  validateProductionConfig,
} from './common/config/production-config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  validateProductionConfig(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Rate limiting keys on client IP; behind the cluster ingress the real
  // address only arrives via X-Forwarded-For.
  app.set('trust proxy', process.env.TRUST_PROXY ?? 1);

  const allowedOrigins = frontendOrigins();
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  logger.log(`CORS allowed origins: ${allowedOrigins.join(', ') || 'none'}`);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const swagger = new DocumentBuilder()
      .setTitle('GitOps Insights API')
      .setDescription('Production SaaS API for GitOps delivery visibility.')
      .setVersion('2.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, swagger),
    );
  }

  await app.listen(Number(process.env.PORT || 3000));
}
bootstrap();
