# 0004. Importes decimales exactos y movimientos inmutables

- Status: accepted
- Date: 2026-11-14
- Evidence: src/types/index.ts:68, src/types/index.ts:76, src/types/index.ts:52, src/types/index.ts:60, src/services/ledgerEngine.ts:25

## Context and drivers

El escenario `scenario:exactitud-contable` exige que los mismos datos den el
mismo importe en todas las vistas y que el cálculo sea decimal exacto. Los
movimientos ya guardan su importe como texto decimal con su divisa y se
declaran de solo lectura. El saldo inicial de cuenta y el saldo de apertura de
periodo, en cambio, son números de coma flotante, y existen dos motores de
saldos de los que solo uno está en uso.

## Options considered

1. Importe como texto decimal con divisa y cálculo con aritmética decimal de
   precisión arbitraria: exacto y legible al depurar; exige convertir en cada
   borde de entrada y salida.
2. Importe como entero en la unidad mínima de la divisa: exacto y rápido;
   complica divisas con distinto número de decimales y los porcentajes de
   interés intermedios.
3. Número de coma flotante redondeado al mostrar: lo más simple; acumula error
   en sumas largas y en amortizaciones.

## Decision

Todo importe monetario, en memoria, en disco y en las copias, es un valor
compuesto por una cantidad decimal exacta en texto y su divisa; esto incluye
el saldo inicial de cuenta y el saldo de apertura de periodo. Todo cálculo con
dinero usa aritmética decimal exacta y nunca coma flotante binaria. Un
movimiento confirmado no se muta: una edición lo sustituye por otro. Existe un
único motor de saldos y todas las vistas leen de él.

## Consequences

Más fácil: cuadrar saldos entre vistas, auditar un cálculo. Más difícil: los
formularios convierten texto a importe en el borde y los datos antiguos con
saldos numéricos se migran al leer (0005). Prohibido: operar dinero con
operadores numéricos nativos y mantener un segundo cálculo de saldos.

## Fitness function

Las pruebas del motor contable comparan importes exactos como texto, y el
saldo de una cuenta coincide entre el panel, la lista de cuentas y el cierre
de periodo para un mismo conjunto de datos.

- Check: `pnpm vitest run src/__tests__/ledgerEngine.test.ts src/__tests__/financeService.test.ts src/__tests__/openingBalance.test.ts`

## Review trigger

Se añade una divisa cuya unidad mínima no es centesimal, o el cálculo decimal
pasa a ser el cuello de botella medido con el historial real.
