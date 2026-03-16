import { Client, LocalAuth, MessageMedia } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import type { WhatsAppStatus, GroupInfo, GroupMember, ContactInfo } from "../types/index.js";

const startTime = Date.now();

class WhatsAppClient {
  private client: Client;
  private status: WhatsAppStatus = "initializing";
  private readySince: Date | null = null;

  // Promesa que se resuelve cuando el cliente está listo.
  // Las tools esperan a que se resuelva antes de operar.
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;
  private rejectReady!: (err: Error) => void;

  constructor() {
    this.readyPromise = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: config.wa.sessionName,
        dataPath: config.wa.sessionPath,
      }),
      puppeteer: {
        // Sin interfaz gráfica — necesario en servidor / terminal
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    });

    this.registerEvents();
  }

  private registerEvents(): void {
    this.client.on("qr", (qr) => {
      this.status = "qr_pending";
      logger.info("Escanea este QR con WhatsApp para autenticar:");
      // Muestra el QR en stderr — NO en stdout, que es el canal stdio del protocolo MCP
      qrcode.generate(qr, { small: true }, (qrString) => {
        process.stderr.write(qrString + "\n");
      });
    });

    this.client.on("authenticated", () => {
      this.status = "authenticating";
      logger.info("QR escaneado. Autenticando sesión...");
    });

    this.client.on("ready", () => {
      this.status = "ready";
      this.readySince = new Date();
      logger.info("WhatsApp listo.", { session: config.wa.sessionName });
      this.resolveReady();
    });

    this.client.on("auth_failure", (msg) => {
      this.status = "auth_failure";
      logger.error("Fallo de autenticación WhatsApp.", { msg });
      this.rejectReady(new Error(`Auth failure: ${msg}`));
    });

    this.client.on("disconnected", (reason) => {
      this.status = "disconnected";
      logger.warn("WhatsApp desconectado.", { reason });
    });
  }

  /** Inicializa el cliente. Llama a esto una sola vez al arrancar. */
  async initialize(): Promise<void> {
    logger.info("Inicializando cliente WhatsApp...");
    await this.client.initialize();
  }

  /**
   * Espera a que WhatsApp esté listo. Si tarda más de WA_READY_TIMEOUT_MS, rechaza.
   * Llama antes de cualquier operación que requiera conexión activa.
   */
  async waitUntilReady(): Promise<void> {
    if (this.status === "ready") return;

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`WhatsApp no está listo tras ${config.wa.readyTimeoutMs}ms. Estado actual: ${this.status}`)),
        config.wa.readyTimeoutMs
      )
    );

    await Promise.race([this.readyPromise, timeout]);
  }

  getStatus(): WhatsAppStatus {
    return this.status;
  }

  getReadySince(): string | null {
    return this.readySince?.toISOString() ?? null;
  }

  getUptimeSeconds(): number {
    return Math.floor((Date.now() - startTime) / 1000);
  }

  // ─── Grupos ─────────────────────────────────────────────────────────────────

  async getGroups(): Promise<GroupInfo[]> {
    await this.waitUntilReady();
    const chats = await this.client.getChats();
    return chats
      .filter((c) => c.isGroup)
      .map((c) => ({
        id: c.id._serialized,
        name: c.name,
        participantCount: (c as unknown as { participants?: unknown[] }).participants?.length ?? 0,
      }));
  }

  async getGroupById(groupId: string): Promise<GroupInfo & { raw: unknown }> {
    await this.waitUntilReady();
    validateGroupId(groupId);
    const chat = await this.client.getChatById(groupId);
    if (!chat.isGroup) throw new Error(`El ID ${groupId} no corresponde a un grupo.`);
    return {
      id: chat.id._serialized,
      name: chat.name,
      participantCount: (chat as unknown as { participants?: unknown[] }).participants?.length ?? 0,
      raw: chat,
    };
  }

  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    await this.waitUntilReady();
    validateGroupId(groupId);
    const chat = await this.client.getChatById(groupId);
    if (!chat.isGroup) throw new Error(`El ID ${groupId} no corresponde a un grupo.`);
    // El tipo GroupChat tiene participants
    const groupChat = chat as unknown as {
      participants: Array<{ id: { _serialized: string; user: string }; isAdmin: boolean }>;
    };
    return groupChat.participants.map((p) => ({
      id: p.id._serialized,
      number: p.id.user,
      name: null, // whatsapp-web.js no expone nombre en participants directamente
      isAdmin: p.isAdmin,
    }));
  }

  async addParticipant(groupId: string, phoneNumber: string): Promise<string> {
    await this.waitUntilReady();
    validateGroupId(groupId);
    const waId = normalizePhoneToWaId(phoneNumber);
    const chat = await this.client.getChatById(groupId);
    if (!chat.isGroup) throw new Error(`El ID ${groupId} no corresponde a un grupo.`);
    const groupChat = chat as unknown as {
      addParticipants: (ids: string[]) => Promise<Record<string, { code: number; message: string; invite_code?: string }>>;
    };
    const result = await groupChat.addParticipants([waId]);
    const entry = result[waId];
    if (!entry) return `Participante ${waId} procesado (sin respuesta detallada).`;
    if (entry.code === 200) return `Participante ${waId} añadido correctamente.`;
    if (entry.code === 403) {
      // El grupo puede requerir link de invitación
      const inviteCode = entry.invite_code;
      const extra = inviteCode ? ` Enlace de invitación: https://chat.whatsapp.com/${inviteCode}` : "";
      return `No se pudo añadir ${waId} directamente (privacidad del contacto).${extra}`;
    }
    return `Resultado para ${waId}: código ${entry.code} — ${entry.message}`;
  }

  async removeParticipant(groupId: string, phoneNumber: string): Promise<string> {
    // OPERACIÓN DESTRUCTIVA: elimina a un participante del grupo.
    // Requiere que el número autenticado sea administrador del grupo.
    await this.waitUntilReady();
    validateGroupId(groupId);
    const waId = normalizePhoneToWaId(phoneNumber);
    const chat = await this.client.getChatById(groupId);
    if (!chat.isGroup) throw new Error(`El ID ${groupId} no corresponde a un grupo.`);
    const groupChat = chat as unknown as {
      removeParticipants: (ids: string[]) => Promise<void>;
    };
    await groupChat.removeParticipants([waId]);
    return `Participante ${waId} eliminado del grupo.`;
  }

  async getInviteLink(groupId: string): Promise<string> {
    await this.waitUntilReady();
    validateGroupId(groupId);
    const chat = await this.client.getChatById(groupId);
    if (!chat.isGroup) throw new Error(`El ID ${groupId} no corresponde a un grupo.`);
    const groupChat = chat as unknown as { getInviteCode: () => Promise<string> };
    const code = await groupChat.getInviteCode();
    return `https://chat.whatsapp.com/${code}`;
  }

  // ─── Mensajes ────────────────────────────────────────────────────────────────

  async sendMessage(chatId: string, message: string): Promise<void> {
    await this.waitUntilReady();
    await this.client.sendMessage(chatId, message);
  }

  async sendDirectMessage(phoneNumber: string, message: string): Promise<void> {
    await this.waitUntilReady();
    const waId = normalizePhoneToWaId(phoneNumber);
    await this.client.sendMessage(waId, message);
  }

  async sendMediaMessage(chatId: string, filePath: string, caption?: string): Promise<void> {
    await this.waitUntilReady();
    const media = MessageMedia.fromFilePath(filePath);
    await this.client.sendMessage(chatId, media, { caption });
  }

  async fetchMessages(
    chatId: string,
    limit: number
  ): Promise<Array<{ id: string; from: string; body: string; timestamp: number; isMe: boolean; type: string }>> {
    await this.waitUntilReady();
    const chat = await this.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    return messages.map((m) => ({
      id: m.id._serialized,
      from: m.from,
      body: m.body,
      timestamp: m.timestamp,
      isMe: m.fromMe,
      type: m.type,
    }));
  }

  // ─── Contactos ───────────────────────────────────────────────────────────────

  async findContacts(search: string): Promise<ContactInfo[]> {
    await this.waitUntilReady();
    const contacts = await this.client.getContacts();
    const q = search.toLowerCase();
    return contacts
      .filter((c) => {
        const name = (c.name ?? c.pushname ?? "").toLowerCase();
        const number = c.number?.toLowerCase() ?? "";
        return name.includes(q) || number.includes(q);
      })
      .slice(0, 50) // Limitar resultados
      .map((c) => ({
        id: c.id._serialized,
        number: c.number ?? "",
        name: c.name ?? null,
        pushname: c.pushname ?? null,
        isMyContact: c.isMyContact,
      }));
  }
}

// ─── Helpers de validación ───────────────────────────────────────────────────

/** Valida que el groupId tenga formato WhatsApp válido: XXXXXXXXX@g.us */
function validateGroupId(groupId: string): void {
  if (!groupId.endsWith("@g.us")) {
    throw new Error(
      `ID de grupo inválido: "${groupId}". Debe terminar en @g.us. Usa list_whatsapp_groups para obtener IDs válidos.`
    );
  }
}

/**
 * Normaliza un número de teléfono al formato WA: {countryCode}{number}@c.us
 * Acepta: +43600111222, 43600111222, 600111222 (con DEFAULT_COUNTRY_CODE como fallback)
 */
export function normalizePhoneToWaId(phone: string): string {
  // Quitar espacios, guiones, paréntesis
  let clean = phone.replace(/[\s\-().]/g, "");

  if (!/^\+?\d+$/.test(clean)) {
    throw new Error(
      `Número de teléfono inválido: "${phone}". Solo se aceptan dígitos, espacios, guiones y un + inicial.`
    );
  }

  // Quitar + inicial si hay
  clean = clean.replace(/^\+/, "");

  // Si no empieza con el código de país configurado, añadirlo
  if (!clean.startsWith(config.defaultCountryCode)) {
    clean = `${config.defaultCountryCode}${clean}`;
  }

  return `${clean}@c.us`;
}

// Singleton exportado
export const whatsappClient = new WhatsAppClient();
