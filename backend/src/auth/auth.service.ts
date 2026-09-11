import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OrganizationsService } from '../organizations/organizations.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly organizations: OrganizationsService,
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

    return this.tokenResponse(user.id, user.email);
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

    await this.organizations.ensureForUser(user.id);
    return this.tokenResponse(user.id, user.email);
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
