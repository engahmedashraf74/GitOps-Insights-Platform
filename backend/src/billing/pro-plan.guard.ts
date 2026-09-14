import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { OrganizationsService } from '../organizations/organizations.service';
import { isProPlan } from './plan';
import type { JwtUser } from '../common/types/jwt-user';

@Injectable()
export class ProPlanGuard implements CanActivate {
  constructor(private readonly organizations: OrganizationsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = request.user;
    if (!user?.userId) {
      throw new ForbiddenException('Authentication required');
    }
    const organization = await this.organizations.ensureForUser(user.userId);
    if (!isProPlan(organization)) {
      throw new ForbiddenException(
        'This feature requires a Pro plan. Upgrade to unlock it.',
      );
    }
    return true;
  }
}
