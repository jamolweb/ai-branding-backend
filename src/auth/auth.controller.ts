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
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { frontendUrl } from 'env';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}
  
  // Helper method to set auth cookies
  private setTokenCookies(res: Response, accessToken: string, refreshToken: string): void {
    // Set access token cookie - shorter lifetime, httpOnly for security
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // secure in production
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes in milliseconds
    });
    
    // Set refresh token cookie - longer lifetime, httpOnly for security
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // secure in production
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    });
  }

  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.register(dto);
    
    // Set cookies with tokens
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    
    return { message: 'Registration successful' };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const tokens = await this.authService.login(dto);
    
    // Set cookies with tokens
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    
    return { message: 'Login successful' };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
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
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    const { user, tokens } = await this.authService.validateOAuthUser(
      req.user.email,
      req.user.googleId,
      req.user.name,
    );

    // Set cookies with tokens
    this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);

    // Redirect to frontend without exposing tokens in URL
    return res.redirect(`${frontendUrl}/dashboard`);
  }

  @Post('refresh')
  async refresh(@Req() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies.refresh_token;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found');
    }

    // Extract user ID from the refresh token
    try {
      const decoded = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
      const tokens = await this.authService.refreshTokens(decoded.sub, refreshToken);
      
      // Set new cookies with refreshed tokens
      this.setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
      
      return { message: 'Tokens refreshed successfully' };
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
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.id);
    
    // Clear auth cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    
    return { message: 'Logged out successfully' };
  }
}
