import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  @Get('stats/:applicationId')
  getStats(
    @Param('applicationId')
    applicationId: string,
  ) {
    return this.dashboardService.getStats(
      Number(applicationId),
    );
  }

  @Get('timeline/:applicationId')
  getTimeline(
    @Param('applicationId')
    applicationId: string,
  ) {
    return this.dashboardService.getTimeline(
      Number(applicationId),
    );
  }

  @Get('failure-rate/:applicationId')
  getFailureRate(
    @Param('applicationId')
    applicationId: string,
  ) {
    return this.dashboardService.getFailureRate(
      Number(applicationId),
    );
  }

  @Get('frequency/:applicationId')
  getDeploymentFrequency(
    @Param('applicationId')
    applicationId: string,
  ) {
    return this.dashboardService.getDeploymentFrequency(
      Number(applicationId),
    );
  }

  @Get('overview/:applicationId')
  getOverview(
    @Param('applicationId')
    applicationId: string,
  ) {
    return this.dashboardService.getOverview(
      Number(applicationId),
    );
  }
}
