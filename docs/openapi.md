# OpenAPI Contract

`openapi/openapi.json` is the canonical committed HTTP contract for the NestJS API. Runtime Swagger UI and the committed document are produced by the same `createOpenApiDocument` function, avoiding a second hand-maintained description.

## Generate and verify

Install the locked dependencies and generate the Prisma client first:

```bash
npm ci
DATABASE_URL=postgresql://openapi:openapi@127.0.0.1:5432/openapi npx prisma generate
npm run openapi:generate
npm run openapi:check
```

Generation does not connect to the placeholder database. `openapi:check` exits unsuccessfully if the committed JSON is stale, so it can be used as a CI drift check.

After an accepted contract change, copy the canonical document to the web client and regenerate its client:

```bash
cp openapi/openapi.json ../erics-barbers-ui/api/api-spec.json
cd ../erics-barbers-ui
npm run generate:api-client
npm run build
```

Mobile client generation will consume the same canonical document when its API layer is introduced.

## Mobile 1.0 booking coverage

The contract includes public service/barber discovery, availability, guest and authenticated booking creation, secure-reference guest lookup and management, authenticated booking history and management, and the existing account endpoints. Native refresh-token transport remains part of ticket A3 rather than being described prematurely here.

Booking creation requires `Idempotency-Key`, a client-generated UUID v4. The key represents one normalized submission in either the authenticated-user scope or normalized guest-email scope. Completed intents are retained for 24 hours:

- an identical retry returns the original booking and `201` response;
- a changed request or scope returns `409` with code `IDEMPOTENCY_KEY_REUSED`;
- a concurrent request still being processed returns `409` with code `IDEMPOTENCY_REQUEST_IN_PROGRESS`.

Failed attempts release their key for correction/retry. Stored request fingerprints are SHA-256 hashes and do not contain raw credentials.

Booking responses expose nullable service snapshots for legacy compatibility. New bookings always capture the accepted service name, duration, and price. The migration backfills current catalogue values where a related service still exists; those reconstructed legacy values are best-effort and are not claimed as historically exact. Rescheduling to a different service captures that service's current terms atomically.

Mobile 1.0 customer bookings are created as `CONFIRMED`. The response enum intentionally omits `PENDING`, which remains reserved for a future accepted workflow. Rescheduling accepts optional `serviceId`, `barberId`, and `appointmentDate`, including any valid combination, and revalidates current policy and availability.

## Web compatibility

The Next.js application continues to use its BFF and HttpOnly-cookie session model. The only required behavioural change for this ticket is forwarding a browser-generated `Idempotency-Key` when the BFF creates a booking. Existing response properties and routes remain additive/compatible; newly documented schemas describe existing runtime shapes, and snapshot properties are additive.
