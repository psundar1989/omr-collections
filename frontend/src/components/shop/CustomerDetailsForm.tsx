"use client";

import { useState } from "react";
import type { CheckoutCustomer } from "@/lib/types";

const KEY = "hm_customer_v2";
const EMPTY: CheckoutCustomer = { customer_name: "", phone: "", whatsapp_number: "", email: "", address: "", landmark: "", city: "", state: "", pincode: "", notes: "" };
const MOBILE = /^(\+?91[\s-]?)?0?[6-9]\d{4}[\s-]?\d{5}$/;

/** Delivery details remembered on this device (never the one-off note). */
export function useCustomerDetails() {
  const [customer, setCustomer] = useState<CheckoutCustomer>(() => {
    if (typeof window === "undefined") return EMPTY;
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) return { ...EMPTY, ...saved, notes: "" };
      // Carry over the older cart form (name / location / pincode).
      const old = JSON.parse(localStorage.getItem("hm_customer_v1") || "{}");
      return { ...EMPTY, customer_name: old.customer_name ?? "", address: old.delivery_location ?? "", pincode: old.pincode ?? "" };
    } catch {
      return EMPTY;
    }
  });
  const remember = (c: CheckoutCustomer) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...c, notes: "" }));
    } catch {
      /* storage full / private mode */
    }
  };
  return [customer, setCustomer, remember] as const;
}

export function validateCustomer(c: CheckoutCustomer): Record<string, string> {
  const e: Record<string, string> = {};
  if (c.customer_name.trim().length < 2) e.customer_name = "Please enter your full name.";
  if (!MOBILE.test(c.phone.trim())) e.phone = "Enter a valid 10-digit mobile number.";
  if (c.whatsapp_number.trim() && !MOBILE.test(c.whatsapp_number.trim())) e.whatsapp_number = "Enter a valid 10-digit WhatsApp number.";
  if (c.email.trim() && !/^\S+@\S+\.\S+$/.test(c.email.trim())) e.email = "Enter a valid email address.";
  if (c.address.trim().length < 5) e.address = "Please enter your full delivery address.";
  if (!c.city.trim()) e.city = "Please enter your city / town.";
  if (!/^[1-9][0-9]{5}$/.test(c.pincode.trim())) e.pincode = "Enter a valid 6-digit pincode.";
  return e;
}

export default function CustomerDetailsForm({ value, onChange, errors }: { value: CheckoutCustomer; onChange: (c: CheckoutCustomer) => void; errors: Record<string, string> }) {
  const [sameWa, setSameWa] = useState(!value.whatsapp_number || value.whatsapp_number === value.phone);
  const set = (k: keyof CheckoutCustomer) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium">Delivery details</legend>
      <Field label="Full name *" error={errors.customer_name}>
        <input className="input" value={value.customer_name} autoComplete="name" onChange={set("customer_name")} />
      </Field>
      <Field label="Mobile number *" error={errors.phone}>
        <input className="input" type="tel" inputMode="tel" value={value.phone} autoComplete="tel" placeholder="98765 43210"
          onChange={(e) => onChange({ ...value, phone: e.target.value, ...(sameWa ? { whatsapp_number: "" } : {}) })} />
      </Field>
      <label className="flex items-center gap-2 text-xs text-ink/80">
        <input type="checkbox" checked={sameWa} onChange={(e) => { setSameWa(e.target.checked); if (e.target.checked) onChange({ ...value, whatsapp_number: "" }); }} />
        My WhatsApp number is the same
      </label>
      {!sameWa && (
        <Field label="WhatsApp number" error={errors.whatsapp_number}>
          <input className="input" type="tel" inputMode="tel" value={value.whatsapp_number} onChange={set("whatsapp_number")} />
        </Field>
      )}
      <Field label="House no., street, area *" error={errors.address}>
        <textarea className="input min-h-20" value={value.address} autoComplete="street-address" onChange={set("address")} />
      </Field>
      <Field label="Landmark" error={errors.landmark}>
        <input className="input" value={value.landmark} placeholder="Near…" onChange={set("landmark")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City / Town *" error={errors.city}>
          <input className="input" value={value.city} autoComplete="address-level2" onChange={set("city")} />
        </Field>
        <Field label="Pincode *" error={errors.pincode}>
          <input className="input" inputMode="numeric" maxLength={6} value={value.pincode} autoComplete="postal-code"
            onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, "") })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State" error={errors.state}>
          <input className="input" value={value.state} autoComplete="address-level1" onChange={set("state")} />
        </Field>
        <Field label="Email" error={errors.email}>
          <input className="input" type="email" value={value.email} autoComplete="email" onChange={set("email")} />
        </Field>
      </div>
      <Field label="Note for the seller" error={errors.notes}>
        <input className="input" value={value.notes} placeholder="Gift wrap, delivery date…" onChange={set("notes")} />
      </Field>
    </fieldset>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose">{error}</span>}
    </label>
  );
}
