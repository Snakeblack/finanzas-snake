# 0006. Sincronización entre dispositivos por instantánea completa cifrada

- Status: accepted
- Date: 2026-11-14
- Evidence: src/services/syncService.ts:84, src/services/syncService.ts:165, src/components/sync/SyncModal.tsx:272

## Context and drivers

Sin servidor de datos (0001, `constraint:business.constraints`), llevar los
datos al dispositivo de la otra persona exige una transferencia directa. El
escenario `scenario:integridad-datos` pide que lo recibido nunca deje los
datos a medias y `scenario:confidencialidad` que ningún intermediario pueda
leerlos. El código ya conecta dos dispositivos, envía la instantánea completa
cifrada con una clave derivada de un código de un solo uso y el receptor la
importa sustituyendo lo que tenía.

## Options considered

1. Transferencia directa de la instantánea completa, que sustituye el estado
   del receptor: simple y sin estados intermedios; no fusiona cambios hechos en
   ambos lados, gana el emisor.
2. Fusión de cambios por entidad con marcas de tiempo o estructuras sin
   conflicto: permite editar en ambos dispositivos; exige rehacer el modelo de
   datos y resolver conflictos contables.
3. Solo copia de seguridad en archivo llevada a mano: cero infraestructura;
   incómodo para el uso habitual en pareja.

## Decision

Dos dispositivos se sincronizan con una transferencia directa entre ellos de
la instantánea completa de los datos. El emisor es la fuente de verdad: el
receptor valida la instantánea entera (0008) y, solo si es válida, sustituye
su estado de forma atómica tras avisar a la persona de que se sobrescribe. La
carga viaja cifrada con una clave que solo conocen los dos dispositivos,
derivada del código de un solo uso que la persona introduce (0010). Los
servicios de conexión de terceros solo ayudan a establecer el canal.

## Consequences

Más fácil: implementación y razonamiento; nunca hay datos a medias. Más
difícil: si ambas personas editan a la vez, una de las dos pierde sus cambios
al recibir; la interfaz debe dejarlo claro antes de aceptar. Prohibido:
aplicar una instantánea parcial o no validada.

## Fitness function

Las pruebas cubren el cifrado de ida y vuelta de la carga y el rechazo de una
carga manipulada o con la clave equivocada.

- Check: `pnpm vitest run src/__tests__/syncService.test.ts`

## Review trigger

La pareja edita en ambos dispositivos con frecuencia y la pérdida por
sobrescritura ocurre en uso real.
