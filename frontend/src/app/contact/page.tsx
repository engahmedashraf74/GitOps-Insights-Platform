import type { Metadata } from "next";
import { PublicDocument } from "@/components/legal/public-chrome";
import { CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Contact · GitOps Insights",
  description: "Contact GitOps Insights about the product, billing, or partnerships.",
};

const topics = [
  {
    title: "Product support",
    body: "Questions about workspaces, Argo CD connections, deployment history, and how the product behaves.",
  },
  {
    title: "Billing and subscriptions",
    body: "Questions about the Free plan, Pro, cancellation, and charges. There is no separate billing address.",
  },
  {
    title: "Partnerships and business inquiries",
    body: "Questions about using GitOps Insights with your organization. The same address handles these notes.",
  },
];

export default function ContactPage() {
  return (
    <PublicDocument
      eyebrow="Support"
      title="Contact GitOps Insights"
      lede="Questions about the product, billing, subscriptions, support, or partnerships."
    >
      <p>
        Email{" "}
        <a className="text-teal-300 hover:text-teal-200" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
        . There is no contact form and no separate billing address. Send a message and we will
        reply by email when we can. We do not promise a response time.
      </p>
      <div className="grid gap-4 sm:grid-cols-1">
        {topics.map((topic) => (
          <section key={topic.title} className="rounded-xl border border-white/8 p-5">
            <h2 className="text-base font-semibold text-zinc-100">{topic.title}</h2>
            <p className="mt-2 text-zinc-400">{topic.body}</p>
            <a
              className="mt-3 inline-flex text-teal-300 hover:text-teal-200"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(topic.title)}`}
            >
              {CONTACT_EMAIL}
            </a>
          </section>
        ))}
      </div>
    </PublicDocument>
  );
}
