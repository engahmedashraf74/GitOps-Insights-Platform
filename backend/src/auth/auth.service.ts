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
import { frontendOrigin, verificationPageUrl } from './verification-link';

const VERIFICATION_RESEND_INTERVAL_MS = 60_000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export type VerificationDelivery = 'accepted' | 'unavailable';

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
    const emailDelivery = await this.issueVerification(user.id, user.email);

    return {
      ok: true,
      requiresVerification: true,
      email: user.email,
      emailDelivery,
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
    if (!this.mailer.configured() || !this.originReady()) {
      this.logger.warn(
        'Verification email was not sent (category=verification-unavailable)',
      );
      return { ok: true, delivery: 'unavailable' as const };
    }
    if (!user || user.emailVerified) {
      return { ok: true, delivery: 'accepted' as const };
    }
    // A failed send stays indistinguishable from an unknown address.
    await this.issueVerification(user.id, user.email);
    return { ok: true, delivery: 'accepted' as const };
  }

  private originReady(): boolean {
    try {
      frontendOrigin();
      return true;
    } catch {
      return false;
    }
  }

  private async issueVerification(
    userId: number,
    email: string,
  ): Promise<VerificationDelivery> {
    if (!this.mailer.configured() || !this.originReady()) {
      this.logger.warn(
        `Verification email was not sent (category=verification-unavailable user=${userId})`,
      );
      return 'unavailable';
    }

    const recent = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId,
        usedAt: null,
        createdAt: { gte: new Date(Date.now() - VERIFICATION_RESEND_INTERVAL_MS) },
      },
      select: { id: true },
    });
    if (recent) {
      this.logger.warn(
        `Verification email was not sent (category=resend-rate-limited user=${userId})`,
      );
      return 'accepted';
    }

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const created = await this.prisma.emailVerificationToken.create({
      data: {
        token,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
        userId,
      },
    });

    let verifyUrl: string;
    try {
      verifyUrl = verificationPageUrl(token);
    } catch {
      await this.consumeToken(created.id);
      this.logger.error(
        `Verification link could not be built (category=verification-url user=${userId})`,
      );
      return 'unavailable';
    }

    const result = await this.mailer.send(
      this.mailer.renderVerifyEmail(email, verifyUrl),
    );
    if (result.status !== 'accepted') {
      await this.consumeToken(created.id);
      this.logger.error(
        `Verification email was not sent (category=${result.category} user=${userId})`,
      );
      return 'unavailable';
    }

    this.logger.log(
      `Verification email accepted by SMTP (category=smtp-accepted user=${userId})`,
    );
    return 'accepted';
  }

  private async consumeToken(id: number) {
    try {
      await this.prisma.emailVerificationToken.update({
        where: { id },
        data: { usedAt: new Date() },
      });
    } catch {
      this.logger.error(
        'Verification token could not be expired (category=verification-token)',
      );
    }
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
