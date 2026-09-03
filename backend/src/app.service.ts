import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {

  getProjectInfo() {
    return {
      name: 'GitOps Insights',
      version: '1.0.0',
      author: 'Ahmed Ashraf',
    };
  }

}
