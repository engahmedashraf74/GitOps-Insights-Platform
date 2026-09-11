import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';

@ApiTags('applications')
@JwtAuth()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() body: CreateApplicationDto) {
    return this.applicationsService.create(user.userId, body);
  }

  @Get()
  @ApiOperation({ summary: 'List applications in the current workspace' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.applicationsService.findAllForUser(user.userId);
  }

  @Get('by-id/:id')
  findById(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.applicationsService.findById(user.userId, id);
  }

  @Get('repository/:id')
  @ApiOperation({ summary: 'Deprecated alias for /applications/:id/repository' })
  findRepositoryLegacy(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.applicationsService.findRepository(user.userId, id);
  }

  @Get(':id/overview')
  overview(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.applicationsService.getOverview(user.userId, id);
  }

  @Get(':id/repository')
  findRepository(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.applicationsService.findRepository(user.userId, id);
  }

  @Get(':id/events')
  events(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.applicationsService.findEvents(user.userId, id);
  }

  @Get(':projectId')
  @ApiOperation({
    summary: 'List applications for a project (legacy frontend contract)',
  })
  findAllByProject(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.applicationsService.findAllByProject(projectId);
  }
}
