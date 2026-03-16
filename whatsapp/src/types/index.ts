// Tipos compartidos del servidor MCP de WhatsApp

export interface GroupInfo {
  id: string;
  name: string;
  participantCount: number;
}

export interface GroupMember {
  id: string;
  number: string;
  name: string | null;
  isAdmin: boolean;
}

export interface ContactInfo {
  id: string;
  number: string;
  name: string | null;
  pushname: string | null;
  isMyContact: boolean;
}

export interface OperationResult {
  success: boolean;
  message: string;
}

export interface ParticipantOperationResult extends OperationResult {
  phoneNumber: string;
  groupId: string;
}

// Estado del cliente WhatsApp
export type WhatsAppStatus =
  | "initializing"
  | "qr_pending"     // Esperando escaneo de QR
  | "authenticating" // QR escaneado, autenticando
  | "ready"          // Listo para operar
  | "disconnected"
  | "auth_failure";

export interface HealthStatus {
  mcpServer: "ok";
  whatsapp: WhatsAppStatus;
  uptime: number;        // Segundos desde arranque
  readySince: string | null; // ISO timestamp de cuando quedó listo
}
