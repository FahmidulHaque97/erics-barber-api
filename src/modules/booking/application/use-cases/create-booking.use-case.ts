import { Injectable } from '@nestjs/common';
import { CreateBookingDto } from '../../presentation/dto/create-booking.dto';
import { BookingService } from '../../infrastructure/prisma/booking.prisma-repository';

@Injectable()
export class CreateBookingUseCase {
  constructor(private readonly bookingService: BookingService) {}
  async execute(
    userId: string | undefined,
    idempotencyKey: string,
    dto: CreateBookingDto,
  ) {
    return await this.bookingService.createBooking(userId, idempotencyKey, dto);
  }
}
