# MCP Servers

Colección de servidores **MCP (Model Context Protocol)** para usar con **GitHub Copilot**, **Claude Desktop**, **Cursor** y otros clientes compatibles.

Cada servidor está en su propia carpeta con su `package.json`, `README.md` y documentación independiente.

---

## Servidores disponibles

| Servidor | Descripción | Tools | Estado |
|---|---|---|---|
| [whatsapp](./whatsapp/) | Envía mensajes directos y de grupo, gestiona participantes, obtiene historial de chat y soporta envío de archivos multimedia (imágenes, PDFs, VCF). Autenticación via QR con sesión persistente. | `send_direct_message` `send_group_message` `send_media_message` `get_chat_messages` `find_whatsapp_contact` `list_whatsapp_groups` `find_whatsapp_group` `list_group_members` `add_group_participant` `remove_group_participant` `get_group_invite_link` `healthcheck_whatsapp` | ✅ Publicado |
| [linkedin](./linkedin/) | Publica posts de texto, artículos con URL y vídeos en LinkedIn. Incluye flujo OAuth 2.0 completo con servidor local de callback. | `linkedin_get_my_profile` `linkedin_create_text_post` `linkedin_create_article_post` `linkedin_create_video_post` | ✅ Publicado |

---

## Cómo usar un servidor MCP

1. Entra en la carpeta del servidor que quieras usar
2. Sigue las instrucciones de su `README.md`
3. El patrón general es siempre:

```bash
cd <nombre-servidor>
npm install
npm run build
```

4. Configura tu cliente MCP apuntando al `dist/index.js` compilado

---

## Añadir a VS Code (GitHub Copilot)

En tu `settings.json` o archivo `.code-workspace`:

```json
{
  "mcp": {
    "servers": {
      "nombre-servidor": {
        "type": "stdio",
        "command": "node",
        "args": ["/ruta/absoluta/mcp/<nombre-servidor>/dist/index.js"]
      }
    }
  }
}
```

---

## Licencia

MIT
