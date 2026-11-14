# 0001. Aplicación local sin backend de datos

- Status: accepted
- Date: 2026-11-14
- Evidence: src/services/db/idbProvider.ts:18, vercel.json:33, docs/ARCHITECTURE.md:104

## Context and drivers

La aplicación lleva las finanzas de una o dos personas para uso propio. La
restricción de negocio `constraint:business.constraints` exige coste de
alojamiento cero y que ningún servidor propio guarde ni procese datos
financieros. El escenario `scenario:confidencialidad` pide que ningún dato
salga del dispositivo sin una acción explícita, y `scenario:uso-sin-conexion`
que la aplicación funcione sin red.

## Options considered

1. Aplicación de cliente que guarda todo en el dispositivo: sin coste de
   servidor ni superficie de ataque remota; a cambio, la copia de seguridad y
   el uso en varios dispositivos son responsabilidad de la persona.
2. Aplicación de cliente con un servicio propio de cuentas y almacenamiento:
   da copia automática y varios dispositivos sin esfuerzo; cuesta dinero,
   operación y custodia de datos financieros de terceros.
3. Servicio propio que solo guarda datos cifrados de extremo a extremo:
   conserva la confidencialidad, pero mantiene el coste y la operación de un
   servidor.

## Decision

La aplicación es un cliente que se ejecuta entero en el navegador y es dueño
de todos los datos. No existe ningún servicio propio que almacene, procese o
reenvíe datos financieros. Todo lo que el servidor de alojamiento entrega es
código estático.

## Consequences

Más fácil: coste cero, sin custodia de datos, sin autenticación de servidor.
Más difícil: la pérdida del almacenamiento del navegador es pérdida de datos
si no hay copia exportada; llevar los datos a otro dispositivo exige una
transferencia explícita (0006). Prohibido: añadir un punto de entrada de
servidor que reciba datos financieros, en claro o cifrados.

## Fitness function

Revisión de cada cambio: ninguna llamada de red nueva lleva datos financieros
a un origen propio, y la política de seguridad de contenido solo autoriza los
orígenes de las integraciones registradas en la línea base técnica.

## Review trigger

La persona decide ofrecer la aplicación a terceros con copia automática, o
aparece una necesidad de varios dispositivos que la transferencia explícita no
cubre.
