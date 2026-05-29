# FinanzasPro

App local para planificar finanzas personales, gastos, deudas y simulación de reunificación.

## Ejecutar en local

Requisitos:

- Node.js 20.19+ o 22.12+
- pnpm instalado (`npm i -g pnpm` si no lo tenés)

### Opción fácil: doble clic

En Windows, abrí este archivo con doble clic:

```text
Abrir FinanzasPro.bat
```

Qué hace:

1. instala dependencias si todavía no existe `node_modules/`;
2. levanta el servidor local en `http://127.0.0.1:42873/`;
3. abre Chrome automáticamente si está instalado; si no, abre el navegador predeterminado.

Dejá abierta la ventana del servidor mientras uses la app. Si la cerrás, la app local deja de responder.

### Opción manual

```bash
pnpm install
pnpm dev
```

Después abrí la URL que imprime Vite, normalmente:

```text
http://127.0.0.1:42873/
```

## Comandos útiles

```bash
pnpm dev      # modo desarrollo
pnpm build      # compila una versión de producción en dist/
pnpm typecheck  # valida TypeScript sin generar archivos
pnpm preview    # sirve la build localmente
```

## Gemini

La API key de Gemini se carga desde la pantalla **Asesor Gemini** y queda guardada solo en `localStorage` del navegador. No hace falta crear un archivo `.env` para correr la app.
