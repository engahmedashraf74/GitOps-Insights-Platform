export interface CreateCheckoutInput {
  organizationId: number;
  userId: number;
  plan: 'PRO';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
  provider: 'stripe' | 'stub';
}

export abstract class CheckoutSessionService {
  abstract createSession(
    input: CreateCheckoutInput,
  ): Promise<CheckoutSessionResult>;
}
