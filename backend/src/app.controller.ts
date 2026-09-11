import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'GitOps Insights',
    };
  }

  @Get('about')
  about() {
    return this.appService.getProjectInfo();
  }
}
