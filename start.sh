#!/bin/sh
# Mata cualquier instancia anterior del servidor antes de arrancar una nueva.
# Evita el problema de instancias duplicadas al recargar VS Code.
pkill -f "whatsapp-mcp-server/whatsapp/dist/index.js" 2>/dev/null
sleep 0.5

# Forzar la misma sesión de WhatsApp siempre, sin depender del CWD del proceso MCP.
export DEFAULT_COUNTRY_CODE="43"
export LOG_LEVEL="info"
export WA_SESSION_PATH="/Users/lunasoft/Documents/whatsapp-mcp-server/.wwebjs_auth"
export WA_SESSION_NAME="mcp-session"

exec node /Users/lunasoft/Documents/whatsapp-mcp-server/whatsapp/dist/index.js
