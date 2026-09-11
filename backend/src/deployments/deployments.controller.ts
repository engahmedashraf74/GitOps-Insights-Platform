import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeploymentsService } from './deployments.service';
import {
  CreateDeploymentDto,
  ListDeploymentsQueryDto,
  UpdateDeploymentDto,
} from './dto/deployment.dto';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';

@ApiTags('deployments')
@JwtAuth()
@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Post()
  create(@Body() body: CreateDeploymentDto) {
    return this.deploymentsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Workspace deployments with filters' })
  findAll(
    @CurrentUser() user: JwtUser,
    @Query() query: ListDeploymentsQueryDto,
  ) {
    return this.deploymentsService.findAllForUser(user.userId, query);
  }

  @Get('by-id/:id')
  findById(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.deploymentsService.findById(user.userId, id);
  }

  @Patch(':id')
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateDeploymentDto,
  ) {
    return this.deploymentsService.updateStatus(user.userId, id, body);
  }

  @Get(':applicationId')
  @ApiOperation({
    summary: 'List deployments for an application (legacy frontend contract)',
  })
  findAllByApplication(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.deploymentsService.findAllForUser(user.userId, {
      applicationId,
    });
  }
}
