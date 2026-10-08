import { CONTACT_EMAIL } from "@/lib/legal";
import Link from "next/link";

const footerLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/contact", label: "Contact" },
];

export function PublicHeader() {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-5 sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-400/15 text-sm font-semibold text-teal-300">
          GI
        </span>
        <span className="whitespace-nowrap text-sm font-semibold text-zinc-100">GitOps Insights</span>
      </Link>
      <nav className="flex items-center gap-3 text-sm" aria-label="Public">
        <Link href="/pricing" className="whitespace-nowrap text-zinc-400 hover:text-zinc-100">
          Pricing
        </Link>
        <Link href="/login" className="whitespace-nowrap text-zinc-400 hover:text-zinc-100">
          Sign in
        </Link>
        <Link
          href="/register"
          className="whitespace-nowrap rounded-lg bg-teal-400 px-3 py-2 font-medium text-zinc-950"
        >
          Start for free
        </Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/8 px-6 py-8 text-sm text-zinc-500">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-zinc-300">GitOps Insights</p>
          <p className="mt-1">Deployment health for GitOps teams.</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Footer">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-zinc-400 hover:text-zinc-100">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto mt-4 max-w-6xl text-xs text-zinc-500">
        <a className="hover:text-zinc-100" href={`mailto:${CONTACT_EMAIL}`}>
          {CONTACT_EMAIL}
        </a>
      </p>
    </footer>
  );
}

export function PublicDocument({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-teal-300">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100 sm:text-4xl">{title}</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-400">{lede}</p>
        <div className="mt-10 space-y-8 text-sm leading-6 text-zinc-300">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}
