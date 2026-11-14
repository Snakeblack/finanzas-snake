# 0005. Evolución de datos por migración al leer

- Status: accepted
- Date: 2026-11-14
- Evidence: src/services/storageService.ts:336, src/services/storageService.ts:701, src/utils/backupValidator.ts:206

## Context and drivers

El escenario `scenario:integridad-datos` y la decisión de versionado
`constraint:delivery.versioning` exigen que una versión nueva siempre abra los
datos y las copias de seguridad antiguos: no hay servidor donde ejecutar una
migración central y una copia exportada hace años debe poder restaurarse. El
código ya convierte registros antiguos al formato actual al leerlos o
importarlos.

## Options considered

1. Migrar al leer: cada registro antiguo se convierte al formato actual cuando
   se lee del disco o de una copia; funciona sin servidor y con copias de
   cualquier antigüedad, pero el código de conversión se acumula.
2. Migración única al actualizar con número de versión del almacén: código
   acotado por versión; no cubre copias antiguas, que seguirían necesitando
   conversión al importar.
3. Sin compatibilidad: exportar e importar a mano en cada cambio de formato;
   descartada por el driver de integridad.

## Decision

El formato de los datos persistentes y de las copias lleva una versión
explícita. Un cambio de formato solo añade: todo lector acepta cualquier
versión anterior y la convierte al formato actual al leer, tanto del disco como
de una copia o de una sincronización. La conversión es una función pura del
dominio de datos, con una prueba por cada formato antiguo admitido. Ningún
cambio elimina la capacidad de leer un formato ya publicado.

## Consequences

Más fácil: restaurar cualquier copia, publicar sin pasos manuales. Más
difícil: el código de conversión crece y cada cambio de formato exige su
prueba con datos del formato anterior. Prohibido: reutilizar un campo con otro
significado y descartar campos desconocidos al validar una copia.

## Fitness function

Las pruebas leen datos y copias de cada formato anterior y verifican el
resultado en el formato actual; una ida y vuelta de exportar e importar
conserva todos los campos.

- Check: `pnpm vitest run src/__tests__/storageService.test.ts src/__tests__/backupValidator.test.ts`

## Review trigger

El número de formatos antiguos admitidos hace inmanejable el código de
conversión, o deja de haber copias anteriores a un formato dado.
