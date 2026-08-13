import { Controller, Get, HttpCode } from '@nestjs/common';
import { GetServicesUseCase } from '../application/use-cases/get-services.use-case';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ServiceResponseDto } from './service-response.dto';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly getServicesUseCase: GetServicesUseCase) {}

  @HttpCode(200)
  @ApiOperation({ summary: 'List active bookable services' })
  @ApiOkResponse({ type: ServiceResponseDto, isArray: true })
  @Get('')
  async getServices() {
    return await this.getServicesUseCase.execute();
  }
}
