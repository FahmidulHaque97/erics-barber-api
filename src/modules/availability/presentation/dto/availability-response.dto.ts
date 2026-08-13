import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AvailabilitySlotResponseDto {
  @ApiProperty({ format: 'date-time' }) startTime!: string;
  @ApiProperty({ format: 'date-time' }) endTime!: string;
  @ApiProperty({ example: '10:00' }) label!: string;
  @ApiProperty({ example: '10' }) hour!: string;
}

export class AvailabilityHourResponseDto {
  @ApiProperty({ example: '10' }) hour!: string;
  @ApiProperty({ type: [AvailabilitySlotResponseDto] })
  slots!: AvailabilitySlotResponseDto[];
}

export class AvailabilityResponseDto {
  @ApiProperty() barberId!: string;
  @ApiProperty({ example: '2026-08-13' }) date!: string;
  @ApiPropertyOptional() serviceId?: string;
  @ApiProperty({ example: 30 }) slotMinutes!: number;
  @ApiProperty({ example: 'Europe/London' }) timeZone!: string;
  @ApiProperty({ type: [AvailabilitySlotResponseDto] })
  slots!: AvailabilitySlotResponseDto[];
  @ApiProperty({ type: [AvailabilityHourResponseDto] })
  hours!: AvailabilityHourResponseDto[];
}
