import { Injectable } from '@nestjs/common';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

@Injectable()
export class ArgocdService {
  private readonly ARGOCD_URL =
    'https://argocd-server.argocd.svc.cluster.local';

  private readonly TOKEN = process.env.ARGOCD_TOKEN;

  async getApplication(name: string) {
    console.log('ARGOCD_TOKEN exists:', !!this.TOKEN);

    const response = await fetch(
      `${this.ARGOCD_URL}/api/v1/applications/${name}`,
      {
        headers: {
          Authorization: `Bearer ${this.TOKEN}`,
        },
      },
    );

    console.log('ArgoCD Status:', response.status);

    const data = await response.json();

    console.log(
      'ArgoCD Response:',
      JSON.stringify(data, null, 2),
    );

    return data;
  }
}