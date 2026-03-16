import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whatsappClient } from "../whatsapp/client.js";
import { logger } from "../utils/logger.js";

/** Registra las tools de búsqueda de contactos en el servidor MCP. */
export function registerContactTools(server: McpServer): void {

  // ─── find_whatsapp_contact ─────────────────────────────────────────────────
  server.registerTool(
    "find_whatsapp_contact",
    {
      title: "Buscar contacto de WhatsApp",
      description: `Busca contactos de WhatsApp por nombre o número de teléfono.
Solo devuelve contactos que el número autenticado tiene en su agenda o que han tenido conversación.
Devuelve hasta 50 resultados. Para búsquedas más precisas, usa el número completo.

Args:
  - search: texto a buscar (nombre, apodo o número de teléfono parcial o completo)

Devuelve para cada contacto:
  - id: ID interno de WhatsApp
  - number: número de teléfono
  - name: nombre guardado en la agenda (null si no está guardado)
  - pushname: nombre que el contacto usa en WhatsApp
  - isMyContact: si está guardado en la agenda del número autenticado

Error si WhatsApp no está autenticado.`,
      inputSchema: {
        search: z.string().min(2).describe("Nombre o número de teléfono a buscar (mínimo 2 caracteres)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ search }) => {
      try {
        const contacts = await whatsappClient.findContacts(search);
        if (contacts.length === 0) {
          return { content: [{ type: "text", text: `No se encontraron contactos para "${search}".` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(contacts, null, 2) }] };
      } catch (err) {
        logger.error("find_whatsapp_contact error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
