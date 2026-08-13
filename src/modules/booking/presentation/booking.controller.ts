import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GetBookingsUseCase } from '../application/use-cases/get-bookings.use-case';
import { GetBookingDetailsUseCase } from '../application/use-cases/get-booking.use-case';
import { CreateBookingUseCase } from '../application/use-cases/create-booking.use-case';
import { UpdateBookingUseCase } from '../application/use-cases/update-booking.use-case';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { GetBookingsQueryDto } from './dto/get-booking.dto';
import { BookingReferenceDto } from './dto/booking-reference.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from 'src/common/constants/role.enum';
import { BookingGuard } from 'src/common/guards/booking.guard';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import {
  CurrentUser,
  CurrentUserOptional,
  CurrentUserRole,
} from 'src/common/decorators/current-user.decorator';
import {
  BookingDto,
  BookingLookupResponseDto,
  BookingMutationResponseDto,
} from './dto/booking-response.dto';
import { ErrorResponseDto } from 'src/common/dto/http-response.dto';

@ApiTags('Booking')
@ApiExtraModels(BookingDto, BookingMutationResponseDto, ErrorResponseDto)
@Controller('booking')
export class BookingController {
  constructor(
    private readonly getBookingsUseCase: GetBookingsUseCase,
    private readonly getBookingDetailsUseCase: GetBookingDetailsUseCase,
    private readonly createBookingUseCase: CreateBookingUseCase,
    private readonly updateBookingUseCase: UpdateBookingUseCase,
  ) {}

  @Get('')
  @ApiOperation({ summary: 'List bookings accessible to the signed-in user' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, minimum: 1 })
  @ApiOkResponse({ type: BookingDto, isArray: true })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @UseGuards(AuthGuard, RolesGuard, BookingGuard)
  @Roles(Role.Admin, Role.Customer)
  async getBookings(
    @CurrentUser() userId: string,
    @CurrentUserRole() role: Role,
    @Query() query: GetBookingsQueryDto,
  ) {
    const bookings = await this.getBookingsUseCase.execute(userId, role, query);
    return bookings;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an accessible booking by internal ID' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ type: BookingDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @UseGuards(AuthGuard, RolesGuard, BookingGuard)
  @Roles(Role.Admin, Role.Customer, Role.Barber)
  async getBookingDetails(
    @CurrentUser() userId: string,
    @CurrentUserRole() role: Role,
    @Param('id') bookingId: string,
  ) {
    const bookingDetails = await this.getBookingDetailsUseCase.execute(
      bookingId,
      userId,
      role,
    );
    return bookingDetails;
  }

  @Post('')
  @ApiOperation({
    summary: 'Create a confirmed guest or authenticated customer booking',
    description:
      'The key identifies one submission intent for 24 hours. An identical retry in the same authenticated or guest-email scope replays the original 201 response. Reusing the key for different normalized booking details or scope returns 409 IDEMPOTENCY_KEY_REUSED.',
  })
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: BookingMutationResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description:
      'The slot is unavailable, the key is still being processed, or the key was reused for different details. Stable idempotency codes are IDEMPOTENCY_REQUEST_IN_PROGRESS and IDEMPOTENCY_KEY_REUSED.',
  })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @UseGuards(BookingGuard, OptionalAuthGuard)
  async createBooking(
    @CurrentUserOptional() userId: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateBookingDto,
  ) {
    const booking = await this.createBookingUseCase.execute(
      userId,
      idempotencyKey,
      dto,
    );
    return { message: 'Booking created successfully', booking };
  }

  @Post('reference/lookup')
  @ApiOperation({
    summary: 'Look up a guest booking using its secure reference',
  })
  @ApiOkResponse({ type: BookingLookupResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @UseGuards(BookingGuard)
  async getBookingByReference(@Body() dto: BookingReferenceDto) {
    const booking = await this.getBookingDetailsUseCase.byReference(
      dto.reference,
    );
    return { booking };
  }

  @Patch('reference/:reference')
  @ApiOperation({
    summary: 'Reschedule a guest booking by secure reference',
    description:
      'Any combination of service, barber, and appointment time can change. Current service terms, eligibility, booking policy, and availability are revalidated.',
  })
  @ApiParam({ name: 'reference', format: 'uuid' })
  @ApiOkResponse({ type: BookingMutationResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @UseGuards(BookingGuard)
  async updateBookingByReference(
    @Param('reference', new ParseUUIDPipe({ version: '4' })) reference: string,
    @Body() dto: UpdateBookingDto,
  ) {
    const booking = await this.updateBookingUseCase.guestUpdate(reference, dto);
    return { message: 'Booking updated successfully', booking };
  }

  @Patch('reference/:reference/cancel')
  @ApiOperation({ summary: 'Cancel a guest booking by secure reference' })
  @ApiParam({ name: 'reference', format: 'uuid' })
  @ApiOkResponse({ type: BookingMutationResponseDto })
  @UseGuards(BookingGuard)
  async cancelBookingByReference(
    @Param('reference', new ParseUUIDPipe({ version: '4' })) reference: string,
  ) {
    const booking = await this.updateBookingUseCase.guestCancel(reference);
    return { message: 'Booking cancelled successfully', booking };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Reschedule an accessible customer booking',
    description:
      'Any combination of service, barber, and appointment time can change. Current service terms, eligibility, booking policy, and availability are revalidated.',
  })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateBookingDto })
  @ApiOkResponse({ type: BookingMutationResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  @UseGuards(AuthGuard, RolesGuard, BookingGuard)
  @Roles(Role.Admin, Role.Customer)
  async updateBooking(
    @CurrentUser() userId: string,
    @CurrentUserRole() role: Role,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    const booking = await this.updateBookingUseCase.execute(
      id,
      userId,
      role,
      dto,
    );
    return { message: 'Booking updated successfully', booking };
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an accessible customer booking' })
  @ApiBearerAuth()
  @ApiOkResponse({ type: BookingMutationResponseDto })
  @UseGuards(AuthGuard, RolesGuard, BookingGuard)
  @Roles(Role.Admin, Role.Customer)
  async cancelBooking(
    @CurrentUser() userId: string,
    @CurrentUserRole() role: Role,
    @Param('id') id: string,
  ) {
    const booking = await this.updateBookingUseCase.cancel(id, userId, role);
    return { message: 'Booking cancelled successfully', booking };
  }
}
