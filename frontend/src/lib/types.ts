export type CategorySection = "beads" | "charms";

export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  /** Homepage collection: "beads" (Trendset Beads), "charms" (Signature Charms) or null (Shop by Category). */
  section: CategorySection | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  products_count?: number;
};

export type ProductImage = { id: number; url: string; alt_text: string | null; is_primary: boolean; sort_order: number };

export type Variant = {
  id: number;
  colour: string | null;
  size: string | null;
  sku: string | null;
  additional_price: number;
  price: number;
  original_price: number | null;
  in_stock: boolean;
  stock_quantity: number | null;
  is_active?: boolean;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  sku: string;
  short_description: string | null;
  category: { id: number; name: string; slug: string } | null;
  image_url: string | null;
  price: number;
  original_price: number | null;
  discount_percentage: number | null;
  currency: string;
  offer: { id: number; name: string; ends_at: string | null } | null;
  is_featured: boolean;
  is_best_seller: boolean;
  is_new_arrival: boolean;
  in_stock: boolean;
  stock_quantity: number | null;
  colours: string[];
  sizes: string[];
  has_variants: boolean | null;
  // detail
  description?: string | null;
  material?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  images?: ProductImage[];
  variants?: Variant[];
};

export type AdminProduct = Product & {
  category_id: number | null;
  regular_price: number;
  sale_price: number | null;
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
};

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
  line_total: number;
  available_quantity: number | null;
  error: string | null;
};

export type Quote = {
  valid: boolean;
  items: QuoteLine[];
  total: number;
  total_formatted: string;
  currency: string;
  disclaimer: string;
  message: string | null;
  whatsapp_url: string | null;
};
