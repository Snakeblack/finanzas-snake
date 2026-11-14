# 0003. Un único escritor a disco con un solo camino de escritura

- Status: accepted
- Date: 2026-11-14
- Evidence: src/context/FinanzasContext.tsx:650, src/services/storageService.ts:590, src/services/storageService.ts:472, src/services/storageService.ts:839

## Context and drivers

El escenario `scenario:integridad-datos` pide que un cambio confirmado nunca se
pierda ni quede a medias, y `scenario:rendimiento-historial` que guardar un
cambio no cueste más cuanto mayor es el historial. Hoy el estado en memoria es
la copia de trabajo y unos efectos guardan cada colección entera cuando cambia.
Movimientos y deudas se guardan por diferencia; cuentas y periodos se vacían y
se reescriben en dos operaciones separadas, y existen escrituras por entidad
que nadie usa.

## Options considered

1. Guardar la colección entera en cada cambio: simple; el coste crece con el
   historial y vaciar y reescribir en dos pasos puede dejar el almacén vacío si
   la pestaña se cierra entre ambos.
2. Un único escritor que persiste cada cambio como una operación atómica por
   entidad afectada: coste proporcional al cambio y sin estados intermedios;
   exige que toda mutación pase por ese camino.
3. Registro de eventos solo de añadir, con el estado derivado: da historial y
   fusión; es un rediseño completo del modelo de datos que ningún driver pide.

## Decision

Cada dato persistente tiene un solo dueño y un solo escritor: el adaptador de
almacenamiento. El estado en memoria es una copia de trabajo que se hidrata al
arrancar o desbloquear. Toda mutación se persiste por un único camino, como
una operación atómica que contiene solo las entidades afectadas; ninguna
colección se vacía para reescribirse. Un fallo de escritura se comunica al
estado de aplicación, que lo muestra a la persona.

## Consequences

Más fácil: razonar sobre qué hay en disco, escalar con el historial, mostrar
fallos de guardado. Más difícil: las operaciones que tocan varias colecciones
(borrar una cuenta, importar un extracto, restaurar una copia) necesitan una
operación atómica que las abarque. Prohibido: escribir en el almacén desde la
interfaz o desde otro adaptador, y mantener dos caminos de escritura para el
mismo dato.

## Fitness function

Las pruebas del adaptador de almacenamiento cubren ida y vuelta de cada
colección y que una escritura interrumpida no deja la colección vacía.

- Check: `pnpm vitest run src/__tests__/storageService.test.ts`

## Review trigger

Aparece la necesidad de fusionar cambios hechos en dos dispositivos a la vez,
lo que reabriría la opción del registro de eventos.
