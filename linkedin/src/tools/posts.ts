import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getMyProfile, buildPersonUrn, createUGCPost, buildPostUrl, registerVideoUpload, uploadVideoFile } from "../services/linkedin.js";
import { POST_VISIBILITY, MEDIA_CATEGORY } from "../constants.js";

const VisibilitySchema = z.enum(["PUBLIC", "CONNECTIONS"])
  .default("PUBLIC")
  .describe("Visibilidad del post: PUBLIC (todos en LinkedIn) o CONNECTIONS (solo conexiones)");

export function registerPostTools(server: McpServer): void {

  // ─── 1. POST DE TEXTO ────────────────────────────────────────────────────
  server.registerTool(
    "linkedin_create_text_post",
    {
      title: "Crear Post de Texto en LinkedIn",
      description: `Publica un post de texto en LinkedIn en nombre del usuario autenticado.

Ideal para publicar actualizaciones, reflexiones, novedades o artículos cortos.
El post se publica inmediatamente con lifecycleState PUBLISHED.

Args:
  - text (string): Contenido del post. Máximo 3000 caracteres. Soporta saltos de línea.
  - visibility ('PUBLIC' | 'CONNECTIONS'): Visibilidad del post (default: 'PUBLIC')

Returns:
  {
    "success": boolean,
    "postId": string,       // URN del post creado
    "postUrl": string,      // URL directa al post en LinkedIn
    "message": string       // Confirmación o descripción del error
  }

Ejemplos de uso:
  - "Publica este texto en mi LinkedIn" → llama a esta herramienta
  - "Comparte esta reflexión en LinkedIn" → llama a esta herramienta

Notas:
  - Requiere scope w_member_social en tu app de LinkedIn
  - Rate limit: 150 requests/día por miembro`,
      inputSchema: {
        text: z.string()
          .min(1, "El texto no puede estar vacío")
          .max(3000, "El texto no puede superar los 3000 caracteres")
          .describe("Contenido del post de LinkedIn"),
        visibility: VisibilitySchema,
        dryRun: z.boolean()
          .default(true)
          .describe("Si true (por defecto), muestra un preview sin publicar. Usa dryRun: false para publicar realmente."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ text, visibility, dryRun }) => {
      if (dryRun) {
        return {
          content: [{ type: "text", text: `📋 **Preview del post** (no publicado)\n\n${text}\n\n**Visibilidad:** ${visibility ?? "PUBLIC"}\n\n⚠️ Para publicar realmente, llama de nuevo con \`dryRun: false\`.` }],
          structuredContent: { success: false, dryRun: true, preview: text },
        };
      }
      try {
        const profile = await getMyProfile();
        const author = buildPersonUrn(profile.sub);

        const body = {
          author,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text },
              shareMediaCategory: MEDIA_CATEGORY.NONE,
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": visibility ?? POST_VISIBILITY.PUBLIC,
          },
        };

        const postUrn = await createUGCPost(body);
        const postUrl = buildPostUrl(postUrn);

        const result = {
          success: true,
          postId: postUrn,
          postUrl,
          message: `Post publicado correctamente en LinkedIn.`,
        };

        return {
          content: [{
            type: "text",
            text: `✅ Post publicado correctamente\n\n**URL:** ${postUrl}\n**ID:** \`${postUrn}\``,
          }],
          structuredContent: result,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `❌ Error al publicar: ${msg}` }],
          structuredContent: { success: false, message: msg },
        };
      }
    }
  );

  // ─── 2. POST CON ARTÍCULO / URL ──────────────────────────────────────────
  server.registerTool(
    "linkedin_create_article_post",
    {
      title: "Crear Post con Artículo/URL en LinkedIn",
      description: `Publica un post en LinkedIn compartiendo una URL con un comentario de tu autoría.

Útil para compartir artículos, cursos, recursos o cualquier enlace web.
LinkedIn automáticamente genera la vista previa de la URL (Open Graph).

Args:
  - text (string): Tu comentario o reflexión sobre el artículo. Máximo 3000 caracteres.
  - url (string): URL del artículo o recurso a compartir.
  - title (string, opcional): Título personalizado para el artículo compartido.
  - description (string, opcional): Descripción breve del artículo compartido.
  - visibility ('PUBLIC' | 'CONNECTIONS'): Visibilidad del post (default: 'PUBLIC')

Returns:
  {
    "success": boolean,
    "postId": string,       // URN del post creado
    "postUrl": string,      // URL directa al post en LinkedIn
    "message": string
  }

Ejemplos de uso:
  - "Comparte este artículo en mi LinkedIn con el comentario X" → esta herramienta
  - "Publica el link de mi nuevo curso en LinkedIn" → esta herramienta`,
      inputSchema: {
        text: z.string()
          .min(1, "El texto no puede estar vacío")
          .max(3000, "El texto no puede superar los 3000 caracteres")
          .describe("Comentario o reflexión que acompaña al artículo"),
        url: z.string()
          .url("Debe ser una URL válida")
          .describe("URL del artículo o recurso a compartir"),
        title: z.string()
          .max(200)
          .optional()
          .describe("Título personalizado del artículo (opcional)"),
        description: z.string()
          .max(500)
          .optional()
          .describe("Descripción breve del artículo (opcional)"),
        visibility: VisibilitySchema,
        dryRun: z.boolean()
          .default(true)
          .describe("Si true (por defecto), muestra un preview sin publicar. Usa dryRun: false para publicar realmente."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ text, url, title, description, visibility, dryRun }) => {
      if (dryRun) {
        return {
          content: [{ type: "text", text: `📋 **Preview del post** (no publicado)\n\n${text}\n\n**URL compartida:** ${url}\n**Visibilidad:** ${visibility ?? "PUBLIC"}\n\n⚠️ Para publicar realmente, llama de nuevo con \`dryRun: false\`.` }],
          structuredContent: { success: false, dryRun: true, preview: text, url },
        };
      }
      try {
        const profile = await getMyProfile();
        const author = buildPersonUrn(profile.sub);

        const mediaItem: Record<string, unknown> = {
          status: "READY",
          originalUrl: url,
        };
        if (title) mediaItem.title = { text: title };
        if (description) mediaItem.description = { text: description };

        const body = {
          author,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text },
              shareMediaCategory: MEDIA_CATEGORY.ARTICLE,
              media: [mediaItem],
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": visibility ?? POST_VISIBILITY.PUBLIC,
          },
        };

        const postUrn = await createUGCPost(body);
        const postUrl = buildPostUrl(postUrn);

        const result = {
          success: true,
          postId: postUrn,
          postUrl,
          message: `Post con artículo publicado correctamente.`,
        };

        return {
          content: [{
            type: "text",
            text: `✅ Post con artículo publicado correctamente\n\n**URL del post:** ${postUrl}\n**Artículo compartido:** ${url}\n**ID:** \`${postUrn}\``,
          }],
          structuredContent: result,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `❌ Error al publicar: ${msg}` }],
          structuredContent: { success: false, message: msg },
        };
      }
    }
  );

  // ─── 3. POST CON VÍDEO ───────────────────────────────────────────────────
  server.registerTool(
    "linkedin_create_video_post",
    {
      title: "Crear Post con Vídeo en LinkedIn",
      description: `Publica un post en LinkedIn subiendo un vídeo local junto con un comentario.

El proceso sigue estos pasos automáticamente:
  1. Registra el vídeo en LinkedIn (obtiene URL de subida y URN del asset)
  2. Sube el binario del vídeo a LinkedIn
  3. Crea el post UGC con el vídeo adjunto

Formatos soportados: .mp4, .mov, .avi, .wmv, .mkv (recomendado: .mp4 / .mov)

Args:
  - filePath (string): Ruta absoluta al archivo de vídeo en el sistema local.
  - text (string): Texto del post. Máximo 3000 caracteres.
  - title (string, opcional): Título descriptivo del vídeo.
  - visibility ('PUBLIC' | 'CONNECTIONS'): Visibilidad del post (default: 'PUBLIC')

Returns:
  {
    "success": boolean,
    "postId": string,
    "postUrl": string,
    "message": string
  }

Ejemplos de uso:
  - "Sube este vídeo a LinkedIn con el texto X" → esta herramienta
  - "Publica el vídeo del escritorio en LinkedIn" → esta herramienta`,
      inputSchema: {
        filePath: z.string()
          .min(1, "La ruta al vídeo no puede estar vacía")
          .describe("Ruta absoluta al archivo de vídeo local (ej: /Users/usuario/Desktop/video.mov)"),
        text: z.string()
          .min(1, "El texto no puede estar vacío")
          .max(3000, "El texto no puede superar los 3000 caracteres")
          .describe("Texto del post que acompaña al vídeo"),
        title: z.string()
          .max(200)
          .optional()
          .describe("Título descriptivo del vídeo (opcional)"),
        visibility: VisibilitySchema,
        dryRun: z.boolean()
          .default(true)
          .describe("Si true (por defecto), muestra un preview sin publicar. Usa dryRun: false para publicar realmente."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ filePath, text, title, visibility, dryRun }) => {
      if (dryRun) {
        return {
          content: [{ type: "text", text: `📋 **Preview del post con vídeo** (no publicado)\n\n${text}\n\n**Vídeo:** ${filePath}\n**Visibilidad:** ${visibility ?? "PUBLIC"}\n\n⚠️ Para publicar realmente, llama de nuevo con \`dryRun: false\`.` }],
          structuredContent: { success: false, dryRun: true, preview: text, filePath },
        };
      }
      try {
        const profile = await getMyProfile();
        const author = buildPersonUrn(profile.sub);

        // 1. Registrar el vídeo en LinkedIn
        const uploadResult = await registerVideoUpload(author);
        const uploadUrl = uploadResult.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
        const asset = uploadResult.asset;

        // 2. Subir el archivo de vídeo
        await uploadVideoFile(uploadUrl, filePath);

        // 3. Crear el post UGC con el vídeo
        const mediaItem: Record<string, unknown> = {
          status: "READY",
          media: asset,
        };
        if (title) mediaItem.title = { text: title };

        const body = {
          author,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text },
              shareMediaCategory: MEDIA_CATEGORY.VIDEO,
              media: [mediaItem],
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": visibility ?? POST_VISIBILITY.PUBLIC,
          },
        };

        const postUrn = await createUGCPost(body);
        const postUrl = buildPostUrl(postUrn);

        const result = {
          success: true,
          postId: postUrn,
          postUrl,
          message: `Post con vídeo publicado correctamente.`,
        };

        return {
          content: [{
            type: "text",
            text: `✅ Post con vídeo publicado correctamente\n\n**URL del post:** ${postUrl}\n**Vídeo:** ${filePath}\n**ID:** \`${postUrn}\``,
          }],
          structuredContent: result,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `❌ Error al publicar el vídeo: ${msg}` }],
          structuredContent: { success: false, message: msg },
        };
      }
    }
  );
}
