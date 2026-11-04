import { ImageResponse } from "next/og";
import { getSettings } from "@/lib/api";

export const alt = "Handmade jewellery and accessories";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const s = await getSettings().catch(() => null);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "linear-gradient(135deg,#fbf8f3 0%,#efe4d2 100%)", color: "#2a2420", fontFamily: "serif" }}>
        <div style={{ fontSize: 28, letterSpacing: 8, textTransform: "uppercase", color: "#8c6c3d" }}>Handcrafted in India</div>
        <div style={{ fontSize: 96, marginTop: 24 }}>{s?.business_name ?? "Handmade Store"}</div>
        <div style={{ fontSize: 40, marginTop: 16, color: "#7a6f66" }}>{s?.tagline ?? "Handmade With Love"}</div>
        <div style={{ marginTop: 48, padding: "14px 36px", borderRadius: 999, background: "#1f9d55", color: "white", fontSize: 30 }}>Order easily on WhatsApp</div>
      </div>
    ),
    size,
  );
}
