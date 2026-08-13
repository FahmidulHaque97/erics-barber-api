import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from 'src/common/constants/role.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CreateBarberUseCase } from '../application/use-cases/create-barber.use-case';
import { DeleteBarberUseCase } from '../application/use-cases/delete-barber.use-case';
import { GetBarberUseCase } from '../application/use-cases/get-barber.use-case';
import { GetBarbersUseCase } from '../application/use-cases/get-barbers.use-case';
import { GetBarberDto } from './dto/get-barber.dto';
import { CreateBarberDto } from './dto/create-barber.dto';
import { UpdateBarberUseCase } from '../application/use-cases/update-barber.use-case';
import { DeleteBarberDto } from './dto/delete-barber.dto';
import { UpdateBarberDto } from './dto/update-barber.dto';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BarberResponseDto } from './dto/barber-response.dto';
import { MessageResponseDto } from 'src/common/dto/http-response.dto';

@ApiTags('Barbers')
@Controller('barbers')
export class BarbersController {
  constructor(
    private readonly getBarberUseCase: GetBarberUseCase,
    private readonly getBarbersUseCase: GetBarbersUseCase,
    private readonly createBarberUseCase: CreateBarberUseCase,
    private readonly updateBarberUseCase: UpdateBarberUseCase,
    private readonly deleteBarberUseCase: DeleteBarberUseCase,
  ) {}

  @HttpCode(200)
  @ApiOperation({ summary: 'List active barbers available for booking' })
  @ApiOkResponse({ type: BarberResponseDto, isArray: true })
  @Get('')
  async getBarbers() {
    const barbers = await this.getBarbersUseCase.execute();
    return barbers;
  }

  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: BarberResponseDto })
  @Get(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.Admin, Role.Customer, Role.Barber)
  async getBarberDetails(@Param() dto: GetBarberDto) {
    const barber = await this.getBarberUseCase.execute(dto.id);
    return barber;
  }

  @HttpCode(201)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: MessageResponseDto })
  @Post('')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async createBarber(@Body() dto: CreateBarberDto) {
    const barber = await this.createBarberUseCase.execute(dto);
    return { message: 'Barber created successfully', barber };
  }

  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponseDto })
  @Put(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async updateBarber(@Param('id') id: string, @Body() dto: UpdateBarberDto) {
    const barber = await this.updateBarberUseCase.execute(id, dto);
    return { message: 'Barber updated successfully', barber };
  }

  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MessageResponseDto })
  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async deleteBarber(@Param() dto: DeleteBarberDto) {
    await this.deleteBarberUseCase.execute(dto.id);
    return { message: 'Barber deleted successfully' };
  }
}
