-- Preserve the service terms accepted when each booking is made.
ALTER TABLE "Booking"
ADD COLUMN "serviceNameSnapshot" TEXT,
ADD COLUMN "serviceDurationMinutesSnapshot" INTEGER,
ADD COLUMN "servicePricePenceSnapshot" INTEGER;

-- Best-effort compatibility backfill for existing bookings. These values are
-- current catalogue values and cannot be asserted as historically exact.
UPDATE "Booking" AS booking
SET
  "serviceNameSnapshot" = service."name",
  "serviceDurationMinutesSnapshot" = service."durationMinutes",
  "servicePricePenceSnapshot" = service."pricePence"
FROM "Service" AS service
WHERE booking."serviceId" = service."id";

CREATE TABLE "BookingCreationIdempotency" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "bookingId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BookingCreationIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingCreationIdempotency_key_key"
ON "BookingCreationIdempotency"("key");

CREATE UNIQUE INDEX "BookingCreationIdempotency_bookingId_key"
ON "BookingCreationIdempotency"("bookingId");

CREATE INDEX "BookingCreationIdempotency_expiresAt_idx"
ON "BookingCreationIdempotency"("expiresAt");

ALTER TABLE "BookingCreationIdempotency"
ADD CONSTRAINT "BookingCreationIdempotency_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
