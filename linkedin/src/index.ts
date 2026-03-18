import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "dotenv";
import { registerProfileTools } from "./tools/profile.js";
import { registerPostTools } from "./tools/posts.js";

// Carga variables de entorno desde .env (solo en desarrollo local)
config();

const server = new McpServer({
  name: "linkedin-mcp-server",
  version: "1.0.0",
});

// Registrar todas las herramientas
registerProfileTools(server);
registerPostTools(server);

// Iniciar con transporte stdio (compatible con Claude Desktop)
const transport = new StdioServerTransport();

server.connect(transport).then(() => {
  // El servidor escucha sobre stdio — no imprimir nada a stdout
  // Los logs de debug se envían a stderr para no interferir con el protocolo MCP
  process.stderr.write("LinkedIn MCP Server iniciado.\n");
}).catch((err) => {
  process.stderr.write(`Error al iniciar el servidor: ${err}\n`);
  process.exit(1);
});
