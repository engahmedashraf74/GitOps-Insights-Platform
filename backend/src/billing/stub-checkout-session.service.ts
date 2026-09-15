import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CheckoutSessionService,
  type CreateCheckoutInput,
  type CheckoutSessionResult,
} from './checkout-session.service';

@Injectable()
export class StubCheckoutSessionService extends CheckoutSessionService {
  async createSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSessionResult> {
    const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    const id = `stub_${randomUUID()}`;
    return {
      id,
      provider: 'stub',
      url: `${appUrl}/upgrade?checkout=${id}&plan=${input.plan}`,
    };
  }
}
