import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whatsappClient } from "../whatsapp/client.js";
import { logger } from "../utils/logger.js";
import type { HealthStatus } from "../types/index.js";

/** Registra las tools de mensajes y healthcheck en el servidor MCP. */
export function registerMessageTools(server: McpServer): void {

  // ─── send_group_message ────────────────────────────────────────────────────
  server.registerTool(
    "send_group_message",
    {
      title: "Enviar mensaje a un grupo de WhatsApp",
      description: `Envía un mensaje de texto a un grupo de WhatsApp.
El mensaje se envía desde el número autenticado y es visible para todos los miembros.

Args:
  - groupId: ID del grupo (termina en @g.us). Obtener con list_whatsapp_groups.
  - message: texto del mensaje a enviar

Error si el grupo no existe o WhatsApp no está autenticado.`,
      inputSchema: {
        groupId: z.string().endsWith("@g.us").describe("ID del grupo de destino"),
        message: z.string().min(1).max(4096).describe("Texto del mensaje"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ groupId, message }) => {
      try {
        await whatsappClient.sendMessage(groupId, message);
        return { content: [{ type: "text", text: `Mensaje enviado al grupo ${groupId}.` }] };
      } catch (err) {
        logger.error("send_group_message error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── send_direct_message ───────────────────────────────────────────────────
  server.registerTool(
    "send_direct_message",
    {
      title: "Enviar mensaje directo a un contacto",
      description: `Envía un mensaje de texto privado a un número de teléfono.
El destinatario debe tener WhatsApp activo en ese número.

Args:
  - phoneNumber: número de teléfono. Formatos aceptados: +43600111222, 43600111222, 600111222
    El código de país por defecto se configura con DEFAULT_COUNTRY_CODE en .env.
  - message: texto del mensaje a enviar

Error si el número no existe en WhatsApp o WhatsApp no está autenticado.`,
      inputSchema: {
        phoneNumber: z.string().min(6).describe("Número de teléfono del destinatario"),
        message: z.string().min(1).max(4096).describe("Texto del mensaje"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ phoneNumber, message }) => {
      try {
        await whatsappClient.sendDirectMessage(phoneNumber, message);
        return { content: [{ type: "text", text: `Mensaje enviado a ${phoneNumber}.` }] };
      } catch (err) {
        logger.error("send_direct_message error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── get_chat_messages ──────────────────────────────────────────────────────
  server.registerTool(
    "get_chat_messages",
    {
      title: "Leer mensajes de un chat o grupo",
      description: `Devuelve los últimos mensajes de un chat (grupo o conversación directa).

Args:
  - chatId: ID del chat. Para grupos termina en @g.us, para contactos en @c.us.
            Obtener con list_whatsapp_groups o find_whatsapp_contact.
  - limit: número de mensajes a recuperar (por defecto 20, máximo 100).

Cada mensaje incluye: id, from (número remitente), body (texto), timestamp (unix),
isMe (true si lo envié yo), type (chat, image, video, etc.).`,
      inputSchema: {
        chatId: z.string().describe("ID del chat (termina en @g.us o @c.us)"),
        limit: z.number().int().min(1).max(100).default(20).describe("Número de mensajes a recuperar (máx 100)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ chatId, limit }) => {
      try {
        const messages = await whatsappClient.fetchMessages(chatId, limit);
        return { content: [{ type: "text", text: JSON.stringify(messages, null, 2) }] };
      } catch (err) {
        logger.error("get_chat_messages error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── send_media_message ────────────────────────────────────────────────────
  server.registerTool(
    "send_media_message",
    {
      title: "Enviar archivo o imagen a un chat de WhatsApp",
      description: `Envía un archivo (VCF, imagen, PDF, etc.) a un grupo o contacto de WhatsApp.
El archivo se lee desde una ruta absoluta del servidor y se envía como adjunto.

Args:
  - chatId: ID del destino. Para grupos termina en @g.us, para contactos en @c.us.
            Obtener con list_whatsapp_groups o find_whatsapp_contact.
  - filePath: ruta absoluta al archivo en el servidor (ej: /home/user/contactos.vcf)
  - caption: texto opcional que acompaña al archivo

Casos de uso típicos:
  - Enviar VCF de contactos al grupo de Mitarbeiter para que los importen
  - Compartir imágenes o documentos por WhatsApp desde un script

Error si el archivo no existe, el destino no existe, o WhatsApp no está autenticado.`,
      inputSchema: {
        chatId: z.string().describe("ID del grupo o contacto destino (@g.us o @c.us)"),
        filePath: z.string().min(1).describe("Ruta absoluta al archivo a enviar"),
        caption: z.string().max(1024).optional().describe("Texto opcional que acompaña al archivo"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ chatId, filePath, caption }) => {
      try {
        await whatsappClient.sendMediaMessage(chatId, filePath, caption);
        return { content: [{ type: "text", text: `Archivo enviado a ${chatId}: ${filePath}` }] };
      } catch (err) {
        logger.error("send_media_message error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── healthcheck_whatsapp ──────────────────────────────────────────────────
  server.registerTool(
    "healthcheck_whatsapp",
    {
      title: "Estado del servidor MCP y WhatsApp",
      description: `Devuelve el estado actual del servidor MCP y del cliente de WhatsApp.
Útil para comprobar si WhatsApp está autenticado antes de lanzar otras operaciones.

Estados posibles de WhatsApp:
  - initializing: arrancando
  - qr_pending: esperando que escanees el QR
  - authenticating: QR escaneado, procesando sesión
  - ready: listo para operar
  - disconnected: desconectado
  - auth_failure: fallo de autenticación

Sin parámetros.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      const health: HealthStatus = {
        mcpServer: "ok",
        whatsapp: whatsappClient.getStatus(),
        uptime: whatsappClient.getUptimeSeconds(),
        readySince: whatsappClient.getReadySince(),
      };
      return { content: [{ type: "text", text: JSON.stringify(health, null, 2) }] };
    }
  );
}
