import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'email' }) email!: string;
  @ApiProperty() isEmailVerified!: boolean;
}
