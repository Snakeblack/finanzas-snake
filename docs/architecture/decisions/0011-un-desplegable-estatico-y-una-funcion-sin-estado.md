# 0011. Un desplegable estático y una función sin estado

- Status: accepted
- Date: 2026-11-14
- Evidence: vercel.json:33, api/get-turn-credentials.js:1, src/components/sync/SyncModal.tsx:139

## Context and drivers

Una sola persona desarrolla y responde de producción, sin guardia
(`constraint:team.shape`, `constraint:team.production-owner`), y el coste de
alojamiento debe ser cero (`constraint:business.constraints`). El escenario
`scenario:uso-sin-conexion` pide que la aplicación arranque sin red tras el
primer uso. Hoy se despliega como sitio estático más una única función sin
estado que entrega credenciales temporales del retransmisor de sincronización,
para no incluir ese secreto en el código del cliente; no hay arranque sin
conexión.

## Options considered

1. Un sitio estático más esa función sin estado: mantiene el secreto del
   retransmisor fuera del cliente con una pieza mínima; hay una función que
   desplegar y vigilar.
2. Solo sitio estático, con retransmisores públicos o configurados por la
   persona: cero secretos y cero funciones; la sincronización falla más entre
   redes restrictivas.
3. Sitio estático más un servicio propio de contacto y retransmisión: control
   total de la sincronización; coste y operación que una sola persona sin
   guardia no asume.

## Decision

La aplicación es un único desplegable de archivos estáticos, publicado al
integrar en la rama principal. Lo acompaña una sola función sin estado cuyo
único cometido es entregar credenciales temporales del retransmisor; no recibe
ni ve datos financieros (0001) y, si falla, la sincronización degrada a los
retransmisores que haya configurado la persona, sin afectar al resto. Tras la
primera carga, el cliente arranca y funciona sin red; solo la sincronización y
la IA la requieren.

## Consequences

Más fácil: desplegar, volver atrás y operar sin guardia; una caída del
alojamiento no pierde datos. Más difícil: la caché de arranque sin conexión
obliga a gestionar la actualización de versiones en clientes ya instalados.
Prohibido: añadir estado al servidor o una segunda función sin una decisión
nueva.

## Fitness function

Prueba manual tras cada entrega que toque el arranque: cargar la aplicación
publicada, cortar la red, recargar y anotar un movimiento. La función responde
sin datos internos cuando faltan sus credenciales.

## Review trigger

El alojamiento deja de ofrecer funciones sin coste, o la sincronización pasa a
necesitar un servicio propio.
