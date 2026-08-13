import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BarberResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() userId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() phone!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  deactivatedAt!: Date | null;
}
