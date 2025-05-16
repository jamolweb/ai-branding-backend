import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JWT_ACCESS_SECRET } from 'env';

// Function to extract JWT from cookie
function extractJwtFromCookie(req: Request): string | null {
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: extractJwtFromCookie,
      secretOrKey: JWT_ACCESS_SECRET,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; email: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return user;
  }
}
