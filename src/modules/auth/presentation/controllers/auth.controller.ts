import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiExtraModels,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { RegisterUseCase } from '../../application/use-cases/register.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { ResetPasswordEmailUseCase } from '../../application/use-cases/reset-password-email.use-case';
import { VerifyEmailUseCase } from '../../application/use-cases/verify-email.use-case';
import { SendVerificationEmailUseCase } from '../../application/use-cases/send-verification-email.use-case';
import { AccountLookupUseCase } from '../../application/use-cases/account-lookup.use-case';

import { LoginRequestDto, LoginResultDto } from '../dto/login.dto';
import { MfaDto } from '../dto/mfa.dto';
import { RegisterDto } from '../dto/register.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import {
  VerifyEmailRequestDto,
  VerifyEmailResponseDto,
} from '../dto/verify-email.dto';
import { SendVerificationDto } from '../dto/send-verification.dto';
import { ResetPasswordEmailDto } from '../dto/reset-password-email.dto';
import { RefreshTokenResponseDto } from '../dto/refresh-token.dto';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { UserAgent } from 'src/common/decorators/user-agent.decorator';
import { Request, Response } from 'express';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthLoggingInterceptor } from '../interceptors/auth-logging.interceptor';
import { VerifyMfaUseCase } from '../../application/use-cases/verify-mfa.use-case';
import { UpdateMfaPreferenceUseCase } from '../../application/use-cases/update-mfa-preference.use-case';
import { MfaPreferenceDto } from '../dto/mfa-preference.dto';
import { UpdateProfileDto } from '../dto/update-profile.dto';
import { DeleteAccountUseCase } from '../../application/use-cases/delete-account.use-case';
import {
  AccountLookupDto,
  AccountLookupResponseDto,
} from '../dto/account-lookup.dto';
import {
  LoginMfaRequiredResponseDto,
  LoginResponseDto,
} from '../dto/login.dto';
import { MessageResponseDto } from 'src/common/dto/http-response.dto';
import { ProfileResponseDto } from '../dto/profile.dto';

const ONE_MINUTE = 60_000;
const ONE_HOUR = 60 * 60_000;

@ApiTags('Auth')
@ApiExtraModels(LoginResponseDto, LoginMfaRequiredResponseDto)
@Controller('auth')
@UseInterceptors(AuthLoggingInterceptor)
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly verifyEmailUseCase: VerifyEmailUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly resetPasswordEmailUseCase: ResetPasswordEmailUseCase,
    private readonly verifyMfaUseCase: VerifyMfaUseCase,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly sendVerificationEmailUseCase: SendVerificationEmailUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly updateMfaPreferenceUseCase: UpdateMfaPreferenceUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly accountLookupUseCase: AccountLookupUseCase,
  ) {}

  @HttpCode(201)
  @ApiCreatedResponse({
    description: 'User registered successfully',
    type: MessageResponseDto,
  })
  @Throttle({ default: { limit: 5, ttl: ONE_MINUTE } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    await this.registerUseCase.execute(dto);
    return {
      message:
        'User registered successfully. Check your email for verification link.',
    };
  }

  @HttpCode(200)
  @ApiResponse({
    status: 200,
    description: 'Verification email sent successfully',
    type: MessageResponseDto,
  })
  @Throttle({ default: { limit: 3, ttl: ONE_HOUR } })
  @Post('send-verification-email')
  async sendVerificationEmail(@Body() dto: SendVerificationDto) {
    await this.sendVerificationEmailUseCase.execute(dto.email);
    return { message: 'Verification email sent successfully' };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'Email verified successfully',
    type: VerifyEmailResponseDto,
  })
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @Post('verify-email')
  async verifyEmail(
    @UserAgent() userAgent: string,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: VerifyEmailRequestDto,
  ): Promise<VerifyEmailResponseDto> {
    const { accessToken, refreshToken, refreshMaxAgeSeconds } =
      await this.verifyEmailUseCase.execute(dto.token, userAgent);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/auth',
      secure: true,
      sameSite: 'none',
      maxAge: refreshMaxAgeSeconds * 1000,
    });
    return {
      message: 'Email verified successfully',
      accessToken,
      refreshToken,
      refreshMaxAgeSeconds,
    };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'Account lookup completed',
    type: AccountLookupResponseDto,
  })
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @Post('account-lookup')
  async accountLookup(
    @Body() dto: AccountLookupDto,
  ): Promise<AccountLookupResponseDto> {
    return await this.accountLookupUseCase.execute(dto.email);
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'User logged in successfully',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginResponseDto) },
        { $ref: getSchemaPath(LoginMfaRequiredResponseDto) },
      ],
    },
  })
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @Post('login')
  async login(
    @UserAgent() userAgent: string,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginRequestDto,
  ): Promise<LoginResultDto> {
    const result = await this.loginUseCase.execute(dto, userAgent);

    if ('mfaRequired' in result) {
      return result;
    }

    const { accessToken, refreshToken, refreshMaxAgeSeconds } = result;
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/auth',
      secure: true,
      sameSite: 'none',
      maxAge: refreshMaxAgeSeconds * 1000,
    });
    return {
      accessToken,
      refreshToken,
      refreshMaxAgeSeconds,
      message: 'User logged in successfully',
    };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'User profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() userId: string) {
    return await this.getProfileUseCase.execute(userId);
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'User profile updated successfully',
    type: ProfileResponseDto,
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put('profile')
  async updateProfile(
    @CurrentUser() userId: string,
    @Body() profileData: UpdateProfileDto,
  ) {
    return await this.updateProfileUseCase.execute(userId, profileData);
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'Account deleted successfully',
    type: MessageResponseDto,
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Delete('account')
  async deleteAccount(
    @CurrentUser() userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.deleteAccountUseCase.execute(userId);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      path: '/auth',
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { message: 'Account deleted successfully' };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'User logged out successfully',
    type: MessageResponseDto,
  })
  @ApiCookieAuth('refreshToken')
  @Throttle({ default: { limit: 30, ttl: ONE_MINUTE } })
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.['refreshToken'] as string | undefined;
    await this.logoutUseCase.execute(refreshToken);
    res.clearCookie('refreshToken', {
      httpOnly: true,
      path: '/auth',
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return { message: 'User logged out successfully' };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'Password reset link sent to email if it exists',
    type: MessageResponseDto,
  })
  @Throttle({ default: { limit: 3, ttl: ONE_HOUR } })
  @Post('reset-password-email')
  async resetPasswordEmail(@Body() dto: ResetPasswordEmailDto) {
    await this.resetPasswordEmailUseCase.execute(dto.email, dto.surface);
    return { message: 'Password reset link sent to email if it exists' };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'Password reset successfully',
    type: MessageResponseDto,
  })
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute(dto);
    return { message: 'Password reset successfully' };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'MFA verified successfully',
    type: LoginResponseDto,
  })
  @Throttle({ default: { limit: 10, ttl: ONE_MINUTE } })
  @Post('verify-mfa')
  async verifyMFA(
    @UserAgent() userAgent: string,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: MfaDto,
  ) {
    const { accessToken, refreshToken, refreshMaxAgeSeconds } =
      await this.verifyMfaUseCase.execute(dto, userAgent);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/auth',
      secure: true,
      sameSite: 'none',
      maxAge: refreshMaxAgeSeconds * 1000,
    });
    return {
      accessToken,
      refreshToken,
      refreshMaxAgeSeconds,
      message: 'MFA verified successfully',
    };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'MFA preference updated successfully',
    type: MessageResponseDto,
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Put('mfa-preference')
  async updateMfaPreference(
    @CurrentUser() userId: string,
    @Body() dto: MfaPreferenceDto,
  ) {
    await this.updateMfaPreferenceUseCase.execute(userId, dto);
    return { message: 'MFA preference updated successfully' };
  }

  @HttpCode(200)
  @ApiOkResponse({
    description: 'Access token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiCookieAuth('refreshToken')
  @Throttle({ default: { limit: 30, ttl: ONE_MINUTE } })
  @Post('refresh')
  async refreshTokens(
    @UserAgent() userAgent: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshTokenResponseDto> {
    const oldRefreshToken = req.cookies['refreshToken'] as string;
    const { accessToken, refreshToken, refreshMaxAgeSeconds } =
      await this.refreshTokenUseCase.execute(oldRefreshToken, userAgent);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      path: '/auth',
      secure: true,
      sameSite: 'none',
      maxAge: refreshMaxAgeSeconds * 1000,
    });

    return {
      accessToken,
      refreshToken,
      refreshMaxAgeSeconds,
      message: 'Access token refreshed successfully',
    };
  }
}
