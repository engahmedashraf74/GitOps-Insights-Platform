import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy/jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { JWT_SECRET } from './jwt.constants';

@Module({
  imports: [
    UsersModule,
    OrganizationsModule,
    PrismaModule,
    MailModule,
    PassportModule,
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: {
        expiresIn: '1h',
        algorithm: 'HS256',
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
