import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuth } from '../common/decorators/jwt-auth.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtUser } from '../common/types/jwt-user';

@ApiTags('dashboard')
@JwtAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats/:applicationId')
  getStats(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.dashboardService.getStats(applicationId, user.userId);
  }

  @Get('timeline/:applicationId')
  getTimeline(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.dashboardService.getTimeline(applicationId, user.userId);
  }

  @Get('failure-rate/:applicationId')
  getFailureRate(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.dashboardService.getFailureRate(applicationId, user.userId);
  }

  @Get('frequency/:applicationId')
  getDeploymentFrequency(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.dashboardService.getDeploymentFrequency(
      applicationId,
      user.userId,
    );
  }

  @Get('overview/:applicationId')
  getOverview(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.dashboardService.getOverview(applicationId, user.userId);
  }
}
