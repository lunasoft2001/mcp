#!/bin/sh
# Mata cualquier instancia anterior del servidor antes de arrancar una nueva.
# Evita el problema de instancias duplicadas al recargar VS Code.
pkill -f "whatsapp-mcp-server/whatsapp/dist/index.js" 2>/dev/null
sleep 0.5
exec node /Users/lunasoft/Documents/whatsapp-mcp-server/whatsapp/dist/index.js
