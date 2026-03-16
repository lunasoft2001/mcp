/**
 * Script de autenticación única para WhatsApp.
 * Ejecuta: node authenticate.mjs
 * 
 * Escanea el QR con el móvil → la sesión queda guardada en .wwebjs_auth/
 * Después el servidor MCP arrancará autenticado directamente, sin QR.
 */

import pkg from "whatsapp-web.js";
const { Client, LocalAuth } = pkg;
import qrcode from "qrcode-terminal";

const SESSION_PATH = "./.wwebjs_auth";
const SESSION_NAME = "mcp-session";

console.log("🔐 Iniciando autenticación de WhatsApp...\n");

const client = new Client({
  authStrategy: new LocalAuth({
    clientId: SESSION_NAME,
    dataPath: SESSION_PATH,
  }),
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.clear();
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Escanea este QR con WhatsApp:");
  console.log("  Móvil → ··· → Dispositivos vinculados → Vincular dispositivo");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  qrcode.generate(qr, { small: false });
  console.log("\n  Esperando escaneo...\n");
});

client.on("authenticated", () => {
  console.log("\n✅ QR escaneado. Guardando sesión...");
});

client.on("ready", async () => {
  const info = client.info;
  console.log(`\n✅ ¡Autenticado! Conectado como: ${info.pushname ?? "?"} (${info.wid.user})`);
  console.log("   Esperando 15 segundos para que Chrome guarde la sesión correctamente...");
  for (let i = 15; i > 0; i--) {
    process.stdout.write(`\r   Cerrando en ${i}s... `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\n\n✅ Sesión guardada en:", SESSION_PATH);
  console.log("   Ahora haz Cmd+Shift+P → Developer: Reload Window en VS Code.\n");
  await client.destroy();
  process.exit(0);
});

client.on("auth_failure", (msg) => {
  console.error("\n❌ Error de autenticación:", msg);
  process.exit(1);
});

client.initialize().catch((err) => {
  console.error("\n❌ Error iniciando cliente:", err.message);
  process.exit(1);
});
