import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty({
    description: 'Service selected for the booking.',
    example: 'cmservice123',
  })
  @IsString()
  @MaxLength(100)
  readonly serviceId!: string;

  @ApiProperty({
    description: 'Barber selected for the booking.',
    example: 'cmbarber123',
  })
  @IsString()
  @MaxLength(100)
  readonly barberId!: string;

  @ApiProperty({
    description:
      'Booking start time. Must be on the hour or half-hour mark, must not be today, and must be no more than 1 month ahead.',
    example: '2026-07-02T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  @Type(() => Date)
  @IsDate()
  readonly appointmentDate!: Date;

  @ApiPropertyOptional({
    description:
      'Customer name for guest bookings. Authenticated customers can omit this.',
    example: 'Eric Customer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly customerName?: string;

  @ApiPropertyOptional({
    description:
      'Customer email for guest bookings. Authenticated customers can omit this.',
    example: 'customer@example.com',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  readonly customerEmail?: string;

  @ApiPropertyOptional({
    description:
      'Customer phone number for guest bookings. Authenticated customers can omit this.',
    example: '+447900000000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  readonly customerPhone?: string;
}
