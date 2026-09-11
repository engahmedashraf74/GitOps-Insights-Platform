import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  UpdatePasswordDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/update-user.dto';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @JwtAuth()
  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return this.usersService.getMe(user.userId);
  }

  @JwtAuth()
  @Patch('me')
  updateMe(@CurrentUser() user: JwtUser, @Body() body: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, body);
  }

  @JwtAuth()
  @Patch('me/preferences')
  updatePreferences(
    @CurrentUser() user: JwtUser,
    @Body() body: UpdatePreferencesDto,
  ) {
    return this.usersService.updatePreferences(user.userId, body);
  }

  @JwtAuth()
  @Patch('me/password')
  updatePassword(
    @CurrentUser() user: JwtUser,
    @Body() body: UpdatePasswordDto,
  ) {
    return this.usersService.updatePassword(
      user.userId,
      body.currentPassword,
      body.newPassword,
    );
  }

  @JwtAuth()
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @JwtAuth()
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(
      createUserDto.email,
      createUserDto.password,
    );
  }
}
