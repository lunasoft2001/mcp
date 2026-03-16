import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGroupTools } from "../tools/groups.js";
import { registerContactTools } from "../tools/contacts.js";
import { registerMessageTools } from "../tools/messages.js";
import { logger } from "../utils/logger.js";

/**
 * Crea y configura el servidor MCP con todas las tools registradas.
 * El transporte (stdio) se conecta en index.ts.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "whatsapp-mcp-server",
    version: "1.0.0",
  });

  registerGroupTools(server);
  registerContactTools(server);
  registerMessageTools(server);

  logger.info("Servidor MCP configurado con 10 tools.");
  return server;
}
