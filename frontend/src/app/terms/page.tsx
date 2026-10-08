import type { Metadata } from "next";
import { LegalSection, PublicDocument } from "@/components/legal/public-chrome";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · GitOps Insights",
  description: "Terms that apply to the GitOps Insights service.",
};

export default function TermsPage() {
  return (
    <PublicDocument
      eyebrow="Legal"
      title="Terms of Service"
      lede={`These terms apply to GitOps Insights at https://gitops-insights.com. Last updated ${LEGAL_UPDATED}. The product does not identify a registered company, address, or tax registration, so these terms refer to the Service.`}
    >
      <LegalSection title="Acceptance of terms">
        <p>
          By creating an account, connecting a workspace, or using GitOps Insights, you agree to
          these terms and the <Link href="/privacy" className="text-teal-300 hover:text-teal-200">Privacy Policy</Link>.
          If you do not agree, do not use the Service.
        </p>
      </LegalSection>

      <LegalSection title="Eligibility and account responsibility">
        <p>
          You must be able to form a contract for the organization that will use the Service. You
          are responsible for the accuracy of your account information, for keeping your password
          confidential, and for activity under your account. Tell us at {CONTACT_EMAIL} if you
          believe the account has been used without permission.
        </p>
      </LegalSection>

      <LegalSection title="The Service">
        <p>
          GitOps Insights is a software service for GitOps observability. It provides Argo CD
          visibility, deployment history, application health monitoring, sync tracking, analytics,
          and operational insights for Kubernetes environments that you connect. Argo CD remains
          the source of truth for the applications you connect. The Service reads status and
          history so operators can review it. It does not replace your cluster, Git host, or
          GitOps controller, and it does not change cluster state on your behalf.
        </p>
      </LegalSection>

      <LegalSection title="Plans and billing">
        <p>
          Plans and prices are shown on the <Link href="/pricing" className="text-teal-300 hover:text-teal-200">Pricing</Link> page.
          The Free plan is $0 per month and includes the limits listed there, including a shorter
          deployment history. Pro is a paid monthly subscription at the price shown on that page.
          Promo codes, if accepted at checkout, change only the amount charged by the payment
          provider. Prices can change for future billing periods. The price in effect when you
          subscribe is the price for that purchase.
        </p>
        <p>
          GitOps Insights does not store payment card numbers. Card details are entered with the
          payment provider that presents checkout. Where Paddle is the merchant of record for a
          purchase, Paddle processes the payment, applicable taxes, and the buyer receipt, and
          GitOps Insights receives subscription status and billing references rather than card
          data. The application also includes a Stripe Checkout integration. The provider shown
          at the time you pay is the provider for that purchase.
        </p>
      </LegalSection>

      <LegalSection title="Free plan">
        <p>
          The Free plan is a standing $0 plan with the limits on the Pricing page. It is not a
          time-limited trial of Pro. A payment provider may still label a subscription as
          trialing. That label is the provider&apos;s billing state, not a separate trial offer
          from the Pricing page.
        </p>
      </LegalSection>

      <LegalSection title="Cancellation">
        <p>
          You may cancel a paid subscription from the billing area of the Service or from the
          payment provider&apos;s customer portal when that portal is available for your account.
          Cancellation is intended to stop the next renewal. Access that has already been paid
          for continues until the end of the current billing period, unless the provider ends it
          sooner. The Free plan does not renew for a charge.
        </p>
      </LegalSection>

      <LegalSection title="Refunds">
        <p>
          GitOps Insights does not publish an automatic refund program. If you believe a charge
          was made in error, write to {CONTACT_EMAIL}. Where Paddle is the merchant of record,
          Paddle&apos;s buyer terms may also govern that payment. Where Stripe processed the
          payment, the charge is handled through that checkout. A refund is not guaranteed.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>You will not:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>use the Service to break the law or to access systems you are not allowed to access</li>
          <li>probe, scan, or overload the Service, or attempt to bypass authentication</li>
          <li>upload malware or use the Service to disrupt another customer&apos;s workspace</li>
          <li>misrepresent your identity or your authority to connect an Argo CD instance</li>
          <li>resell the Service or scrape it in order to build a competing data set</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your responsibilities">
        <p>
          You are responsible for the users you allow into your workspace, for the content of the
          Git repositories and applications you connect, and for deciding whether the insights
          shown are sufficient for your operations. Deployment analysis is informational. It is
          not an instruction to change a cluster, and it does not guarantee a diagnosis.
        </p>
      </LegalSection>

      <LegalSection title="GitOps and infrastructure access">
        <p>
          You choose which Argo CD endpoints and credentials to connect. You confirm that you
          have the right to grant that access. Credentials you submit are used to read
          application, sync, health, and deployment information from that source. You can remove
          an integration from the product. You remain responsible for rotating or revoking access
          in Argo CD itself. GitOps Insights does not operate your cluster and does not accept
          responsibility for outages, misconfigurations, or data loss inside your infrastructure.
        </p>
      </LegalSection>

      <LegalSection title="Availability">
        <p>
          The Service is provided on an as-available basis. We do not guarantee uninterrupted,
          error-free, or continuous operation. Maintenance, provider outages, dependency
          failures, and problems in a connected Argo CD instance can interrupt or delay data.
          Historical health or sync values are stored only when they were observed. Missing
          history is shown as not recorded. It is not reconstructed.
        </p>
      </LegalSection>

      <LegalSection title="Third-party services">
        <p>
          The Service depends on services you connect, including Argo CD, and on providers that
          host the application, deliver email, or process payments. Those providers have their own
          terms. GitOps Insights is not responsible for their availability or for changes they
          make. Paddle, when it is the merchant of record, is an independent payment provider.
          Stripe, when checkout uses it, is an independent payment provider.
        </p>
      </LegalSection>

      <LegalSection title="Intellectual property">
        <p>
          GitOps Insights, the product interface, and the software that operates the Service
          belong to the operator of the Service. You keep your rights in the repository metadata,
          application names, and operational data you submit. You grant the Service a limited
          right to host, process, and display that data only to provide the Service to your
          workspace. Feedback you send may be used to improve the Service without obligation to
          you.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimer of warranties">
        <p>
          The Service is provided &quot;as is&quot; and &quot;as available.&quot; To the extent
          permitted by law, we disclaim warranties of merchantability, fitness for a particular
          purpose, and non-infringement. We do not warrant that insights, health states, sync
          states, or deployment results are complete, current, or sufficient for a production
          decision.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the extent permitted by law, the operator of the Service is not liable for indirect,
          incidental, special, consequential, or lost-profit damages, or for loss of data,
          downtime in your cluster, or decisions you make from information shown in the product.
          Our total liability for a claim relating to the Service is limited to the amount you
          paid for the Service in the three months before the claim. If you use the Free plan,
          that amount may be zero. These limits do not apply where the law does not allow them.
        </p>
      </LegalSection>

      <LegalSection title="Suspension and termination">
        <p>
          You may stop using the Service and ask us to close your account. We may suspend or
          close an account that violates these terms, creates a security risk, or fails to pay.
          After closure, access to the workspace ends. Sections that by their nature should
          continue, including intellectual property, disclaimers, and liability limits, still
          apply.
        </p>
      </LegalSection>

      <LegalSection title="Changes to the Service">
        <p>
          Features, limits, and plan contents can change. Material reductions in a paid plan will
          be described on the Pricing page or by email to the account address when we have one.
          We may add, change, or remove features that are still in development, including
          analysis views.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. The date at the top of this page will change when we do. If
          you continue to use the Service after the update is posted, the updated terms apply.
          If you do not agree, stop using the Service and contact us about closing the account.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          A governing law and venue are not stated. The product does not identify a registered
          legal entity or a place of business. When an entity and jurisdiction are identified,
          this section will name them. Until then, these terms are interpreted under the law that
          applies to the operator of the Service, without a claim that any particular company has
          been incorporated.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms:{" "}
          <a className="text-teal-300 hover:text-teal-200" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . See the <Link href="/contact" className="text-teal-300 hover:text-teal-200">Contact</Link> page.
        </p>
      </LegalSection>
    </PublicDocument>
  );
}
