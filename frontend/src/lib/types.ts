/** "collections" = a photographed collection (silk thread jhumka, bangles…), not shown in "Shop by Category". */
export type CategorySection = "beads" | "charms" | "collections";

export type Category = {
  id: number;
  name: string;
  slug: string;
  /** Category part of product SKUs (OMR-<code>-001), e.g. "BG"; null until the first SKU is generated. */
  sku_code: string | null;
  description: string | null;
  /** Homepage collection: "beads" (Trendset Beads), "charms" (Signature Charms) or null (Shop by Category). */
  section: CategorySection | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
};

export type ProductImage = {
  id: number;
  url: string;
  alt_text: string | null;
  /** The colour this photo shows (one of the product's colours) – shown when that colour is chosen. */
  colour?: string | null;
  is_primary: boolean;
  sort_order: number;
};

/** SKU of one colour × size choice of a product without variants. */
export type OptionSku = { colour: string | null; size: string | null; sku: string };

export type Variant = {
  id: number;
  colour: string | null;
  size: string | null;
  sku: string | null;
  additional_price: number;
  /** null when the product is "price on request". */
  price: number | null;
  original_price: number | null;
  in_stock: boolean;
  stock_quantity: number | null;
  is_active?: boolean;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  /** OMR-<CATEGORY>-<NUMBER>, e.g. OMR-BG-001. */
  sku: string;
  /** Photo-catalogue code ("product-062") – stable key of products.json entries; null for admin-created products. */
  catalog_code?: string | null;
  short_description: string | null;
  category: { id: number; name: string; slug: string } | null;
  image_url: string | null;
  /** null when price_on_request is true – never show a made-up price. */
  price: number | null;
  price_on_request: boolean;
  original_price: number | null;
  discount_percentage: number | null;
  currency: string;
  offer: { id: number; name: string; ends_at: string | null } | null;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  in_stock: boolean;
  stock_quantity: number | null;
  /** Set by the admin; independent of stock tracking and of the enabled/disabled switch. */
  availability_status: AvailabilityStatus;
  /** Enabled, available and in stock – Add to Cart / WhatsApp ordering allowed. */
  is_orderable: boolean;
  colours: string[];
  /** The same colours with their swatch colour from the admin palette (hex null when unknown). */
  colour_options: ColourOption[];
  sizes: string[];
  has_variants: boolean | null;
  /** When the product was listed (photo date for imported products) – "Latest" sorting. */
  listed_at: string | null;
  // detail
  description?: string | null;
  material?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  images?: ProductImage[];
  variants?: Variant[];
  /** Products without variants: the SKU of each colour × size choice. */
  option_skus?: OptionSku[];
};

export type ColourOption = { name: string; hex: string | null };

export type AvailabilityStatus = "available" | "sold_out" | "discontinued";

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available",
  sold_out: "Sold Out",
  discontinued: "Discontinued",
};

export type PricingMode = "fixed" | "sale" | "on_request";

export type AdminProduct = Product & {
  category_id: number | null;
  regular_price: number;
  sale_price: number | null;
  pricing_mode: PricingMode;
  /** Size selection on/off for customers; `sizes` always holds the stored list in the admin. */
  sizes_enabled: boolean;
  /** "photo_catalogue" for products imported from src/data/products.json, null when created in the admin. */
  source: string | null;
  track_stock: boolean;
  raw_stock_quantity: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  is_active: boolean;
  views_count: number;
  created_at: string;
  updated_at: string;
};

export type Banner = {
  id: number;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  button_text: string | null;
  button_link: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Testimonial = { name: string; location?: string; text: string; rating?: number };

export type Settings = {
  business_name: string;
  tagline: string;
  hero_description: string;
  announcement_text: string;
  logo_url: string | null;
  favicon_url: string | null;
  whatsapp_number: string;
  contact_email: string | null;
  phone_number: string | null;
  currency: string;
  currency_symbol: string;
  business_address: string | null;
  footer_description: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  pinterest_url: string | null;
  price_note: string | null;
  order_disclaimer: string;
  free_shipping_threshold: string | null;
  testimonials: Testimonial[];
  instagram_images: { image_url: string; link?: string }[];
  meta_description: string | null;
  colour_swatches: { name: string; hex: string }[];
  size_presets: SizePreset[];
};

export type SizePreset = { name: string; sizes: string[] };

export type Paginated<T> = {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number; from: number | null; to: number | null };
  meta_extra?: { min_price: number; max_price: number };
};

export type HomeData = {
  banners: Banner[];
  categories: Category[];
  featured: Product[];
  new_arrivals: Product[];
  best_sellers: Product[];
  special_offers: Product[];
};

export type QuoteLine = {
  key: string;
  product_id: number;
  variant_id: number | null;
  name: string | null;
  slug: string | null;
  sku: string | null;
  image_url: string | null;
  colour: string | null;
  size: string | null;
  quantity: number;
  unit_price: number | null;
  original_price: number | null;
  price_on_request: boolean;
  line_total: number;
  available_quantity: number | null;
  error: string | null;
};

export type Quote = {
  valid: boolean;
  items: QuoteLine[];
  total: number;
  total_formatted: string;
  /** Some lines are "price on request": `total` only sums the priced lines. */
  has_price_on_request: boolean;
  currency: string;
  disclaimer: string;
  message: string | null;
  whatsapp_url: string | null;
};

/* ------------------------------------------------------------------ orders */

export type OrderStatus = "pending" | "confirmed" | "packed" | "out_for_delivery" | "delivered" | "cancelled" | "returned";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

/** The happy path, used to draw progress steps. */
export const ORDER_FLOW: OrderStatus[] = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"];

export type CheckoutCustomer = {
  customer_name: string;
  phone: string;
  whatsapp_number: string;
  email: string;
  address: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  notes: string;
};

export type PlacedOrder = {
  order_number: string;
  status: OrderStatus;
  total: number;
  has_price_on_request: boolean;
  message: string;
  whatsapp_url: string;
  quote: Quote;
};

export type TrackedOrder = {
  order_number: string;
  status: OrderStatus;
  status_label: string;
  placed_at: string;
  expected_delivery_date: string | null;
  delivered_at: string | null;
  cancellation_reason: string | null;
  customer_name: string;
  city: string;
  pincode: string;
  items: { product_name: string; sku: string | null; image_url: string | null; colour: string | null; size: string | null; quantity: number; unit_price: string | null; line_total: string }[];
  subtotal: number;
  delivery_charge: number;
  discount: number;
  total: number;
  has_price_on_request: boolean;
  payment_status: string;
  delivery: { person_name: string | null; person_phone: string | null; courier_name: string | null; tracking_number: string | null } | null;
  timeline: { status: OrderStatus; label: string; at: string }[];
};
