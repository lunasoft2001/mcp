# MCP Servers

Colección de servidores **MCP (Model Context Protocol)** para usar con **GitHub Copilot**, **Claude Desktop**, **Cursor** y otros clientes compatibles.

Cada servidor está en su propia carpeta con su `package.json`, `README.md` y documentación independiente.

---

## Servidores disponibles

| Servidor | Descripción | Estado |
|---|---|---|
| [whatsapp](./whatsapp/) | Administra grupos y contactos de WhatsApp | ✅ Publicado |

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
