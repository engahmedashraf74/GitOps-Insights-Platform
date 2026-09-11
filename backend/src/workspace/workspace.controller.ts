import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkspaceService } from './workspace.service';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';
import { TimeRangeQueryDto } from '../common/dto/time-range.dto';
import { SearchQueryDto } from '../common/dto/search-query.dto';
import { MarkNotificationsReadDto } from '../common/dto/mark-notifications-read.dto';
import { UpdateWorkspaceDto } from '../integrations/dto/integration.dto';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('workspace')
@JwtAuth()
@Controller('workspace')
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly organizations: OrganizationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current organization / workspace' })
  getWorkspace(@CurrentUser() user: JwtUser) {
    return this.workspaceService.getWorkspace(user);
  }

  @Patch()
  @ApiOperation({ summary: 'Rename workspace' })
  async updateWorkspace(
    @CurrentUser() user: JwtUser,
    @Body() body: UpdateWorkspaceDto,
  ) {
    const organization = await this.organizations.ensureForUser(user.userId);
    if (!body.name) return organization;
    return this.prisma.organization.update({
      where: { id: organization.id },
      data: { name: body.name },
    });
  }

  @Get('snapshot')
  @ApiOperation({ summary: 'Projects, applications, and deployments in one payload' })
  snapshot(@CurrentUser() user: JwtUser) {
    return this.workspaceService.snapshot(user);
  }

  @Get('metrics')
  metrics(@CurrentUser() user: JwtUser) {
    return this.workspaceService.metrics(user);
  }

  @Get('activity')
  activity(@CurrentUser() user: JwtUser, @Query() query: TimeRangeQueryDto) {
    return this.workspaceService.activity(user, query.range);
  }

  @Get('health')
  health(@CurrentUser() user: JwtUser) {
    return this.workspaceService.health(user);
  }

  @Get('dora')
  dora(@CurrentUser() user: JwtUser) {
    return this.workspaceService.dora(user);
  }

  @Get('environments')
  environments(@CurrentUser() user: JwtUser) {
    return this.workspaceService.environments(user);
  }

  @Get('search')
  search(@CurrentUser() user: JwtUser, @Query() query: SearchQueryDto) {
    return this.workspaceService.search(user, query.q);
  }

  @Get('notifications')
  notifications(@CurrentUser() user: JwtUser) {
    return this.workspaceService.notifications(user);
  }

  @Patch('notifications/read')
  markRead(
    @CurrentUser() user: JwtUser,
    @Body() body: MarkNotificationsReadDto,
  ) {
    return this.workspaceService.markNotificationsRead(user, body.ids);
  }
}
