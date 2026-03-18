#!/usr/bin/env node
/**
 * OAuth 2.0 Flow para LinkedIn
 * 
 * Uso: npm run auth
 * 
 * Este script abre tu navegador para autenticarte con LinkedIn,
 * recibe el código de autorización y obtiene el access token.
 * Escribe el token en el archivo .env automáticamente.
 */

import http from "http";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

config({ path: resolve(ROOT, ".env") });

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000/callback";
const PORT = 3000;

// Scopes que necesitamos:
// - openid + profile: para leer datos del perfil (nombre, sub)
// - email: email del usuario (opcional)
// - w_member_social: para crear posts
const SCOPES = ["openid", "profile", "email", "w_member_social"].join(" ");

function usage(): void {
  console.log(`
╔════════════════════════════════════════════════════╗
║         LinkedIn MCP - OAuth Setup                ║
╚════════════════════════════════════════════════════╝

Para obtener tu access token de LinkedIn necesitas:

1. Ir a https://www.linkedin.com/developers/apps
2. Crear una nueva app (o usar una existente)
3. En la pestaña "Products", añadir:
   - "Sign in with LinkedIn using OpenID Connect"
   - "Share on LinkedIn"
4. En "Auth" → Redirect URLs, añadir:
   http://localhost:3000/callback
5. Copiar tu Client ID y Client Secret
6. Crear o editar el archivo .env en la raíz del proyecto:
   LINKEDIN_CLIENT_ID=tu_client_id
   LINKEDIN_CLIENT_SECRET=tu_client_secret
7. Volver a ejecutar: npm run auth
  `);
}

if (!CLIENT_ID || !CLIENT_SECRET) {
  usage();
  console.error("❌ Faltan LINKEDIN_CLIENT_ID y/o LINKEDIN_CLIENT_SECRET en .env");
  process.exit(1);
}

// Genera el state anti-CSRF
const state = Math.random().toString(36).substring(2, 15);

const authUrl =
  `https://www.linkedin.com/oauth/v2/authorization` +
  `?response_type=code` +
  `&client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPES)}` +
  `&state=${state}`;

console.log("\n🔐 Iniciando flujo OAuth de LinkedIn...\n");
console.log(`Abriendo el navegador para autenticarte...`);
console.log(`Si no se abre automáticamente, ve a:\n${authUrl}\n`);

// Abrir navegador en macOS / Linux / Windows
try {
  execSync(`open "${authUrl}"`);
} catch {
  try { execSync(`xdg-open "${authUrl}"`); } catch { /* Windows */ }
}

// Servidor local para recibir el callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "", `http://localhost:${PORT}`);

  if (url.pathname !== "/callback") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>❌ Error de OAuth: ${error}</h1><p>${url.searchParams.get("error_description") ?? ""}</p>`);
    server.close();
    process.exit(1);
  }

  if (!code || returnedState !== state) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>❌ Error: código inválido o state no coincide.</h1>");
    server.close();
    process.exit(1);
  }

  // Intercambiar código por access token
  console.log("✅ Código de autorización recibido. Obteniendo access token...");
  try {
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID!,
        client_secret: CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errBody = await tokenResponse.text();
      throw new Error(`LinkedIn devolvió ${tokenResponse.status}: ${errBody}`);
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
      scope: string;
    };

    // Calcular fecha de expiración
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    console.log(`\n✅ Access token obtenido correctamente`);
    console.log(`   Scopes: ${tokenData.scope}`);
    console.log(`   Expira: ${expiresAt.toLocaleString()}\n`);

    // Guardar en .env
    const envPath = resolve(ROOT, ".env");
    let envContent = existsSync(envPath) ? readFileSync(envPath, "utf-8") : "";

    const setEnvVar = (content: string, key: string, value: string): string => {
      const regex = new RegExp(`^${key}=.*$`, "m");
      return regex.test(content)
        ? content.replace(regex, `${key}=${value}`)
        : content + (content.endsWith("\n") ? "" : "\n") + `${key}=${value}\n`;
    };

    envContent = setEnvVar(envContent, "LINKEDIN_ACCESS_TOKEN", tokenData.access_token);
    envContent = setEnvVar(envContent, "LINKEDIN_TOKEN_EXPIRES_AT", expiresAt.toISOString());
    if (tokenData.refresh_token) {
      envContent = setEnvVar(envContent, "LINKEDIN_REFRESH_TOKEN", tokenData.refresh_token);
    }

    writeFileSync(envPath, envContent, "utf-8");
    console.log(`💾 Token guardado en ${envPath}`);

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px">
        <h1 style="color:green">✅ Autenticación completada</h1>
        <p>Tu access token ha sido guardado en <code>.env</code></p>
        <p>Expira el: <strong>${expiresAt.toLocaleString()}</strong></p>
        <p>Puedes cerrar esta ventana y volver a Claude.</p>
      </body></html>
    `);

    server.close();
    console.log("\n🎉 Todo listo. Ahora puedes usar el MCP de LinkedIn en Claude.\n");
    process.exit(0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.writeHead(500, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>❌ Error al obtener token</h1><pre>${msg}</pre>`);
    console.error(`\n❌ Error al obtener token: ${msg}\n`);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Servidor de callback escuchando en http://localhost:${PORT}`);
});
