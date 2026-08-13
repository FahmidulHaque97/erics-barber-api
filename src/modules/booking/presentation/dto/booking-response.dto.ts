import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum BookingResponseStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export class BookingServiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty() pricePence!: number;
  @ApiProperty() durationMinutes!: number;
  @ApiProperty() isActive!: boolean;
}

export class BookingBarberDto {
  @ApiProperty() id!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() phone!: string;
}

export class BookingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ nullable: true }) userId!: string | null;
  @ApiPropertyOptional({ nullable: true }) customerName!: string | null;
  @ApiPropertyOptional({ nullable: true }) customerEmail!: string | null;
  @ApiPropertyOptional({ nullable: true }) customerPhone!: string | null;
  @ApiPropertyOptional({ nullable: true }) serviceId!: string | null;
  @ApiPropertyOptional({ nullable: true }) barberId!: string | null;
  @ApiPropertyOptional({ nullable: true }) serviceNameSnapshot!: string | null;
  @ApiPropertyOptional({ nullable: true })
  serviceDurationMinutesSnapshot!: number | null;
  @ApiPropertyOptional({ nullable: true })
  servicePricePenceSnapshot!: number | null;
  @ApiProperty({ enum: BookingResponseStatus })
  status!: BookingResponseStatus;
  @ApiProperty({ format: 'date-time' }) startTime!: Date;
  @ApiProperty({ format: 'date-time' }) endTime!: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledAt!: Date | null;
  @ApiPropertyOptional({ nullable: true })
  cancelledByUserId!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ type: () => BookingServiceDto, nullable: true })
  service?: BookingServiceDto | null;
  @ApiPropertyOptional({ type: () => BookingBarberDto, nullable: true })
  barber?: BookingBarberDto | null;
}

export class BookingMutationResponseDto {
  @ApiProperty({ example: 'Booking created successfully' })
  message!: string;
  @ApiProperty({ type: BookingDto }) booking!: BookingDto;
}

export class BookingLookupResponseDto {
  @ApiProperty({ type: BookingDto }) booking!: BookingDto;
}
