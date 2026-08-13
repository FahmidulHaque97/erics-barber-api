import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetAvailabilitySlotsQueryDto {
  @ApiProperty()
  @IsString()
  readonly barberId!: string;

  @ApiProperty({ example: '2026-08-13', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly serviceId?: string;
}

export class GetBarberAvailabilitySlotsQueryDto {
  @ApiProperty({ example: '2026-08-13', pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  readonly date!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  readonly serviceId?: string;
}
