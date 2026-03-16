# whatsapp-mcp-server

Servidor MCP (Model Context Protocol) para administrar grupos y contactos de WhatsApp desde clientes como **GitHub Copilot**, **Cursor** o **Claude Desktop**.

Basado en [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) y el [SDK oficial de MCP para TypeScript](https://github.com/modelcontextprotocol/typescript-sdk).

> ⚠️ **Aviso importante**: `whatsapp-web.js` automatiza WhatsApp Web mediante Puppeteer. WhatsApp no ofrece una API oficial para esto y puede cambiar su protocolo en cualquier momento, lo que requeriría actualizar la librería. Úsalo con responsabilidad y solo con números que controles.

---

## Qué hace este proyecto

- Expone 10 tools MCP para gestionar grupos y contactos de WhatsApp
- Autentica con WhatsApp Web mediante QR (una sola vez; la sesión se persiste localmente)
- Se conecta a cualquier cliente MCP compatible via **stdio**
- Código modular en TypeScript estricto, listo para extenderse

---

## Requisitos previos

- **Node.js** >= 18
- **npm** >= 9
- **Google Chrome** o **Chromium** instalado (Puppeteer lo usa internamente)
  - macOS: `brew install --cask google-chrome`
  - Linux: `apt install chromium-browser`
- Un número de WhatsApp activo para autenticar

---

## Instalación

```bash
git clone <url-del-repo>
cd whatsapp-mcp-server
npm install
```

---

## Configuración del .env

Copia el fichero de ejemplo y ajusta los valores:

```bash
cp .env.example .env
```

> **⚠️ Lo primero que debes cambiar**: `DEFAULT_COUNTRY_CODE` — ponlo al código de tu país (ej: `43` para Austria, `49` para Alemania, `1` para USA). El servidor usa este valor para completar números locales que no llevan prefijo internacional.

| Variable | Descripción | Por defecto |
|---|---|---|
| `DEFAULT_COUNTRY_CODE` | Prefijo de país para normalizar números sin código | `34` (España) |
| `LOG_LEVEL` | Nivel de log: `debug`, `info`, `warn`, `error` | `info` |
| `WA_SESSION_PATH` | Ruta donde se guarda la sesión de WhatsApp | `./.wwebjs_auth` |
| `WA_SESSION_NAME` | Nombre de la sesión (permite múltiples) | `mcp-session` |
| `WA_READY_TIMEOUT_MS` | Tiempo máx. esperando a que WhatsApp esté listo | `30000` |

---

## Arranque en modo desarrollo

```bash
npm run dev
```

> ⚠️ **Nota**: El servidor usa `stdio` para comunicarse con el cliente MCP. Esto significa que cuando VS Code lo gestiona, el QR **no aparece en ningún panel visible**. Usa el script `authenticate.mjs` para la autenticación inicial (ver sección siguiente).

---

## Compilación

```bash
npm run build
# Los archivos compilados quedan en dist/
```

---

## Cómo autenticar WhatsApp (proceso recomendado)

Debido a que el servidor usa `stdio`, el QR no es visible cuando VS Code lo arranca directamente. El flujo correcto es:

**Paso 1 — Primera autenticación (script independiente):**

```bash
node authenticate.mjs
```

Este script arranca Chrome de forma autónoma, muestra el QR grande en la terminal y espera 15 segundos tras la autenticación para guardar la sesión correctamente antes de cerrarse.

**Paso 2 — Escanear:**
WhatsApp en el móvil → `···` → **Dispositivos vinculados** → **Vincular un dispositivo** → escanear QR

**Paso 3 — Recargar el cliente MCP:**
Una vez el script termina (cuenta atrás de 15s), recargar VS Code para que el servidor MCP arranque con la sesión guardada.

**Paso 4 — Usos posteriores:**
La sesión persiste en `WA_SESSION_PATH`. No vuelve a pedir QR salvo que:
- Cierres la sesión desde el móvil (WhatsApp → Dispositivos vinculados → cerrar sesión)
- Pase mucho tiempo sin conectarse
- Borres manualmente la carpeta `.wwebjs_auth/`

**Si necesitas reautenticar:**
```bash
rm -rf .wwebjs_auth
node authenticate.mjs
```

---

## Cómo conectar a un cliente MCP

### GitHub Copilot (VS Code)

Añade esto en tu `settings.json` de VS Code o en `.vscode/mcp.json`:

```json
{
  "mcp": {
    "servers": {
      "whatsapp": {
        "type": "stdio",
        "command": "node",
        "args": ["/ruta/absoluta/whatsapp-mcp-server/dist/index.js"],
        "env": {
          "DEFAULT_COUNTRY_CODE": "43",
          "LOG_LEVEL": "info"
        }
      }
    }
  }
}
```

O con `tsx` para desarrollo sin compilar:

```json
{
  "mcp": {
    "servers": {
      "whatsapp": {
        "type": "stdio",
        "command": "npx",
        "args": ["tsx", "/ruta/absoluta/whatsapp-mcp-server/src/index.ts"],
        "env": {
          "DEFAULT_COUNTRY_CODE": "43"
        }
      }
    }
  }
}
```

### Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "node",
      "args": ["/ruta/absoluta/whatsapp-mcp-server/dist/index.js"],
      "env": {
        "DEFAULT_COUNTRY_CODE": "43",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Cursor

En la configuración de MCP de Cursor, añade un servidor con:
- **type**: `stdio`
- **command**: `node /ruta/absoluta/whatsapp-mcp-server/dist/index.js`

---

## Tools disponibles

| Tool | Descripción | Requiere admin |
|---|---|---|
| `healthcheck_whatsapp` | Estado del servidor y WhatsApp | No |
| `list_whatsapp_groups` | Lista todos los grupos | No |
| `find_whatsapp_group` | Busca grupos por nombre | No |
| `list_group_members` | Lista miembros de un grupo | No |
| `add_group_participant` | Añade un participante | Sí |
| `remove_group_participant` | Elimina un participante ⚠️ | Sí |
| `get_group_invite_link` | Obtiene enlace de invitación | Sí |
| `send_group_message` | Envía mensaje al grupo | No |
| `find_whatsapp_contact` | Busca contactos por nombre/número | No |
| `send_direct_message` | Envía mensaje privado | No |
| `get_chat_messages` | Lee los últimos mensajes de un chat o grupo | No |

---

## Ejemplos de uso

Una vez conectado desde un cliente MCP:

```
"Lista todos mis grupos de WhatsApp"
→ list_whatsapp_groups

"Busca el grupo de trabajo"
→ find_whatsapp_group { groupName: "trabajo" }

"Quién está en el grupo 120363XXXXXX@g.us"
→ list_group_members { groupId: "120363XXXXXX@g.us" }

"Añade el +43600111222 al grupo 120363XXXXXX@g.us"
→ add_group_participant { groupId: "120363XXXXXX@g.us", phoneNumber: "+43600111222" }

"Manda 'Reunión a las 10' al grupo de trabajo"
→ send_group_message { groupId: "...", message: "Reunión a las 10" }

"Comprueba si WhatsApp está conectado"
→ healthcheck_whatsapp

"Lee los últimos 20 mensajes del grupo de trabajo"
→ get_chat_messages { chatId: "120363XXXXXX@g.us", limit: 20 }
```

---

## Normalización de números de teléfono

El servidor acepta estos formatos:

| Entrada | Con `DEFAULT_COUNTRY_CODE=34` | WA ID |
|---|---|---|
| `+34600111222` | — | `34600111222@c.us` |
| `34600111222` | — | `34600111222@c.us` |
| `600111222` | Se añade prefijo 34 | `34600111222@c.us` |
| `+43600111222` | — | `43600111222@c.us` |

---

## Limitaciones conocidas

- **whatsapp-web.js no es una API oficial**: puede romperse con actualizaciones de WhatsApp Web. Mantén la librería actualizada.
- **Añadir participantes**: si el contacto tiene privacidad activada, no se puede añadir directamente. La tool devolverá un enlace de invitación si está disponible.
- **Nombres en miembros de grupo**: `whatsapp-web.js` no expone el nombre directamente en la lista de participantes. Usa `find_whatsapp_contact` con el número para obtenerlo.
- **Requiere sesión activa**: el móvil con WhatsApp debe permanecer conectado (WhatsApp Web no funciona si el móvil lleva mucho tiempo apagado).
- **Un solo número autenticado**: este servidor gestiona una sesión. Para múltiples números, levanta varias instancias con `WA_SESSION_NAME` distinto.

---

## Siguientes mejoras recomendadas

- [ ] Añadir capa de autorización (token/secret) antes de ejecutar tools destructivas
- [ ] Tool `promote_to_admin` / `demote_from_admin`
- [ ] Tool `get_group_info` con descripción y foto del grupo
- [ ] Soporte para mensajes multimedia (imágenes, documentos)
- [ ] Modo HTTP/SSE para despliegue remoto (en lugar de solo stdio)
- [ ] Tests unitarios con mocks de whatsapp-web.js

---

## Estructura del proyecto

```
whatsapp-mcp-server/
├── src/
│   ├── index.ts              # Entry point — conecta WhatsApp + MCP stdio
│   ├── config/
│   │   └── env.ts            # Variables de entorno tipadas
│   ├── types/
│   │   └── index.ts          # Interfaces y tipos compartidos
│   ├── utils/
│   │   └── logger.ts         # Logger simple con niveles
│   ├── whatsapp/
│   │   └── client.ts         # Cliente WhatsApp (singleton, gestión de estado)
│   ├── mcp/
│   │   └── server.ts         # Creación del McpServer y registro de tools
│   └── tools/
│       ├── groups.ts         # Tools de grupos
│       ├── contacts.ts       # Tools de contactos
│       └── messages.ts       # Tools de mensajes + healthcheck
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```
