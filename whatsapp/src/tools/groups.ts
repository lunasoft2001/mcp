import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { whatsappClient } from "../whatsapp/client.js";
import { logger } from "../utils/logger.js";

/** Registra todas las tools de gestión de grupos en el servidor MCP. */
export function registerGroupTools(server: McpServer): void {

  // ─── list_whatsapp_groups ──────────────────────────────────────────────────
  server.registerTool(
    "list_whatsapp_groups",
    {
      title: "Listar grupos de WhatsApp",
      description: `Lista todos los grupos de WhatsApp a los que pertenece el número autenticado.
Devuelve el nombre, el ID y el número de participantes de cada grupo.
El ID (termina en @g.us) es necesario para otras operaciones como list_group_members o send_group_message.

Error si WhatsApp no está autenticado.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async () => {
      try {
        const groups = await whatsappClient.getGroups();
        return {
          content: [{ type: "text", text: JSON.stringify(groups, null, 2) }],
        };
      } catch (err) {
        logger.error("list_whatsapp_groups error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── find_whatsapp_group ───────────────────────────────────────────────────
  server.registerTool(
    "find_whatsapp_group",
    {
      title: "Buscar grupo de WhatsApp por nombre",
      description: `Busca grupos cuyo nombre contenga el texto indicado (insensible a mayúsculas).
Devuelve todos los grupos coincidentes con nombre, ID y número de participantes.

Args:
  - groupName: texto a buscar en el nombre del grupo

Error si WhatsApp no está autenticado.`,
      inputSchema: {
        groupName: z.string().min(1).describe("Texto a buscar en el nombre del grupo"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ groupName }) => {
      try {
        const groups = await whatsappClient.getGroups();
        const q = groupName.toLowerCase();
        const found = groups.filter((g) => g.name.toLowerCase().includes(q));
        if (found.length === 0) {
          return { content: [{ type: "text", text: `No se encontraron grupos con "${groupName}".` }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(found, null, 2) }] };
      } catch (err) {
        logger.error("find_whatsapp_group error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── list_group_members ────────────────────────────────────────────────────
  server.registerTool(
    "list_group_members",
    {
      title: "Listar miembros de un grupo",
      description: `Devuelve la lista de participantes de un grupo de WhatsApp.
Para cada miembro: ID, número de teléfono e indicador de admin.
Nota: whatsapp-web.js no expone el nombre del contacto directamente en la lista de participantes;
usa find_whatsapp_contact con el número para buscar el nombre si es necesario.

Args:
  - groupId: ID del grupo (termina en @g.us). Obtener con list_whatsapp_groups.

Error si el grupo no existe o WhatsApp no está autenticado.`,
      inputSchema: {
        groupId: z.string().endsWith("@g.us").describe("ID del grupo (ejemplo: 120363XXXXXX@g.us)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ groupId }) => {
      try {
        const members = await whatsappClient.getGroupMembers(groupId);
        return { content: [{ type: "text", text: JSON.stringify(members, null, 2) }] };
      } catch (err) {
        logger.error("list_group_members error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── add_group_participant ─────────────────────────────────────────────────
  server.registerTool(
    "add_group_participant",
    {
      title: "Añadir participante a un grupo",
      description: `Añade un número de teléfono a un grupo de WhatsApp.
Requiere que el número autenticado sea administrador del grupo.

Si el contacto tiene privacidad activada, WhatsApp no permite añadirlo directamente.
En ese caso, la respuesta incluirá un enlace de invitación (si está disponible).

Args:
  - groupId: ID del grupo (termina en @g.us)
  - phoneNumber: número de teléfono. Formatos aceptados: +43600111222, 43600111222, 600111222
    El código de país por defecto se configura con DEFAULT_COUNTRY_CODE en .env.

Error si no eres admin, el grupo no existe o WhatsApp no está autenticado.`,
      inputSchema: {
        groupId: z.string().endsWith("@g.us").describe("ID del grupo"),
        phoneNumber: z.string().min(6).describe("Número de teléfono del nuevo participante"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ groupId, phoneNumber }) => {
      try {
        const result = await whatsappClient.addParticipant(groupId, phoneNumber);
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        logger.error("add_group_participant error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── remove_group_participant ──────────────────────────────────────────────
  server.registerTool(
    "remove_group_participant",
    {
      title: "Eliminar participante de un grupo",
      description: `Elimina un número de teléfono de un grupo de WhatsApp.
OPERACIÓN DESTRUCTIVA: el participante perderá acceso al grupo inmediatamente.
Requiere que el número autenticado sea administrador del grupo.

Args:
  - groupId: ID del grupo (termina en @g.us)
  - phoneNumber: número de teléfono del participante a eliminar

Error si no eres admin, el grupo no existe o WhatsApp no está autenticado.`,
      inputSchema: {
        groupId: z.string().endsWith("@g.us").describe("ID del grupo"),
        phoneNumber: z.string().min(6).describe("Número de teléfono del participante a eliminar"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ groupId, phoneNumber }) => {
      try {
        const result = await whatsappClient.removeParticipant(groupId, phoneNumber);
        return { content: [{ type: "text", text: result }] };
      } catch (err) {
        logger.error("remove_group_participant error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );

  // ─── get_group_invite_link ─────────────────────────────────────────────────
  server.registerTool(
    "get_group_invite_link",
    {
      title: "Obtener enlace de invitación del grupo",
      description: `Devuelve el enlace de invitación (https://chat.whatsapp.com/...) de un grupo.
Requiere que el número autenticado sea administrador del grupo.
Si no eres admin, WhatsApp devolverá un error de permisos.

Args:
  - groupId: ID del grupo (termina en @g.us)

Error si no eres admin, el grupo no existe o WhatsApp no está autenticado.`,
      inputSchema: {
        groupId: z.string().endsWith("@g.us").describe("ID del grupo"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    async ({ groupId }) => {
      try {
        const link = await whatsappClient.getInviteLink(groupId);
        return { content: [{ type: "text", text: link }] };
      } catch (err) {
        logger.error("get_group_invite_link error", { err: String(err) });
        return { content: [{ type: "text", text: `Error: ${String(err)}` }], isError: true };
      }
    }
  );
}
