import { readFileSync } from "fs";
import { LINKEDIN_API_BASE, LINKEDIN_USERINFO_URL } from "../constants.js";
import type { LinkedInProfile, LinkedInApiError, VideoUploadRegisterResult } from "../types.js";

function getAccessToken(): string {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "LINKEDIN_ACCESS_TOKEN no está configurado. " +
      "Ejecuta 'npm run auth' para obtener tu token de acceso."
    );
  }
  return token;
}

function buildHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAccessToken()}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

function formatApiError(status: number, body: unknown): string {
  const err = body as Partial<LinkedInApiError>;
  const msg = err?.message ?? JSON.stringify(body);
  if (status === 401) return `Error 401: Token de acceso inválido o expirado. Ejecuta 'npm run auth' para renovarlo.`;
  if (status === 403) return `Error 403: Permiso denegado. Verifica que tu app tenga el scope 'w_member_social'.`;
  if (status === 429) return `Error 429: Rate limit alcanzado (${err?.serviceErrorCode ?? ""}). Espera antes de reintentar.`;
  return `Error ${status}: ${msg}`;
}

// GET /v2/userinfo — requiere scope: profile
export async function getMyProfile(): Promise<LinkedInProfile> {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(formatApiError(response.status, body));
  }

  return response.json() as Promise<LinkedInProfile>;
}

// POST /v2/ugcPosts — requiere scope: w_member_social
export async function createUGCPost(body: Record<string, unknown>): Promise<string> {
  const response = await fetch(`${LINKEDIN_API_BASE}/ugcPosts`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(formatApiError(response.status, errBody));
  }

  // El ID del post viene en el header X-RestLi-Id
  const postUrn = response.headers.get("X-RestLi-Id") ?? "";
  return postUrn;
}

// Construye el Person URN a partir del sub obtenido en userinfo
export function buildPersonUrn(sub: string): string {
  return `urn:li:person:${sub}`;
}

// Extrae el numeric ID del URN para construir la URL del post
export function buildPostUrl(postUrn: string): string {
  // postUrn: urn:li:ugcPost:7xxxxxxxxxxxxxxxxxx
  const id = postUrn.split(":").pop() ?? postUrn;
  return `https://www.linkedin.com/feed/update/${postUrn}/`;
}

// POST /v2/assets?action=registerUpload — Registra un vídeo para subida
export async function registerVideoUpload(personUrn: string): Promise<VideoUploadRegisterResult> {
  const body = {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-video"],
      owner: personUrn,
      serviceRelationships: [
        {
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent",
        },
      ],
    },
  };

  const response = await fetch(`${LINKEDIN_API_BASE}/assets?action=registerUpload`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(formatApiError(response.status, errBody));
  }

  const data = await response.json() as { value: VideoUploadRegisterResult };
  return data.value;
}

// PUT al uploadUrl — Sube el binario del vídeo
export async function uploadVideoFile(uploadUrl: string, filePath: string): Promise<void> {
  const fileBuffer = readFileSync(filePath);

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "Content-Type": "application/octet-stream",
    },
    body: fileBuffer,
  });

  if (!response.ok) {
    throw new Error(`Error al subir el vídeo: HTTP ${response.status}`);
  }
}
