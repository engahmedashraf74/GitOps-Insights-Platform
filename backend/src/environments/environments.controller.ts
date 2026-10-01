import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EnvironmentsService } from './environments.service';
import { CreateEnvironmentDto } from '../deployments/dto/deployment.dto';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';

@ApiTags('environments')
@JwtAuth()
@Controller('environments')
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: CreateEnvironmentDto) {
    return this.environmentsService.create(
      user.userId,
      body.name,
      body.applicationId,
    );
  }

  @Get(':applicationId')
  findAll(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.environmentsService.findAll(user.userId, applicationId);
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.environmentsService.delete(user.userId, id);
  }
}
