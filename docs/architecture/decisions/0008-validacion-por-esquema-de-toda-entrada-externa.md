# 0008. Validación por esquema de toda entrada externa

- Status: accepted
- Date: 2026-11-14
- Evidence: src/services/schema.ts:8, src/utils/backupValidator.ts:206, src/services/storageService.ts:826

## Context and drivers

El escenario `scenario:integridad-datos` exige que una carga no válida se
rechace entera sin tocar los datos existentes. Los datos entran por cuatro
bordes que el sistema no controla: el disco (que pudo escribir una versión
anterior), un archivo de copia, una sincronización y la respuesta de la IA. El
código ya valida contra esquemas en esos bordes, pero con dos definiciones del
mismo dato que han divergido: el esquema de copias no reconoce un campo que el
de almacenamiento sí.

## Options considered

1. Un único esquema por entidad, usado en todos los bordes: una sola verdad
   sobre la forma de cada dato; un cambio de esquema afecta a todos los bordes
   a la vez y exige cuidar la compatibilidad (0005).
2. Un esquema por borde: cada borde ajusta sus límites; las definiciones
   divergen y un dato válido en disco deja de serlo en una copia.
3. Confiar en los tipos en tiempo de compilación: sin coste en ejecución; no
   protege frente a datos antiguos o manipulados.

## Decision

Todo dato que cruza un borde hacia el sistema se valida contra un esquema
antes de tocar el estado o el disco, y una carga inválida se rechaza entera
con un motivo que se muestra a la persona. Cada entidad tiene un único esquema
de forma, definido junto al dominio y compartido por todos los bordes; un
borde puede añadir límites propios, pero no redefinir la forma. Validar no
transforma el contenido: el texto se guarda tal como llegó y se escapa al
presentarlo.

## Consequences

Más fácil: garantizar que el estado en memoria siempre es válido, y que lo que
se exporta se puede importar. Más difícil: cada campo nuevo se añade al
esquema único y a su prueba de ida y vuelta. Prohibido: escribir en el estado
un dato externo sin validar, y alterar el contenido durante la validación.

## Fitness function

Las pruebas rechazan cargas mal formadas en cada borde y verifican que
exportar e importar conserva todos los campos de cada entidad.

- Check: `pnpm vitest run src/__tests__/backupValidator.test.ts src/__tests__/storageService.test.ts`

## Review trigger

Un borde necesita una forma de dato realmente distinta, que el esquema único
con límites añadidos no pueda expresar.
