import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(@Req() req: any) {
    return this.projectsService.findAll(
      req.user.userId,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.projectsService.create(
      body.name,
      body.description,
      req.user.userId,
    );
  }
}
