# Formato de la copia de seguridad y de la sincronización

Contrato de los datos que salen de la aplicación en un archivo de copia y de los
que viajan entre dos dispositivos al sincronizar. Los dos usan la misma carga:
la construye `buildFinanceBackupPayload` y la valida e importa
`importFinanceBackupPayload` (`src/services/storageService.ts`), con el
validador de `src/utils/backupValidator.ts`.

Reglas que este contrato hereda de la arquitectura:

- El formato solo añade. Toda versión publicada se sigue importando
  ([ADR 0005](../architecture/decisions/0005-evolucion-de-datos-por-migracion-al-leer.md)).
- Validar no transforma el contenido: el texto se guarda como llegó y se escapa
  al presentarlo
  ([ADR 0008](../architecture/decisions/0008-validacion-por-esquema-de-toda-entrada-externa.md)).
- Una carga inválida se rechaza entera y no toca los datos existentes.

## Carga

Un objeto JSON plano. Las colecciones van serializadas como cadena JSON; al
importar también se aceptan como array.

| Clave                       | Valor                                   | Presencia                              |
| --------------------------- | --------------------------------------- | -------------------------------------- |
| `finanzas_backup_format`    | Versión del formato. Actual: `"2"`      | Desde el formato 2. Ausente en el 1    |
| `finanzas_v3_transactions`  | Cadena JSON con la lista de movimientos | Al menos una de las cuatro colecciones |
| `finanzas_v3_debts`         | Cadena JSON con la lista de deudas      | Opcional                               |
| `finanzas_v3_periods`       | Cadena JSON con la lista de periodos    | Opcional                               |
| `finanzas_v3_accounts`      | Cadena JSON con la lista de cuentas     | Opcional                               |
| `finanzas_v3_userA_name`    | Nombre del primer perfil (máx. 50)      | Opcional                               |
| `finanzas_v3_userB_name`    | Nombre del segundo perfil (máx. 50)     | Opcional                               |
| `finanzas_v3_profile_count` | `"1"` o `"2"`                           | Opcional. Ausente: no cambia el actual |
| `finanzas_v3_ai_chat`       | Cadena JSON con el historial del asesor | Opcional                               |
| `finanzas_v2_gemini_key`    | Clave de la IA, o `null`                | Opcional                               |

Las claves que no figuran en la tabla se ignoran. Una carga sin ninguna de las
cuatro colecciones financieras (movimientos, deudas, periodos, cuentas) se
rechaza.

## Movimiento

| Campo           | Valor                                                              |
| --------------- | ------------------------------------------------------------------ |
| `id`            | Texto no vacío, máx. 2000 caracteres                               |
| `desc`          | Texto no vacío, máx. 150                                           |
| `money`         | `{ amount: "12.50", currency: "EUR" \| "USD" \| "GBP" }`           |
| `type`          | `income`, `expense` o `transfer`                                   |
| `tag`           | Texto no vacío, máx. 50                                            |
| `date`          | `YYYY-MM-DD`                                                       |
| `recurrence`    | `recurring` o `one-off`                                            |
| `owner`         | `userA`, `userB` o `joint`                                         |
| `paidBy`        | `userA`, `userB` o `shared`                                        |
| `accountId`     | Opcional, máx. 50                                                  |
| `fromAccountId` | Opcional, máx. 50                                                  |
| `toAccountId`   | Opcional, máx. 50                                                  |
| `originId`      | Opcional, máx. 2000. Identificador de la serie recurrente del clon |
| `sortIndex`     | Opcional. Entero mayor o igual que 0. Orden manual dentro del día  |

En lugar de `money` se acepta el campo antiguo `amount` (número), que se
importa en euros.

### Orden manual dentro de un día

`sortIndex` es la posición que la persona eligió al arrastrar un movimiento
entre los de su misma fecha (0 es el primero). Solo lo llevan los movimientos
de un día que se ha ordenado a mano; los que no lo llevan se muestran antes que
los ordenados. Las copias anteriores no tienen el campo y se importan igual;
un valor que no sea un entero mayor o igual que 0 rechaza la copia. El clon de
un recurrente en otro mes no hereda el orden.

### Identificadores de los clones de recurrentes

El clon de un movimiento recurrente en un mes lleva el identificador
`<serie>-<YYYY-MM>`, donde `<serie>` es el `originId` (o el `id` del movimiento
original). Su longitud no depende del número de meses transcurridos.

Las versiones anteriores encadenaban el identificador del clon del mes previo
(`<id>-2026-01-2026-02-…`), que crece ocho caracteres por mes. Esos
identificadores siguen siendo válidos y se importan sin reescribirlos; por eso
el límite de `id` y `originId` es de 2000 caracteres.

## Cuenta, deuda, periodo y mensaje

- Cuenta: `id` (máx. 50), `name` (máx. 100), `owner`, `initialBalance`.
- Deuda clásica (`kind: "classic"`): `id`, `desc` (máx. 150), `tag` (máx. 50),
  `date` (`YYYY-MM`), `owner`, `principal`, `tae`, `termMonths` y los
  opcionales `openingCommission`, `tin`, `paymentAccountId`, `chargeDay`
  (1 a 31) y `recurringMonthlyCosts`.
- Deuda fraccionada (`kind: "paymentPlan"`): los campos comunes más
  `financedAmount`, `fees`, `totalToPay` e `installments`, cada cuota con `id`
  (máx. 80), `dueMonth` (`YYYY-MM`), `amount`, `status` (`paid` o `pending`) y
  `label` (máx. 100).
- Periodo: `month` (`YYYY-MM`), `openingBalance`, `openingBalanceA`,
  `openingBalanceB` y el opcional `isManualInit`.
- Mensaje del asesor: `role` (`user` o `model`), `content` (máx. 10000) y
  `timestamp` (máx. 30).

A los textos solo se les quitan los espacios de los extremos.

## Versiones

| Formato | Marca                         | Diferencias                                                                |
| ------- | ----------------------------- | -------------------------------------------------------------------------- |
| 1       | Sin `finanzas_backup_format`  | Los textos pudieron quedar escapados como HTML. Sin `originId`             |
| 2       | `finanzas_backup_format: "2"` | Textos tal como se escribieron. Incluye `originId` y el número de perfiles |

### Lectura del formato 1

La validación anterior escapaba como HTML los textos al importar (`&` pasaba a
`&amp;`), y cada ronda de exportar e importar los escapaba otra vez. Al leer
una carga sin marca de formato se deshace ese escapado, todas las rondas, antes
de validar, en estos campos: los dos nombres de perfil, `name` de cuenta,
`desc` y `tag` de movimiento y de deuda, y `label` de cuota. Los
identificadores y el contenido del chat no se tocan.

Consecuencia aceptada: en una carga del formato 1, un texto que contuviera a
propósito una entidad como `&amp;` se importa como `&`. En el formato 2 se
conserva.

Una aplicación anterior que reciba una carga del formato 2 ignora la marca y la
importa con sus propias reglas.
