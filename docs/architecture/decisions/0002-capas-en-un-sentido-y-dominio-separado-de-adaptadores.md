# 0002. Capas en un solo sentido y dominio separado de adaptadores

- Status: accepted
- Date: 2026-11-14
- Evidence: src/context/FinanzasContext.tsx:43, src/services/financeService.ts:21, src/components/sync/SyncModal.tsx:7

## Context and drivers

El escenario `scenario:modificabilidad` pide que rediseñar una pantalla o
cambiar una regla contable toque una sola capa; es la condición para rehacer
la interfaz sin romper las cuentas. `scenario:exactitud-contable` pide un único
lugar donde vive cada regla. El código ya respeta el sentido interfaz → estado
de aplicación → servicios (ningún servicio importa la interfaz), pero mezcla
reglas contables puras con almacenamiento, cifrado, sincronización e IA en la
misma capa, y la interfaz llama a algunos servicios directamente.

## Options considered

1. Mantener las tres capas actuales: sin coste de migración; las reglas siguen
   pegadas a los mecanismos de entrada y salida y la interfaz sigue pudiendo
   saltarse el estado de aplicación.
2. Cuatro capas con dependencia en un solo sentido, separando el dominio puro
   de los adaptadores: las reglas se prueban sin navegador y un adaptador se
   sustituye sin tocar reglas; cuesta mover archivos y definir las interfaces
   que el dominio y el estado esperan de los adaptadores.
3. Módulos verticales por capacidad, cada uno con sus capas internas: aísla
   capacidades entre sí; es más estructura de la que una sola persona y un
   solo desplegable necesitan hoy.

## Decision

El código se organiza en cuatro capas y las dependencias van en un solo
sentido: interfaz → estado de aplicación → dominio, y estado de aplicación →
adaptadores. El dominio contiene las reglas contables y los tipos; es puro, no
realiza entrada ni salida y no depende de ninguna otra capa. Los adaptadores
(almacenamiento, cifrado, sincronización, asistente de IA, importación de
archivos) implementan interfaces que el estado de aplicación consume y solo
dependen del dominio. La interfaz solo habla con el estado de aplicación: no
importa adaptadores ni reimplementa reglas; puede usar funciones puras del
dominio para presentar datos.

## Consequences

Más fácil: rediseñar la interfaz, probar reglas sin navegador, cambiar un
adaptador. Más difícil: toda capacidad nueva exige decidir en qué capa vive, y
la migración desde la estructura actual se hace por partes con las dos
estructuras conviviendo. Prohibido: que el dominio o un adaptador importen la
interfaz o el estado de aplicación, y que la interfaz importe un adaptador.

## Fitness function

El dominio y los adaptadores no importan la biblioteca de interfaz ni el
estado de aplicación. La regla «la interfaz no importa adaptadores» se revisa
a mano hasta que la migración termine y pueda comprobarse con un comando.

- Check: `sh -c '! grep -rqsE "from .(react|react-dom).|/(hooks|components|context)/" src/services src/utils src/domain src/adapters'`

## Review trigger

La aplicación deja de ser un único desplegable, o entra una segunda persona a
desarrollar y los módulos por capacidad pasan a compensar.
