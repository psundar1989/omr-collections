import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  /** "center" renders the ornamental centred heading used by the collection sections. */
  align?: "left" | "center";
  children: React.ReactNode;
  className?: string;
  id?: string;
};

export default function Section({ eyebrow, title, subtitle, href, linkLabel = "View all", align = "left", children, className = "", id }: Props) {
  const link = href && (
    <Link href={href} className="group flex shrink-0 items-center gap-1 text-sm text-ink/80 hover:text-gold-dark">
      {linkLabel} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
    </Link>
  );

  if (align === "center") {
    return (
      <section id={id} className={`container-x mt-16 sm:mt-20 scroll-mt-24 ${className}`}>
        <div className="mb-9 text-center" data-reveal>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="heading-display mt-1 text-3xl text-brown sm:text-4xl">{title}</h2>
          <div className="mx-auto mt-3 flex items-center justify-center gap-3 text-gold" aria-hidden>
            <span className="reveal-line h-px w-12 origin-right bg-gold/60" />
            <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
            <span className="reveal-line h-px w-12 origin-left bg-gold/60" />
          </div>
          {subtitle && <p className="mt-3 font-display text-lg italic text-muted">{subtitle}</p>}
        </div>
        {children}
        {link && <div className="mt-8 flex justify-center">{link}</div>}
      </section>
    );
  }

  return (
    <section id={id} className={`container-x mt-16 sm:mt-20 scroll-mt-24 ${className}`}>
      <div className="mb-7 flex items-end justify-between gap-4" data-reveal>
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 className="heading-display mt-1 text-3xl sm:text-4xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {link}
      </div>
      {children}
    </section>
  );
}
