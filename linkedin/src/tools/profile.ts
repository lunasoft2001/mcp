import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getMyProfile, buildPersonUrn } from "../services/linkedin.js";

export function registerProfileTools(server: McpServer): void {
  server.registerTool(
    "linkedin_get_my_profile",
    {
      title: "Obtener Mi Perfil de LinkedIn",
      description: `Obtiene los datos del perfil del usuario autenticado en LinkedIn.

Devuelve nombre completo, headline, email y foto de perfil.
No requiere parámetros.

Returns:
  {
    "personUrn": string,     // URN de la persona (necesario para crear posts)
    "name": string,          // Nombre completo
    "given_name": string,    // Nombre
    "family_name": string,   // Apellido
    "headline": string,      // Titular profesional (si disponible)
    "email": string,         // Email principal (si disponible)
    "picture": string        // URL de la foto de perfil (si disponible)
  }

Errores comunes:
  - Error 401: Token expirado → ejecuta 'npm run auth'
  - LINKEDIN_ACCESS_TOKEN no configurado → revisa el .env`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const profile = await getMyProfile();
        const personUrn = buildPersonUrn(profile.sub);

        const result = {
          personUrn,
          name: profile.name,
          given_name: profile.given_name,
          family_name: profile.family_name,
          ...(profile.headline ? { headline: profile.headline } : {}),
          ...(profile.email ? { email: profile.email } : {}),
          ...(profile.picture ? { picture: profile.picture } : {}),
        };

        const lines = [
          "# Perfil de LinkedIn",
          "",
          `**Nombre:** ${result.name}`,
          ...(result.headline ? [`**Headline:** ${result.headline}`] : []),
          ...(result.email ? [`**Email:** ${result.email}`] : []),
          `**Person URN:** \`${result.personUrn}\``,
        ];

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: result,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { content: [{ type: "text", text: `Error: ${msg}` }] };
      }
    }
  );

  // ─── HEALTHCHECK ─────────────────────────────────────────────────────────
  server.registerTool(
    "linkedin_healthcheck",
    {
      title: "LinkedIn MCP — Health Check",
      description: "Verifica que el MCP de LinkedIn está configurado y si el token está presente y su fecha de expiración. Úsalo antes de cualquier operación para confirmar que el servidor está listo.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const token = process.env.LINKEDIN_ACCESS_TOKEN;
      const expiresAt = process.env.LINKEDIN_TOKEN_EXPIRES_AT;
      const expired = expiresAt ? new Date(expiresAt) < new Date() : null;

      const tokenStatus = token ? "✅ presente" : "❌ falta (configura LINKEDIN_ACCESS_TOKEN en .env)";
      const expiryStatus = expiresAt
        ? `${expiresAt}${expired ? " ⚠️ EXPIRADO — ejecuta npm run auth" : " ✅ vigente"}`
        : "desconocida";

      const lines = [
        "# LinkedIn MCP — Health Check",
        "",
        `**Servidor:** linkedin-mcp-server v1.0.0`,
        `**Token:** ${tokenStatus}`,
        `**Expiración:** ${expiryStatus}`,
        "",
        token && !expired ? "✅ Listo para operar." : "❌ No operativo — revisa configuración.",
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
          ready: !!(token && !expired),
          tokenPresent: !!token,
          expired: expired ?? null,
          expiresAt: expiresAt ?? null,
        },
      };
    }
  );
}
