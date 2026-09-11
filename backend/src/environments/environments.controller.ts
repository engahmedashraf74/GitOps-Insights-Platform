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

@ApiTags('environments')
@JwtAuth()
@Controller('environments')
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Post()
  create(@Body() body: CreateEnvironmentDto) {
    return this.environmentsService.create(body.name, body.applicationId);
  }

  @Get(':applicationId')
  findAll(@Param('applicationId', ParseIntPipe) applicationId: number) {
    return this.environmentsService.findAll(applicationId);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.environmentsService.delete(id);
  }
}
