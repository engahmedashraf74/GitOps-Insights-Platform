import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdatePreferencesDto, UpdateProfileDto } from './dto/update-user.dto';

const publicUser = {
  id: true,
  email: true,
  username: true,
  createdAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({ select: publicUser });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  findByEmailOrUsername(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });
  }

  async create(email: string, password: string, username?: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
      },
    });
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...publicUser,
        preference: true,
      },
    });
    return user;
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    if (dto.username) {
      const taken = await this.prisma.user.findFirst({
        where: { username: dto.username, NOT: { id: userId } },
      });
      if (taken) {
        throw new ConflictException('Username already exists');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { username: dto.username },
      select: publicUser,
    });
  }

  async updatePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const password = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password },
    });
    return { ok: true };
  }

  async updatePreferences(userId: number, dto: UpdatePreferencesDto) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: dto.theme ?? 'dark',
        timezone: dto.timezone ?? 'UTC',
        defaultProjectId: dto.defaultProjectId ?? null,
        emailNotifications: dto.emailNotifications ?? true,
        deploymentFailures: dto.deploymentFailures ?? true,
        weeklySummary: dto.weeklySummary ?? false,
      },
      update: {
        theme: dto.theme,
        timezone: dto.timezone,
        defaultProjectId: dto.defaultProjectId,
        emailNotifications: dto.emailNotifications,
        deploymentFailures: dto.deploymentFailures,
        weeklySummary: dto.weeklySummary,
      },
    });
  }
}
