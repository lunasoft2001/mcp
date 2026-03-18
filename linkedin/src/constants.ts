// Constantes de la API de LinkedIn
export const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
export const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

// Rate limits oficiales LinkedIn
export const RATE_LIMIT_MEMBER = 150;    // requests por día por miembro
export const RATE_LIMIT_APP = 100_000;   // requests por día por app

// Visibilidad de posts
export const POST_VISIBILITY = {
  PUBLIC: "PUBLIC",
  CONNECTIONS: "CONNECTIONS",
} as const;

// Categorías de media en posts
export const MEDIA_CATEGORY = {
  NONE: "NONE",
  ARTICLE: "ARTICLE",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
} as const;
