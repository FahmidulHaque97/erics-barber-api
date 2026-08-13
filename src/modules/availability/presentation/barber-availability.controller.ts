import { Controller, Get, HttpCode, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GetAvailabilitySlotsUseCase } from '../application/use-cases/get-availability-slots.use-case';
import { GetBarberAvailabilitySlotsQueryDto } from './dto/get-availability-slots.dto';
import { AvailabilityResponseDto } from './dto/availability-response.dto';

@ApiTags('Availability')
@Controller('barbers/:barberId/availability')
export class BarberAvailabilityController {
  constructor(
    private readonly getAvailabilitySlotsUseCase: GetAvailabilitySlotsUseCase,
  ) {}

  @HttpCode(200)
  @ApiOperation({ summary: 'List bookable slots for one barber and date' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @ApiParam({ name: 'barberId', required: true, type: String })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    example: '2026-07-06',
  })
  @ApiQuery({ name: 'serviceId', required: false, type: String })
  @Get('slots')
  async getSlots(
    @Param('barberId') barberId: string,
    @Query() query: GetBarberAvailabilitySlotsQueryDto,
  ) {
    return await this.getAvailabilitySlotsUseCase.execute({
      barberId,
      ...query,
    });
  }
}
