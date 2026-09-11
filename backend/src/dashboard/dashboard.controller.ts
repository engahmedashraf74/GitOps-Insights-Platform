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
  getStats(@Param('applicationId', ParseIntPipe) applicationId: number) {
    return this.dashboardService.getStats(applicationId);
  }

  @Get('timeline/:applicationId')
  getTimeline(@Param('applicationId', ParseIntPipe) applicationId: number) {
    return this.dashboardService.getTimeline(applicationId);
  }

  @Get('failure-rate/:applicationId')
  getFailureRate(@Param('applicationId', ParseIntPipe) applicationId: number) {
    return this.dashboardService.getFailureRate(applicationId);
  }

  @Get('frequency/:applicationId')
  getDeploymentFrequency(
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.dashboardService.getDeploymentFrequency(applicationId);
  }

  @Get('overview/:applicationId')
  getOverview(
    @CurrentUser() user: JwtUser,
    @Param('applicationId', ParseIntPipe) applicationId: number,
  ) {
    return this.dashboardService.getOverview(applicationId, user.userId);
  }
}
