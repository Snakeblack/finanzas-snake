# Finanzas Snake

Aplicación web gratuita y de ejecución local/cliente para la gestión de finanzas personales, presupuestos, control de deudas y asesoría con Inteligencia Artificial.

Desplegado en producción: [finanzas.mretamozo.com](https://finanzas.mretamozo.com)

## 🚀 Arquitectura y Filosofía
Finanzas Snake está diseñada bajo el principio de **Privacidad Absoluta (Zero-Knowledge)**. Es una SPA (Single Page Application) sin base de datos en servidor:
- **Persistencia Local:** Los datos se guardan en el navegador (`IndexedDB`).
- **Cifrado AES-GCM (256-bit):** Protección local opcional mediante criptografía nativa y derivación de claves PBKDF2 basada en un PIN de usuario.
- **Sincronización P2P:** Transferencia de datos segura entre dispositivos vía WebRTC (PeerJS) sin intermediarios.

## 🛠️ Requisitos previos
- **Node.js:** Versiones `20.19+` o `22.12+`.
- **Gestor de paquetes:** Estrictamente `pnpm` (instalar globalmente con `npm i -g pnpm` si no se dispone de él).

## 💻 Ejecución en Local

### Opción Rápida (Windows)
Doble clic sobre el archivo ejecutable por lotes (Nota: Se recomienda renombrarlo a la identidad actual de la app):
```text
abrir-finanzaspro.bat
```
*Este script automatiza la instalación de dependencias, levanta el servidor Vite en el puerto `42873` y abre el navegador por defecto*.

### Opción Manual (Cualquier SO)
```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar entorno de desarrollo
pnpm dev
```
Accede a la aplicación en: `http://127.0.0.1:42873/`.

## 📜 Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `pnpm dev` | Levanta el servidor local de desarrollo en el puerto estricto `42873`. |
| `pnpm build` | Compila la aplicación optimizada para producción en la carpeta `dist/`. |
| `pnpm preview` | Previsualiza localmente la compilación de producción. |
| `pnpm typecheck` | Ejecuta el compilador de TypeScript sin emitir archivos para validar tipos. |
| `pnpm test` | Ejecuta la suite de pruebas unitarias con Vitest. |
| `pnpm test:coverage` | Genera un reporte detallado de cobertura de código (V8) en formato HTML/JSON. |
| `pnpm audit` | Realiza una auditoría de seguridad de las dependencias. |

## 🤖 Integración con Gemini AI
El **Asesor Gemini** utiliza el modelo `gemini-3.5-flash`. 
- **No requiere variables de entorno (`.env`) en desarrollo o producción**.
- La API Key se introduce directamente desde la interfaz, cifrándose antes de guardarse en el almacenamiento local del cliente.