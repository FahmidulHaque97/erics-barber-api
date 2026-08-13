import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Eric's Barber API")
    .setDescription(
      "Canonical HTTP contract for the Eric's Barbers web and mobile clients.",
    )
    .setContact(
      'Fahmid Haque',
      'https://www.linkedin.com/in/fahmid-h-b7a96b123/',
      'fahmidulhaque97@pm.me',
    )
    .setLicense('MIT', 'https://mit-license.org/')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('refreshToken')
    .addServer('http://localhost:4000', 'Local development')
    .addServer('https://erics-barber-api.onrender.com', 'Production API')
    .build();

  return SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey}_${methodKey}`,
  });
}
