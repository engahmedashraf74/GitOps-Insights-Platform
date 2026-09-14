import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mail/mailer.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly organizations: OrganizationsService,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  async register(email: string, password: string, username?: string) {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    if (username) {
      const taken = await this.usersService.findByUsername(username);
      if (taken) {
        throw new ConflictException('Username already exists');
      }
    }

    const user = await this.usersService.create(email, password, username);
    await this.organizations.ensureForUser(user.id);
    await this.issueVerification(user.id, user.email);

    return {
      ok: true,
      requiresVerification: true,
      email: user.email,
    };
  }

  async login(identifier: string, password: string) {
    const user = await this.usersService.findByEmailOrUsername(identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Email is not verified. Check your inbox or resend the verification email.',
      );
    }

    await this.organizations.ensureForUser(user.id);
    return this.tokenResponse(user.id, user.email);
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Verification link is invalid or expired.');
    }

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date() },
      }),
    ]);

    await this.organizations.ensureForUser(record.userId);
    return this.tokenResponse(record.userId, record.user.email);
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || user.emailVerified) {
      return { ok: true };
    }
    await this.issueVerification(user.id, user.email);
    return { ok: true };
  }

  private async issueVerification(userId: number, email: string) {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.emailVerificationToken.create({
      data: { token, expiresAt, userId },
    });
    const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    const message = this.mailer.renderVerifyEmail(email, verifyUrl);
    await this.mailer.send(message);
    this.logger.log(`Verification email issued for user ${userId}`);
  }

  me(userId: number) {
    return this.usersService.getMe(userId);
  }

  private tokenResponse(userId: number, email: string) {
    const token = this.jwtService.sign({
      userId,
      email,
    });

    return {
      access_token: token,
    };
  }
}
