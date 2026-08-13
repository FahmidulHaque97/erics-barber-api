jest.mock('src/infrastructure/mail/resend.service', () => ({
  ResendService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { BookingController } from './booking.controller';
import { GetBookingsUseCase } from '../application/use-cases/get-bookings.use-case';
import { GetBookingDetailsUseCase } from '../application/use-cases/get-booking.use-case';
import { CreateBookingUseCase } from '../application/use-cases/create-booking.use-case';
import { UpdateBookingUseCase } from '../application/use-cases/update-booking.use-case';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { BookingGuard } from 'src/common/guards/booking.guard';
import { Role } from 'src/common/constants/role.enum';

const BOOKING_REFERENCE = '93f86393-7e60-4f2e-bf22-ef9f95d6e071';

describe('BookingController', () => {
  let controller: BookingController;
  let getBookingsUseCase: { execute: jest.Mock };
  let getBookingDetailsUseCase: { execute: jest.Mock; byReference: jest.Mock };
  let createBookingUseCase: { execute: jest.Mock };
  let updateBookingUseCase: {
    execute: jest.Mock;
    cancel: jest.Mock;
    guestUpdate: jest.Mock;
    guestCancel: jest.Mock;
  };

  beforeEach(async () => {
    getBookingsUseCase = { execute: jest.fn() };
    getBookingDetailsUseCase = { execute: jest.fn(), byReference: jest.fn() };
    createBookingUseCase = { execute: jest.fn() };
    updateBookingUseCase = {
      execute: jest.fn(),
      cancel: jest.fn(),
      guestUpdate: jest.fn(),
      guestCancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingController],
      providers: [
        { provide: GetBookingsUseCase, useValue: getBookingsUseCase },
        {
          provide: GetBookingDetailsUseCase,
          useValue: getBookingDetailsUseCase,
        },
        { provide: CreateBookingUseCase, useValue: createBookingUseCase },
        { provide: UpdateBookingUseCase, useValue: updateBookingUseCase },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(OptionalAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(BookingGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<BookingController>(BookingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uses the authenticated user when listing bookings', async () => {
    getBookingsUseCase.execute.mockResolvedValue([]);

    await controller.getBookings('customer-id', Role.Customer, { page: 1 });

    expect(getBookingsUseCase.execute).toHaveBeenCalledWith(
      'customer-id',
      Role.Customer,
      {
        page: 1,
      },
    );
  });

  it('passes the admin role when listing bookings', async () => {
    getBookingsUseCase.execute.mockResolvedValue([]);

    await controller.getBookings('admin-id', Role.Admin, { limit: 20 });

    expect(getBookingsUseCase.execute).toHaveBeenCalledWith(
      'admin-id',
      Role.Admin,
      {
        limit: 20,
      },
    );
  });

  it('uses the authenticated user when creating a booking', async () => {
    const booking = { id: 'booking-id', status: 'CONFIRMED' };
    createBookingUseCase.execute.mockResolvedValue(booking);
    const dto = {
      serviceId: 'service-id',
      barberId: 'barber-id',
      appointmentDate: new Date('2026-07-01T10:00:00.000Z'),
    };

    const result = await controller.createBooking(
      'customer-id',
      '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
      dto,
    );

    expect(createBookingUseCase.execute).toHaveBeenCalledWith(
      'customer-id',
      '93f86393-7e60-4f2e-bf22-ef9f95d6e071',
      dto,
    );
    expect(result).toEqual({
      message: 'Booking created successfully',
      booking,
    });
  });

  it('uses the authenticated user and role when reading booking details', async () => {
    getBookingDetailsUseCase.execute.mockResolvedValue({ id: 'booking-id' });

    await controller.getBookingDetails(
      'customer-id',
      Role.Customer,
      'booking-id',
    );

    expect(getBookingDetailsUseCase.execute).toHaveBeenCalledWith(
      'booking-id',
      'customer-id',
      Role.Customer,
    );
  });

  it('uses the authenticated user and role when updating a booking', async () => {
    const booking = { id: 'booking-id', status: 'CONFIRMED' };
    updateBookingUseCase.execute.mockResolvedValue(booking);
    const dto = {
      appointmentDate: new Date('2026-07-01T10:30:00.000Z'),
    };

    const result = await controller.updateBooking(
      'customer-id',
      Role.Customer,
      'booking-id',
      dto,
    );

    expect(updateBookingUseCase.execute).toHaveBeenCalledWith(
      'booking-id',
      'customer-id',
      Role.Customer,
      dto,
    );
    expect(result).toEqual({
      message: 'Booking updated successfully',
      booking,
    });
  });

  it('cancels bookings through the dedicated cancel use case path', async () => {
    const booking = { id: 'booking-id', status: 'CANCELLED' };
    updateBookingUseCase.cancel.mockResolvedValue(booking);

    const result = await controller.cancelBooking(
      'customer-id',
      Role.Customer,
      'booking-id',
    );

    expect(updateBookingUseCase.cancel).toHaveBeenCalledWith(
      'booking-id',
      'customer-id',
      Role.Customer,
    );
    expect(result).toEqual({
      message: 'Booking cancelled successfully',
      booking,
    });
  });

  it('looks up guest bookings by reference', async () => {
    const booking = { id: BOOKING_REFERENCE, status: 'CONFIRMED' };
    getBookingDetailsUseCase.byReference.mockResolvedValue(booking);

    const result = await controller.getBookingByReference({
      reference: BOOKING_REFERENCE,
    });

    expect(getBookingDetailsUseCase.byReference).toHaveBeenCalledWith(
      BOOKING_REFERENCE,
    );
    expect(result).toEqual({ booking });
  });

  it('updates guest bookings by reference', async () => {
    const booking = { id: BOOKING_REFERENCE, status: 'CONFIRMED' };
    const dto = {
      appointmentDate: new Date('2026-07-01T10:30:00.000Z'),
    };
    updateBookingUseCase.guestUpdate.mockResolvedValue(booking);

    const result = await controller.updateBookingByReference(
      BOOKING_REFERENCE,
      dto,
    );

    expect(updateBookingUseCase.guestUpdate).toHaveBeenCalledWith(
      BOOKING_REFERENCE,
      dto,
    );
    expect(result).toEqual({
      message: 'Booking updated successfully',
      booking,
    });
  });

  it('cancels guest bookings by reference', async () => {
    const booking = { id: BOOKING_REFERENCE, status: 'CANCELLED' };
    updateBookingUseCase.guestCancel.mockResolvedValue(booking);

    const result = await controller.cancelBookingByReference(BOOKING_REFERENCE);

    expect(updateBookingUseCase.guestCancel).toHaveBeenCalledWith(
      BOOKING_REFERENCE,
    );
    expect(result).toEqual({
      message: 'Booking cancelled successfully',
      booking,
    });
  });
});
