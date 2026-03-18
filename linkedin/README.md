# LinkedIn MCP Server

Servidor MCP (Model Context Protocol) para LinkedIn que permite a Claude publicar posts y leer tu perfil directamente desde el chat.

> Construido con la [LinkedIn REST API oficial](https://learn.microsoft.com/en-us/linkedin/) · Licencia MIT

---

## ¿Qué puede hacer?

| Herramienta MCP | Descripción |
|---|---|
| `linkedin_get_my_profile` | Lee tu nombre, headline y email del perfil autenticado |
| `linkedin_create_text_post` | Publica un post de texto en LinkedIn |
| `linkedin_create_article_post` | Comparte un artículo/URL con comentario |

**Ejemplo de uso en Claude:**
> *"Publica en mi LinkedIn: 'Acabo de lanzar mi nuevo curso sobre MCP en LinkedIn Learning. ¡El futuro de los agentes de IA ya está aquí!'"*

---

## Requisitos previos

- Node.js >= 18
- Una app registrada en [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
- Claude Desktop instalado

---

## Paso 1 — Crear tu app en LinkedIn Developer Portal

1. Ve a **https://www.linkedin.com/developers/apps** y crea una nueva app.
2. En la pestaña **Products**, añade:
   - ✅ **Sign in with LinkedIn using OpenID Connect** (gratis, aprobación inmediata)
   - ✅ **Share on LinkedIn** (gratis, aprobación inmediata)
3. En **Auth** → **OAuth 2.0 settings** → **Redirect URLs**, añade:
   ```
   http://localhost:3000/callback
   ```
4. Copia tu **Client ID** y **Client Secret**.

---

## Paso 2 — Instalar y configurar el servidor

```bash
# Clonar o descargar el proyecto
cd linkedin-mcp-server

# Instalar dependencias
npm install

# Copiar el archivo de variables de entorno
cp .env.example .env
```

Edita `.env` y rellena tu Client ID y Client Secret:

```env
LINKEDIN_CLIENT_ID=tu_client_id
LINKEDIN_CLIENT_SECRET=tu_client_secret
```

---

## Paso 3 — Autenticarte con LinkedIn

```bash
npm run build
npm run auth
```

Esto abrirá tu navegador, te pedirá autorizar la app en LinkedIn, y guardará el `access_token` automáticamente en `.env`.

El token de acceso es válido **60 días**. Cuando expire, vuelve a ejecutar `npm run auth`.

---

## Paso 4 — Configurar Claude Desktop

Edita el archivo de configuración de Claude Desktop:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/ruta/absoluta/a/linkedin-mcp-server/dist/index.js"],
      "env": {
        "LINKEDIN_ACCESS_TOKEN": "tu_access_token_aqui"
      }
    }
  }
}
```

> **Tip:** En lugar de poner el token en `claude_desktop_config.json`, puedes leerlo desde `.env` omitiendo el campo `env` (el servidor carga `.env` automáticamente con `dotenv`).

Reinicia Claude Desktop y verás las herramientas de LinkedIn disponibles.

---

## Paso 5 — Probar con el Inspector MCP

```bash
npm run inspector
```

Esto abre una interfaz web para probar cada herramienta antes de usarla en Claude.

---

## Estructura del proyecto

```
linkedin-mcp-server/
├── src/
│   ├── index.ts              # Entry point (McpServer + stdio transport)
│   ├── constants.ts          # URLs y constantes de la API
│   ├── types.ts              # Interfaces TypeScript
│   ├── auth/
│   │   └── oauth-flow.ts     # Script de autenticación OAuth 2.0
│   ├── services/
│   │   └── linkedin.ts       # Cliente HTTP para la API de LinkedIn
│   └── tools/
│       ├── profile.ts        # Herramienta: leer perfil
│       └── posts.ts          # Herramientas: crear posts
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Solicitar acceso ampliado (para instructores / socios)

Si quieres **leer tus posts anteriores y sus estadísticas**, necesitas el scope `r_member_social`, que requiere aprobación de LinkedIn.

Para solicitarlo como instructor / creador de contenido:
1. Ve a [Developer Portal](https://www.linkedin.com/developers/apps) → tu app → **Products**
2. Busca **Marketing Developer Platform** o contacta a [LinkedIn Partner Program](https://business.linkedin.com/marketing-solutions/marketing-partners)
3. Justifica el caso de uso (demostración educativa de MCP/Agent Skills)

---

## Herramientas disponibles en detalle

### `linkedin_get_my_profile`
Retorna tu nombre, headline, email y Person URN (necesario internamente para crear posts).

### `linkedin_create_text_post`
```
Parámetros:
  text        (string)  Contenido del post, máx 3000 caracteres
  visibility  (string)  "PUBLIC" | "CONNECTIONS" (default: "PUBLIC")
```

### `linkedin_create_article_post`
```
Parámetros:
  text         (string)  Tu comentario sobre el artículo
  url          (string)  URL del artículo a compartir
  title        (string)  Título personalizado (opcional)
  description  (string)  Descripción del artículo (opcional)
  visibility   (string)  "PUBLIC" | "CONNECTIONS" (default: "PUBLIC")
```

---

## Rate Limits

| Límite | Valor |
|---|---|
| Por miembro/día | 150 requests |
| Por app/día | 100,000 requests |

---

## Licencia

MIT — libre para uso personal y educativo.
