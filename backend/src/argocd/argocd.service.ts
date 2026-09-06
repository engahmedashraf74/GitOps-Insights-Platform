import { Injectable } from '@nestjs/common';

@Injectable()
export class ArgocdService {
  private readonly ARGOCD_URL =
    'https://argocd-server.argocd.svc.cluster.local';

  private readonly TOKEN =
    process.env.ARGOCD_TOKEN;

  async getApplication(name: string) {
    const response = await fetch(
      `${this.ARGOCD_URL}/api/v1/applications/${name}`,
      {
        headers: {
          Authorization: `Bearer ${this.TOKEN}`,
        },
      },
    );

    return response.json();
  }
}