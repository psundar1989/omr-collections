export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
export const SERVER_API_URL = (process.env.API_INTERNAL_URL || PUBLIC_API_URL).replace(/\/$/, "");
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
export const MAX_QTY = 50;
