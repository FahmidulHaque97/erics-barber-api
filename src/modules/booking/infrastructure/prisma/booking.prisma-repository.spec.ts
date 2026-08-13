jest.mock('src/infrastructure/mail/resend.service', () => ({
  ResendService: jest.fn(),
}));

import { BookingService } from './booking.prisma-repository';
import { Prisma } from 'src/generated/prisma/client';
import {
  BookingStatus,
  OutboxEventStatus,
  OutboxEventType,
} from 'src/generated/prisma/enums';
import { Role } from 'src/common/constants/role.enum';

describe('BookingService', () => {
  const resendService = {
    sendEmail: jest.fn(),
  };
  const availabilityService = {
    assertSlotAvailable: jest.fn(),
  };

  const createPrismaService = () => {
    const prismaService = {
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(),
      },
      barber: {
        findUnique: jest.fn(),
      },
      booking: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      service: {
        findFirst: jest.fn(),
      },
      bookingCreationIdempotency: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      outboxEvent: {
        create: jest.fn(),
      },
    };

    prismaService.$transaction.mockImplementation((callback: unknown) => {
      const transaction = callback as (client: typeof prismaService) => unknown;
      return Promise.resolve(transaction(prismaService));
    });
    prismaService.bookingCreationIdempotency.findUnique.mockResolvedValue(null);
    prismaService.service.findFirst.mockResolvedValue({
      id: 'service-id',
      name: 'Haircut',
      durationMinutes: 30,
      pricePence: 2500,
      isActive: true,
    });

    return prismaService;
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-01T09:00:00.000Z'));
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createUniqueConstraintError() {
    return new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`barberId`,`startTime`)',
      {
        clientVersion: 'test',
        code: 'P2002',
        meta: { target: ['barberId', 'startTime'] },
      },
    );
  }

  it('creates 30-minute bookings for the selected barber', async () => {
    const prismaService = createPrismaService();
    const createdBooking = {
      id: 'booking-id',
      serviceId: 'service-id',
      barberId: 'barber-id',
      status: BookingStatus.CONFIRMED,
      startTime: new Date('2026-08-01T10:00:00.000Z'),
      service: { id: 'service-id', name: 'Haircut', pricePence: 2500 },
      barber: { id: 'barber-id', displayName: 'Eric' },
    };
    prismaService.user.findUnique.mockResolvedValue({
      email: 'customer@example.com',
      name: 'Customer Name',
    });
    prismaService.booking.create.mockResolvedValue(createdBooking);
    resendService.sendEmail.mockResolvedValue(undefined);
    availabilityService.assertSlotAvailable.mockResolvedValue(undefined);

    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );
    const appointmentDate = new Date('2026-08-01T10:00:00.000Z');

    const result = await bookingService.createBooking(
      'customer-id',
      '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
      {
        serviceId: 'service-id',
        barberId: 'barber-id',
        appointmentDate,
      },
    );

    expect(availabilityService.assertSlotAvailable).toHaveBeenCalledWith({
      barberId: 'barber-id',
      serviceId: 'service-id',
      startTime: appointmentDate,
    });
    expect(prismaService.booking.create).toHaveBeenCalledWith({
      data: {
        userId: 'customer-id',
        customerName: 'Customer Name',
        customerEmail: 'customer@example.com',
        customerPhone: undefined,
        serviceId: 'service-id',
        serviceNameSnapshot: 'Haircut',
        serviceDurationMinutesSnapshot: 30,
        servicePricePenceSnapshot: 2500,
        barberId: 'barber-id',
        status: BookingStatus.CONFIRMED,
        startTime: appointmentDate,
        endTime: new Date('2026-08-01T10:30:00.000Z'),
      },
      include: {
        service: true,
        barber: true,
      },
    });
    expect(prismaService.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: OutboxEventType.BOOKING_CONFIRMATION_EMAIL,
        status: OutboxEventStatus.PENDING,
        payload: {
          appointmentDate: '2026-08-01T10:00:00.000Z',
          barberName: 'Eric',
          bookingReference: 'booking-id',
          pricePence: 2500,
          serviceName: 'Haircut',
          status: BookingStatus.CONFIRMED,
          to: 'customer@example.com',
        },
      },
    });
    expect(resendService.sendEmail).not.toHaveBeenCalled();
    expect(result).toBe(createdBooking);
  });

  it('creates guest bookings with supplied contact details', async () => {
    const prismaService = createPrismaService();
    const createdBooking = {
      id: 'booking-id',
      barber: { displayName: 'Eric' },
      customerEmail: 'guest@example.com',
      customerName: 'Guest Customer',
      customerPhone: '+447900000000',
      service: { name: 'Haircut', pricePence: 2500 },
      status: BookingStatus.CONFIRMED,
      startTime: new Date('2026-08-01T10:00:00.000Z'),
    };
    prismaService.booking.create.mockResolvedValue(createdBooking);
    resendService.sendEmail.mockResolvedValue(undefined);
    availabilityService.assertSlotAvailable.mockResolvedValue(undefined);

    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );
    const appointmentDate = new Date('2026-08-01T10:00:00.000Z');

    const result = await bookingService.createBooking(
      undefined,
      '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
      {
        appointmentDate,
        barberId: 'barber-id',
        customerEmail: 'guest@example.com',
        customerName: 'Guest Customer',
        customerPhone: '+447900000000',
        serviceId: 'service-id',
      },
    );

    expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    expect(prismaService.booking.create).toHaveBeenCalledWith({
      data: {
        userId: undefined,
        customerName: 'Guest Customer',
        customerEmail: 'guest@example.com',
        customerPhone: '+447900000000',
        serviceId: 'service-id',
        serviceNameSnapshot: 'Haircut',
        serviceDurationMinutesSnapshot: 30,
        servicePricePenceSnapshot: 2500,
        barberId: 'barber-id',
        status: BookingStatus.CONFIRMED,
        startTime: appointmentDate,
        endTime: new Date('2026-08-01T10:30:00.000Z'),
      },
      include: {
        service: true,
        barber: true,
      },
    });
    expect(prismaService.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: OutboxEventType.BOOKING_CONFIRMATION_EMAIL,
        status: OutboxEventStatus.PENDING,
        payload: {
          appointmentDate: '2026-08-01T10:00:00.000Z',
          barberName: 'Eric',
          bookingReference: 'booking-id',
          pricePence: 2500,
          serviceName: 'Haircut',
          status: BookingStatus.CONFIRMED,
          to: 'guest@example.com',
        },
      },
    });
    expect(resendService.sendEmail).not.toHaveBeenCalled();
    expect(result).toBe(createdBooking);
  });

  it('replays the original booking for an identical idempotent retry', async () => {
    const prismaService = createPrismaService();
    const booking = { id: 'booking-id' };
    prismaService.user.findUnique.mockResolvedValue({
      email: 'customer@example.com',
      name: 'Customer Name',
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );
    const dto = {
      appointmentDate: new Date('2026-08-01T10:00:00.000Z'),
      barberId: 'barber-id',
      serviceId: 'service-id',
    };
    const requestHash = (
      bookingService as unknown as {
        hashBookingRequest: (scope: string, value: unknown) => string;
      }
    ).hashBookingRequest('user:customer-id', {
      ...dto,
      customerEmail: 'customer@example.com',
      customerName: 'Customer Name',
      customerPhone: undefined,
    });
    prismaService.bookingCreationIdempotency.findUnique.mockResolvedValue({
      booking,
      expiresAt: new Date('2026-07-02T09:00:00.000Z'),
      requestHash,
      scope: 'user:customer-id',
    });

    const result = await bookingService.createBooking(
      'customer-id',
      '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
      dto,
    );

    expect(result).toBe(booking);
    expect(availabilityService.assertSlotAvailable).not.toHaveBeenCalled();
    expect(prismaService.booking.create).not.toHaveBeenCalled();
  });

  it('replays a completed competing request after a concurrent key claim', async () => {
    const prismaService = createPrismaService();
    const booking = { id: 'booking-id' };
    prismaService.user.findUnique.mockResolvedValue({
      email: 'customer@example.com',
      name: 'Customer Name',
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );
    const dto = {
      appointmentDate: new Date('2026-08-01T10:00:00.000Z'),
      barberId: 'barber-id',
      serviceId: 'service-id',
    };
    const requestHash = (
      bookingService as unknown as {
        hashBookingRequest: (scope: string, value: unknown) => string;
      }
    ).hashBookingRequest('user:customer-id', {
      ...dto,
      customerEmail: 'customer@example.com',
      customerName: 'Customer Name',
      customerPhone: undefined,
    });
    prismaService.bookingCreationIdempotency.create.mockRejectedValue(
      createUniqueConstraintError(),
    );
    prismaService.bookingCreationIdempotency.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        booking,
        expiresAt: new Date('2026-07-02T09:00:00.000Z'),
        requestHash,
        scope: 'user:customer-id',
      });

    const result = await bookingService.createBooking(
      'customer-id',
      '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
      dto,
    );

    expect(result).toBe(booking);
    expect(prismaService.booking.create).not.toHaveBeenCalled();
  });

  it('rejects changed details when an idempotency key is reused', async () => {
    const prismaService = createPrismaService();
    prismaService.bookingCreationIdempotency.findUnique.mockResolvedValue({
      booking: { id: 'booking-id' },
      expiresAt: new Date('2026-07-02T09:00:00.000Z'),
      requestHash: 'different-request',
      scope: 'guest:guest@example.com',
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const rejection = expect(
      bookingService.createBooking(
        undefined,
        '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
        {
          appointmentDate: new Date('2026-08-01T10:00:00.000Z'),
          barberId: 'barber-id',
          customerEmail: 'guest@example.com',
          customerName: 'Guest Customer',
          customerPhone: '+447900000000',
          serviceId: 'service-id',
        },
      ),
    ).rejects.toMatchObject({
      response: { code: 'IDEMPOTENCY_KEY_REUSED' },
      status: 409,
    });
    await rejection;
  });

  it('rejects guest bookings without contact details', async () => {
    const prismaService = createPrismaService();
    availabilityService.assertSlotAvailable.mockResolvedValue(undefined);

    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.createBooking(
        undefined,
        '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
        {
          serviceId: 'service-id',
          barberId: 'barber-id',
          appointmentDate: new Date('2026-08-01T10:00:00.000Z'),
        },
      ),
    ).rejects.toThrow('Customer name, email, and phone are required');

    expect(prismaService.booking.create).not.toHaveBeenCalled();
  });

  it('rejects same-day bookings', async () => {
    const prismaService = createPrismaService();
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.createBooking(
        undefined,
        '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
        {
          serviceId: 'service-id',
          barberId: 'barber-id',
          appointmentDate: new Date('2026-07-01T10:00:00.000Z'),
          customerEmail: 'guest@example.com',
          customerName: 'Guest Customer',
          customerPhone: '+447900000000',
        },
      ),
    ).rejects.toThrow('Bookings cannot be made for today or a past date');

    expect(availabilityService.assertSlotAvailable).not.toHaveBeenCalled();
    expect(prismaService.booking.create).not.toHaveBeenCalled();
  });

  it('rejects bookings more than one month in advance', async () => {
    const prismaService = createPrismaService();
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.createBooking(
        undefined,
        '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
        {
          serviceId: 'service-id',
          barberId: 'barber-id',
          appointmentDate: new Date('2026-08-02T10:00:00.000Z'),
          customerEmail: 'guest@example.com',
          customerName: 'Guest Customer',
          customerPhone: '+447900000000',
        },
      ),
    ).rejects.toThrow('Bookings can only be made up to 1 month in advance');

    expect(availabilityService.assertSlotAvailable).not.toHaveBeenCalled();
    expect(prismaService.booking.create).not.toHaveBeenCalled();
  });

  it('rejects bookings that do not start on a half-hour boundary', async () => {
    const prismaService = createPrismaService();
    prismaService.user.findUnique.mockResolvedValue({
      email: 'customer@example.com',
      name: 'Customer Name',
    });
    availabilityService.assertSlotAvailable.mockRejectedValue(
      new Error('Booking start time must be on the hour or half hour'),
    );

    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.createBooking(
        'customer-id',
        '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
        {
          serviceId: 'service-id',
          barberId: 'barber-id',
          appointmentDate: new Date('2026-08-01T10:15:00.000Z'),
        },
      ),
    ).rejects.toThrow('Booking start time must be on the hour or half hour');
  });

  it('returns a slot conflict when the database rejects a duplicate active slot', async () => {
    const prismaService = createPrismaService();
    prismaService.user.findUnique.mockResolvedValue({
      email: 'customer@example.com',
      name: 'Customer Name',
    });
    prismaService.booking.create.mockRejectedValue(
      createUniqueConstraintError(),
    );
    availabilityService.assertSlotAvailable.mockResolvedValue(undefined);

    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.createBooking(
        'customer-id',
        '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
        {
          serviceId: 'service-id',
          barberId: 'barber-id',
          appointmentDate: new Date('2026-08-01T10:00:00.000Z'),
        },
      ),
    ).rejects.toThrow('Booking time is not available');

    expect(prismaService.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('scopes customer booking details to the authenticated user', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findFirst.mockResolvedValue({ id: 'booking-id' });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await bookingService.getBookingDetails(
      'booking-id',
      'customer-id',
      Role.Customer,
    );

    expect(prismaService.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-id',
        userId: 'customer-id',
      },
      include: { service: true, barber: true },
    });
  });

  it('scopes customer booking listings to the authenticated user', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findMany.mockResolvedValue([{ id: 'booking-id' }]);
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const result = await bookingService.getBookings(
      'customer-id',
      Role.Customer,
      {},
    );

    expect(prismaService.booking.findMany).toHaveBeenCalledWith({
      where: { userId: 'customer-id' },
      include: { service: true, barber: true },
      orderBy: { startTime: 'asc' },
    });
    expect(result).toEqual([{ id: 'booking-id' }]);
  });

  it('allows admin booking listings across all customers', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findMany.mockResolvedValue([
      { id: 'first-booking' },
      { id: 'second-booking' },
    ]);
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const result = await bookingService.getBookings('admin-id', Role.Admin, {
      page: 1,
      limit: 1,
    });

    expect(prismaService.booking.findMany).toHaveBeenCalledWith({
      where: {},
      include: { service: true, barber: true },
      orderBy: { startTime: 'asc' },
    });
    expect(result).toEqual([{ id: 'first-booking' }]);
  });

  it('queues an update email when a customer changes their booking', async () => {
    const prismaService = createPrismaService();
    const appointmentDate = new Date('2026-08-01T11:00:00.000Z');
    const updatedBooking = {
      id: 'booking-id',
      barber: { displayName: 'Eric' },
      customerEmail: 'customer@example.com',
      service: { name: 'Haircut + Beard', pricePence: 3500 },
      status: BookingStatus.CONFIRMED,
      startTime: appointmentDate,
    };
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      barberId: 'barber-id',
      customerEmail: 'customer@example.com',
      serviceId: 'service-id',
      startTime: new Date('2026-08-01T10:00:00.000Z'),
      status: BookingStatus.CONFIRMED,
    });
    prismaService.booking.update.mockResolvedValue(updatedBooking);
    availabilityService.assertSlotAvailable.mockResolvedValue(undefined);

    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const result = await bookingService.updateBooking(
      'booking-id',
      'customer-id',
      Role.Customer,
      { appointmentDate },
    );

    expect(availabilityService.assertSlotAvailable).toHaveBeenCalledWith({
      barberId: 'barber-id',
      serviceId: 'service-id',
      startTime: appointmentDate,
      excludeBookingId: 'booking-id',
    });
    expect(prismaService.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: OutboxEventType.BOOKING_UPDATED_EMAIL,
        status: OutboxEventStatus.PENDING,
        payload: {
          appointmentDate: '2026-08-01T11:00:00.000Z',
          barberName: 'Eric',
          bookingReference: 'booking-id',
          pricePence: 3500,
          serviceName: 'Haircut + Beard',
          status: BookingStatus.CONFIRMED,
          to: 'customer@example.com',
        },
      },
    });
    expect(result).toBe(updatedBooking);
  });

  it('cancels an accessible customer booking through a dedicated status update', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      startTime: new Date('2026-08-01T10:00:00.000Z'),
      status: BookingStatus.CONFIRMED,
    });
    const cancelledBooking = {
      id: 'booking-id',
      barber: { displayName: 'Eric' },
      customerEmail: 'customer@example.com',
      service: { name: 'Haircut', pricePence: 2500 },
      status: BookingStatus.CANCELLED,
      startTime: new Date('2026-08-01T10:00:00.000Z'),
    };
    prismaService.booking.update.mockResolvedValue(cancelledBooking);
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const result = await bookingService.cancelBooking(
      'booking-id',
      'customer-id',
      Role.Customer,
    );

    expect(prismaService.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-id',
        userId: 'customer-id',
      },
    });
    expect(prismaService.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-id' },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: expect.any(Date) as Date,
        cancelledByUserId: 'customer-id',
      },
      include: {
        service: true,
        barber: true,
      },
    });
    expect(prismaService.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: OutboxEventType.BOOKING_CANCELLED_EMAIL,
        status: OutboxEventStatus.PENDING,
        payload: {
          appointmentDate: '2026-08-01T10:00:00.000Z',
          barberName: 'Eric',
          bookingReference: 'booking-id',
          pricePence: 2500,
          serviceName: 'Haircut',
          status: BookingStatus.CANCELLED,
          to: 'customer@example.com',
        },
      },
    });
    expect(result).toBe(cancelledBooking);
  });

  it('rejects updates to cancelled customer bookings', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      status: BookingStatus.CANCELLED,
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.updateBooking('booking-id', 'customer-id', Role.Customer, {
        appointmentDate: new Date('2026-08-01T10:00:00.000Z'),
      }),
    ).rejects.toThrow('Cancelled bookings cannot be updated');

    expect(prismaService.booking.update).not.toHaveBeenCalled();
  });

  it('rejects rescheduling when the original booking is today', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      barberId: 'barber-id',
      serviceId: 'service-id',
      startTime: new Date('2026-07-01T10:00:00.000Z'),
      status: BookingStatus.CONFIRMED,
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.updateBooking('booking-id', 'customer-id', Role.Customer, {
        appointmentDate: new Date('2026-07-02T10:00:00.000Z'),
      }),
    ).rejects.toThrow(
      'Bookings can only be rescheduled or cancelled online up to the day before',
    );

    expect(availabilityService.assertSlotAvailable).not.toHaveBeenCalled();
    expect(prismaService.booking.update).not.toHaveBeenCalled();
  });

  it('rejects rescheduling to today', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      barberId: 'barber-id',
      serviceId: 'service-id',
      startTime: new Date('2026-08-01T09:00:00.000Z'),
      status: BookingStatus.CONFIRMED,
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.updateBooking('booking-id', 'customer-id', Role.Customer, {
        appointmentDate: new Date('2026-07-01T10:00:00.000Z'),
      }),
    ).rejects.toThrow('Bookings cannot be made for today or a past date');

    expect(availabilityService.assertSlotAvailable).not.toHaveBeenCalled();
    expect(prismaService.booking.update).not.toHaveBeenCalled();
  });

  it('returns a slot conflict when the database rejects a duplicate reschedule slot', async () => {
    const prismaService = createPrismaService();
    const appointmentDate = new Date('2026-08-01T10:00:00.000Z');
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      barberId: 'barber-id',
      serviceId: 'service-id',
      startTime: new Date('2026-08-01T09:00:00.000Z'),
      status: BookingStatus.CONFIRMED,
    });
    prismaService.booking.update.mockRejectedValue(
      createUniqueConstraintError(),
    );
    availabilityService.assertSlotAvailable.mockResolvedValue(undefined);

    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.updateBooking('booking-id', 'customer-id', Role.Customer, {
        appointmentDate,
      }),
    ).rejects.toThrow('Booking time is not available');

    expect(prismaService.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('rejects cancelling already-cancelled customer bookings', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      startTime: new Date('2026-07-01T10:00:00.000Z'),
      status: BookingStatus.CANCELLED,
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.cancelBooking('booking-id', 'customer-id', Role.Customer),
    ).rejects.toThrow('Booking is already cancelled');

    expect(prismaService.booking.update).not.toHaveBeenCalled();
  });

  it('rejects cancelling when the booking is today', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      startTime: new Date('2026-07-01T10:00:00.000Z'),
      status: BookingStatus.CONFIRMED,
    });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    await expect(
      bookingService.cancelBooking('booking-id', 'customer-id', Role.Customer),
    ).rejects.toThrow(
      'Bookings can only be rescheduled or cancelled online up to the day before',
    );

    expect(prismaService.booking.update).not.toHaveBeenCalled();
  });

  it('looks up bookings by high-entropy reference', async () => {
    const prismaService = createPrismaService();
    const booking = {
      id: 'booking-id',
      userId: 'customer-id',
      customerEmail: 'guest@example.com',
    };
    prismaService.booking.findFirst.mockResolvedValue(booking);
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const result =
      await bookingService.getGuestBookingByReference(' booking-id ');

    expect(prismaService.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-id',
      },
      include: { service: true, barber: true },
    });
    expect(result).toBe(booking);
  });

  it('cancels guest bookings by reference', async () => {
    const prismaService = createPrismaService();
    const booking = {
      id: 'booking-id',
      customerEmail: 'guest@example.com',
      startTime: new Date('2026-08-01T10:00:00.000Z'),
      userId: null,
      status: BookingStatus.CONFIRMED,
    };
    const cancelledBooking = {
      ...booking,
      barber: { displayName: 'Eric' },
      service: { name: 'Haircut', pricePence: 2500 },
      startTime: new Date('2026-08-01T10:00:00.000Z'),
      status: BookingStatus.CANCELLED,
    };
    prismaService.booking.findFirst.mockResolvedValue(booking);
    prismaService.booking.update.mockResolvedValue(cancelledBooking);
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const result =
      await bookingService.cancelGuestBookingByReference('booking-id');

    expect(prismaService.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-id',
      },
    });
    expect(prismaService.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-id' },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: expect.any(Date) as Date,
        cancelledByUserId: null,
      },
      include: {
        service: true,
        barber: true,
      },
    });
    expect(prismaService.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        type: OutboxEventType.BOOKING_CANCELLED_EMAIL,
        status: OutboxEventStatus.PENDING,
        payload: {
          appointmentDate: '2026-08-01T10:00:00.000Z',
          barberName: 'Eric',
          bookingReference: 'booking-id',
          pricePence: 2500,
          serviceName: 'Haircut',
          status: BookingStatus.CANCELLED,
          to: 'guest@example.com',
        },
      },
    });
    expect(result).toBe(cancelledBooking);
  });

  it('links unowned guest bookings by email to a verified user', async () => {
    const prismaService = createPrismaService();
    prismaService.booking.updateMany.mockResolvedValue({ count: 2 });
    const bookingService = new BookingService(
      prismaService as never,
      availabilityService as never,
    );

    const count = await bookingService.linkGuestBookingsToUser(
      'customer-id',
      'Customer@Example.com ',
    );

    expect(prismaService.booking.updateMany).toHaveBeenCalledWith({
      where: {
        userId: null,
        customerEmail: {
          equals: 'Customer@Example.com',
          mode: 'insensitive',
        },
      },
      data: { userId: 'customer-id' },
    });
    expect(count).toBe(2);
  });
});
