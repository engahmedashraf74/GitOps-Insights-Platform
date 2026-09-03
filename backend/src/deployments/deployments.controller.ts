import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { DeploymentsService } from './deployments.service';

@Controller('deployments')
export class DeploymentsController {
  constructor(
    private readonly deploymentsService: DeploymentsService,
  ) {}

  @Post()
  create(@Body() body: any) {
    return this.deploymentsService.create(
      body.revision,
      body.status,
      body.environment,
      body.applicationId,
    );
  }

  @Get(':applicationId')
  findAll(
    @Param('applicationId') applicationId: string,
  ) {
    return this.deploymentsService.findAll(
      Number(applicationId),
    );
  }

  @Patch(':id')
  updateStatus(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.deploymentsService.updateStatus(
      Number(id),
      body.status,
      body.syncStatus,
      body.healthStatus,
    );
  }
}
