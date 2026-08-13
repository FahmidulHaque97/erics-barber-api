import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import cookieParser = require('cookie-parser');
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { globalValidationPipeOptions } from './config/validation';
import { createOpenApiDocument } from './openapi';

async function bootstrap() {
  // Create the NestJS application
  const app = await NestFactory.create(AppModule);

  // Swagger Setup
  const documentFactory = () => createOpenApiDocument(app);
  SwaggerModule.setup('api', app, documentFactory);

  // Global Middlewares and Pipes
  const corsOptions: CorsOptions = {
    origin: process.env.CLIENT_BASE_URL,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  };

  app.use(helmet());
  app.enableCors(corsOptions);
  app.useGlobalPipes(new ValidationPipe(globalValidationPipeOptions));
  app.use(cookieParser());

  // Start the application
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: ${await app.getUrl()}`);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
