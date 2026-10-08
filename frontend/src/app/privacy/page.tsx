import type { Metadata } from "next";
import { LegalSection, PublicDocument } from "@/components/legal/public-chrome";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/legal";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · GitOps Insights",
  description: "How GitOps Insights handles account and operational data.",
};

export default function PrivacyPage() {
  return (
    <PublicDocument
      eyebrow="Legal"
      title="Privacy Policy"
      lede={`This policy describes how GitOps Insights handles information when you use the Service at https://gitops-insights.com. Last updated ${LEGAL_UPDATED}. It does not claim a privacy certification.`}
    >
      <LegalSection title="Who this policy covers">
        <p>
          This policy is issued by the operator of GitOps Insights, referred to here as the
          Service. No registered company name, address, or registration number is stated, because
          those details are not identified in the product.
        </p>
      </LegalSection>

      <LegalSection title="Information you provide">
        <p>Depending on how you use the Service, we process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>account information, such as your name, email address, and password</li>
          <li>authentication information, including a session token stored in the browser</li>
          <li>billing and subscription status, plan, and payment-provider references</li>
          <li>messages you send to the contact address</li>
        </ul>
        <p>
          Passwords are stored as hashes. We do not ask you to send a password by email.
        </p>
      </LegalSection>

      <LegalSection title="Billing information">
        <p>
          Payment card numbers, card security codes, and full payment credentials are not stored
          by GitOps Insights. They are processed by the payment provider that presents checkout.
          Where Paddle is the merchant of record, Paddle processes the card payment and GitOps
          Insights receives subscription status and billing references. The application also
          includes a Stripe Checkout integration. In that case Stripe processes the card payment,
          and the Service stores Stripe customer and subscription identifiers needed to show your
          plan. We do not claim a PCI certification.
        </p>
      </LegalSection>

      <LegalSection title="GitOps and operational data">
        <p>
          When you connect Argo CD, the Service stores the information it reads in order to show
          the product. That can include application metadata, deployment history, health and sync
          status, repository metadata, cluster and application identifiers, and events or logs
          used for operational analysis. Health and sync are stored when they were observed at
          the time of a snapshot. Older rows that were never snapshotted stay without those
          values. Argo CD credentials you submit are encrypted before they are stored and are not
          returned to the browser. Other workspace data is not described here as encrypted at
          rest, and no certification of that storage is claimed.
        </p>
      </LegalSection>

      <LegalSection title="Technical information">
        <p>
          The browser stores a session token, theme and interface preferences, onboarding state,
          and which notifications you have marked read, using local storage on your device. The
          Service does not set its own analytics cookies and does not run a third-party analytics
          script. A hosting provider or a payment provider may process technical data, including
          addresses and request logs, under that provider&apos;s own terms when you use their
          pages.
        </p>
      </LegalSection>

      <LegalSection title="How information is used">
        <ul className="list-disc space-y-1 pl-5">
          <li>to create and secure your account</li>
          <li>to operate the workspace, history, and analysis views</li>
          <li>to bill for a paid plan and to apply the plan limits</li>
          <li>to answer support and billing questions you send us</li>
          <li>to protect the Service against abuse</li>
          <li>to meet a legal obligation if one applies</li>
        </ul>
        <p>
          Product analytics inside the Service are computed from your workspace data so you can
          see delivery volume and outcomes. They are not sold as a marketing profile.
        </p>
      </LegalSection>

      <LegalSection title="Third-party processors">
        <p>
          We use other providers only to run the Service. Payment processing is done by Paddle
          when Paddle is the merchant of record for that purchase, and by Stripe when checkout
          uses the Stripe integration. Email for account messages is sent through the mail
          transport configured for the Service. The application is hosted by the infrastructure
          provider that runs it. The product does not name that host here, and it does not name
          Cloudflare as a processor, because the repository does not configure Cloudflare. Argo
          CD and your Git host process data because you connect them. They are your services.
        </p>
      </LegalSection>

      <LegalSection title="Retention">
        <p>
          Account information is kept while the account is open. Deployment history follows the
          plan limits on the Pricing page: a shorter window on the Free plan and a longer history
          on Pro. We do not publish a separate retention schedule. If you ask us to delete the
          account, we delete or disconnect the account data we still hold, except where a billing,
          security, or legal record has to be kept. Integration credentials are removed when you
          remove the integration or the account.
        </p>
      </LegalSection>

      <LegalSection title="Your requests">
        <p>
          You may ask to access, correct, or delete personal information associated with your
          account by writing to {CONTACT_EMAIL}. We will respond when we can review the request.
          We do not promise a fixed number of days. This policy does not claim that the Service
          is certified under GDPR, UK GDPR, or any other privacy regime. It also does not claim
          HIPAA, SOC 2, ISO 27001, or PCI compliance.
        </p>
      </LegalSection>

      <LegalSection title="International transfers">
        <p>
          The Service may be hosted outside the country where you use it. A specific hosting
          region is not published in the product. If you connect Argo CD, operational data is
          processed where the Service runs and, separately, where your Argo CD instance runs.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Access to a workspace requires an account. Passwords are hashed. Argo CD credentials
          are encrypted before storage. The public site is intended to be served over HTTPS.
          These practices reduce risk. They are not a guarantee, and no audit certification is
          claimed.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          The Service is for professional and organizational use. It is not directed at children,
          and we do not knowingly collect information from children.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If this policy changes, the date at the top of the page will change. Continued use of
          the Service after the update is posted means the updated policy applies.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Privacy questions and deletion requests:{" "}
          <a className="text-teal-300 hover:text-teal-200" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          . You can also use the <Link href="/contact" className="text-teal-300 hover:text-teal-200">Contact</Link> page.
        </p>
      </LegalSection>
    </PublicDocument>
  );
}
