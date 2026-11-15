import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { getSettings } from "@/lib/api";
import { getCatalogCategories } from "@/lib/catalog";
import { whatsappLink } from "@/lib/format";
import { FacebookIcon, InstagramIcon, WhatsAppIcon, YoutubeIcon } from "@/components/ui/Icons";

export default async function SiteFooter() {
  const s = await getSettings();
  const categories = getCatalogCategories();
  const wa = whatsappLink(s.whatsapp_number, `Hello ${s.business_name}! I have a question.`);
  const year = new Date().getFullYear();

  return (
    <>
      <footer className="mt-20 border-t border-line bg-cream/60">
        <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image src={s.logo_url || "/images/logo/logo-omr.webp"} alt={s.business_name} width={1186} height={601} quality={90} sizes="200px" className="h-24 w-auto object-contain" />
            <p className="mt-3 text-sm leading-relaxed text-muted">{s.footer_description}</p>
            <div className="mt-5 flex gap-2">
              {s.instagram_url && <Social href={s.instagram_url} label="Instagram"><InstagramIcon className="h-4 w-4" /></Social>}
              {s.facebook_url && <Social href={s.facebook_url} label="Facebook"><FacebookIcon className="h-4 w-4" /></Social>}
              {s.youtube_url && <Social href={s.youtube_url} label="YouTube"><YoutubeIcon className="h-4 w-4" /></Social>}
              <Social href={wa} label="WhatsApp"><WhatsAppIcon className="h-4 w-4" /></Social>
            </div>
          </div>
          <div>
            <p className="eyebrow">Shop</p>
            <ul className="mt-4 space-y-1 text-sm lg:space-y-2">
              <li><Link className="inline-block py-1 text-ink/80 hover:text-gold-dark lg:py-0" href="/shop">All Products</Link></li>
              {categories.map((c) => (
                <li key={c.slug}><Link className="inline-block py-1 text-ink/80 hover:text-gold-dark lg:py-0" href={`/shop?category=${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="eyebrow">Help</p>
            <ul className="mt-4 space-y-1 text-sm lg:space-y-2">
              <li><Link className="inline-block py-1 text-ink/80 hover:text-gold-dark lg:py-0" href="/cart">Your Cart</Link></li>
              <li><Link className="inline-block py-1 text-ink/80 hover:text-gold-dark lg:py-0" href="/track-order">Track Your Order</Link></li>
              <li><Link className="inline-block py-1 text-ink/80 hover:text-gold-dark lg:py-0" href="/wishlist">Wishlist</Link></li>
              <li><Link className="inline-block py-1 text-ink/80 hover:text-gold-dark lg:py-0" href="/custom-order">Custom Handmade Orders</Link></li>
              <li><Link className="inline-block py-1 text-ink/80 hover:text-gold-dark lg:py-0" href="/shop?on_sale=1">Offers</Link></li>
            </ul>
          </div>
          <div>
            <p className="eyebrow">Contact</p>
            <ul className="mt-4 space-y-3 text-sm text-ink/80">
              {s.phone_number && <li className="flex gap-2"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><a href={`tel:${s.phone_number.replace(/\s/g, "")}`}>{s.phone_number}</a></li>}
              {s.contact_email && <li className="flex gap-2"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><a href={`mailto:${s.contact_email}`}>{s.contact_email}</a></li>}
              {s.business_address && <li className="flex gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span>{s.business_address}</span></li>}
            </ul>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-whatsapp mt-5"><WhatsAppIcon className="h-4 w-4" /> Chat on WhatsApp</a>
          </div>
        </div>
        <div className="border-t border-line px-4 pb-24 pt-5 text-center text-xs text-muted sm:pb-5">
          © {year} {s.business_name}. Handmade in India · Orders are confirmed on WhatsApp · No online payment collected on this website.
        </div>
      </footer>

      <a href={wa} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-whatsapp text-white shadow-lg shadow-black/15 transition hover:scale-105 sm:right-5">
        <WhatsAppIcon className="h-7 w-7" />
      </a>
    </>
  );
}

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/70 transition hover:border-gold hover:text-gold-dark">
      {children}
    </a>
  );
}
