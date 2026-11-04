const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

/** ₹1,23,456 / ₹16.50 – Indian digit grouping. */
export function formatPrice(amount: number | null | undefined, currency = "INR"): string {
  if (amount == null || Number.isNaN(amount)) return "";
  if (currency !== "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(amount);
  }
  const hasFraction = Math.round(amount * 100) % 100 !== 0;
  return hasFraction
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : inr.format(amount).replace(/\.00$/, "");
}

export function whatsappLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}
