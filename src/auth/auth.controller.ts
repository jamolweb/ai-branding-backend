import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${process.env.GOOGLE_CALLBACK_URL}` +
      `&response_type=code` +
      `&scope=email profile` +
      `&access_type=offline` +
      `&prompt=consent`;

    return { url: googleAuthUrl };
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req, @Res() res) {
    const { user, tokens } = await this.authService.validateOAuthUser(
      req.user.email,
      req.user.googleId,
      req.user.name,
    );

    // Redirect to frontend with tokens
    // const frontendUrl = process.env.NODE_ENV === 'production' ? 'https://brandlly.ai' : 'http://localhost:3000';
    return res.redirect(
      `https://brandlly.ai/dashboard?` +
        `accessToken=${tokens.accessToken}&` +
        `refreshToken=${tokens.refreshToken}`,
    );
  }

  @Post('refresh')
  async refresh(@Req() req) {
    const authHeader = req.headers.authorization;
    const refreshToken = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : authHeader;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Extract user ID from the refresh token
    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      return this.authService.refreshTokens(decoded.sub, refreshToken);
    } catch (error) {
      console.error('Token verification error:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req) {
    return req.user;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req) {
    await this.authService.logout(req.user.id);
    return { message: 'Logged out successfully' };
  }
}
