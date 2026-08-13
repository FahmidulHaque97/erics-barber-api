import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortObject(child)]),
    );
  }

  return value;
}

async function generate() {
  process.env.DATABASE_URL ??=
    'postgresql://openapi:openapi@127.0.0.1:5432/openapi';
  process.env.JWT_SECRET ??= 'openapi-generation-only';
  process.env.RESEND_API_KEY ??= 're_openapi_generation_only';

  const [{ NestFactory }, { AppModule }, { createOpenApiDocument }] =
    await Promise.all([
      import('@nestjs/core'),
      import('../src/app.module'),
      import('../src/openapi'),
    ]);
  const app = await NestFactory.create(AppModule, { logger: false });
  const document = createOpenApiDocument(app);
  const output = `${JSON.stringify(sortObject(document), null, 2)}\n`;
  const outputPath = resolve(process.cwd(), 'openapi/openapi.json');

  if (process.argv.includes('--check')) {
    const committed = await readFile(outputPath, 'utf8').catch(() => '');
    if (committed !== output) {
      throw new Error(
        'openapi/openapi.json is stale. Run npm run openapi:generate and commit the result.',
      );
    }
  } else {
    await writeFile(outputPath, output, 'utf8');
  }

  await app.close();
}

void generate();
