/**
 * whatsapp-mcp-server — Entry point
 *
 * Arranca el cliente de WhatsApp (en paralelo con el servidor MCP)
 * y conecta el servidor MCP al transporte stdio.
 *
 * El QR de autenticación aparece en stderr para no contaminar el canal
 * stdio que usa el protocolo MCP.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { whatsappClient } from "./whatsapp/client.js";
import { createMcpServer } from "./mcp/server.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Arrancando whatsapp-mcp-server...");

  // Iniciar WhatsApp en paralelo — no bloqueamos el servidor MCP.
  // Las tools esperarán internamente a que esté listo via waitUntilReady().
  whatsappClient.initialize().catch((err) => {
    logger.error("Error crítico inicializando WhatsApp.", { err: String(err) });
    // No cerramos el proceso: el servidor MCP sigue en pie y responderá
    // con mensajes de error claros desde healthcheck_whatsapp.
  });

  const server = createMcpServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info("Servidor MCP conectado via stdio. Esperando mensajes del cliente.");
}

main().catch((err) => {
  logger.error("Error fatal en arranque.", { err: String(err) });
  process.exit(1);
});
