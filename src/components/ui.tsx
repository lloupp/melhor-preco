import Link from "next/link";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-6 lg:gap-8">
      {children}
    </main>
  );
}

export function Topbar() {
  return (
    <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/90 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Melhor Preco</p>
        <p className="text-sm font-semibold text-ink">Inteligencia de precos</p>
      </div>
      <div className="flex gap-4 text-sm font-medium text-slate-600">
        <Link href="/">Dashboard</Link>
        <Link href="/comparacao">Comparacao</Link>
      </div>
    </nav>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-line/80 bg-paper p-5 shadow-card ${className}`}>
      {children}
    </section>
  );
}

export function Hero({ title, description, actions, meta, eyebrow }: { title: string; description: ReactNode; actions?: ReactNode; meta?: ReactNode; eyebrow?: string }) {
  return (
    <Panel className="relative overflow-hidden bg-[linear-gradient(135deg,rgba(13,122,103,0.08),rgba(255,250,240,0.95),rgba(29,42,47,0.04))]">
      <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{eyebrow}</p> : null}
        <h1 className="text-4xl font-semibold leading-none md:text-5xl">{title}</h1>
        <div className="max-w-3xl text-sm leading-6 text-slate-600">{description}</div>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}
      </div>
    </Panel>
  );
}

export function Button({ children, href, variant = "primary" }: { children: ReactNode; href: string; variant?: "primary" | "secondary" }) {
  const className =
    variant === "primary"
      ? "rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm"
      : "rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-semibold text-ink";

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    neutral: "border-stone-300 bg-stone-100 text-ink",
    acima_faixa: "border-orange-200 bg-orange-50 text-danger",
    alta: "border-orange-200 bg-orange-50 text-danger",
    abaixo_faixa: "border-emerald-200 bg-emerald-50 text-success",
    queda: "border-emerald-200 bg-emerald-50 text-success",
    dentro_faixa: "border-teal-200 bg-teal-50 text-accent",
    best: "border-teal-200 bg-teal-50 text-accent",
    neutro: "border-sky-200 bg-sky-50 text-sky-700",
    estavel: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tones[tone] ?? tones.neutral}`}>
      {children}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: "neutral" | "accent" | "danger" | "success";
}) {
  const toneClasses = {
    neutral: "from-white to-stone-50",
    accent: "from-teal-50 to-white",
    danger: "from-orange-50 to-white",
    success: "from-emerald-50 to-white",
  };
  return (
    <Panel className={`grid gap-2 bg-gradient-to-br ${toneClasses[tone]} p-4`}>
      <span className="text-sm text-slate-600">{label}</span>
      <strong className="text-2xl font-semibold md:text-3xl">{value}</strong>
      {caption ? <span className="text-xs leading-5 text-slate-500">{caption}</span> : null}
    </Panel>
  );
}

export function AlertCard({
  title,
  description,
  href,
  tone,
}: {
  title: string;
  description: string;
  href: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`grid gap-2 rounded-[24px] border p-4 transition hover:-translate-y-0.5 hover:shadow-card ${
        tone === "acima_faixa"
          ? "border-orange-200 bg-orange-50/80"
          : tone === "abaixo_faixa"
            ? "border-emerald-200 bg-emerald-50/80"
            : "border-line bg-white/80"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm font-semibold">{title}</strong>
        <Badge tone={tone}>{tone === "acima_faixa" ? "Alerta" : tone === "abaixo_faixa" ? "Oportunidade" : "Pressao"}</Badge>
      </div>
      <p className="text-sm leading-6 text-slate-600">{description}</p>
    </Link>
  );
}

export function SummaryPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Panel className="grid gap-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </Panel>
  );
}

export function MetricTile({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-white/80 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {supporting ? <div className="mt-2 text-sm text-slate-500">{supporting}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description ? <p className="text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
