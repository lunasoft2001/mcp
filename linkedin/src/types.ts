// Tipos de la API de LinkedIn

export interface LinkedInProfile {
  sub: string;           // Person ID (sin prefijo URN)
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  locale?: { country: string; language: string };
  headline?: string;
}

export interface UGCPostResponse {
  id: string;  // URN del post creado: urn:li:ugcPost:{id}
}

export interface LinkedInApiError {
  status: number;
  code?: string;
  message: string;
  serviceErrorCode?: number;
}

// Resultado de creación de post
export interface CreatePostResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  message: string;
}

// Resultado del registro de upload de vídeo
export interface VideoUploadRegisterResult {
  uploadMechanism: {
    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
      uploadUrl: string;
      headers: Record<string, string>;
    };
  };
  mediaArtifact: string;
  asset: string; // urn:li:digitalmediaAsset:xxx
}
