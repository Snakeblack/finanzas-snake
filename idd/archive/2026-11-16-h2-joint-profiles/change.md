# h2-joint-profiles

## Intent and acceptance

Perfiles y cuentas conjuntas: con un perfil la segunda cuenta o deuda queda conjunta sin poder corregirlo y el saldo inicial negativo se vuelve positivo; en vista individual un gasto o cuota conjunta pagada desde la cuenta de una persona cuenta a medias en gastos y entera en el cierre; la liquidación conjunta suma importes de distinta divisa sin convertir

Acceptance: Con un perfil, toda cuenta o deuda nueva (también la segunda) queda a nombre de la persona; un saldo inicial negativo se guarda negativo al crear y al editar; en vista individual Apertura + Ingresos − Gastos − Deuda = Cierre para un mes con un gasto conjunto y una cuota conjunta pagados desde la cuenta de una persona; la liquidación de «Cuentas del mes» convierte a EUR los gastos en otra divisa con aritmética decimal exacta

## Plan

<!-- ospec:plan:start -->
- Files: `docs/roadmap.md`, `src/__tests__/backupRoundtrip.test.ts`, `src/__tests__/financeService.test.ts`, `src/__tests__/h2JointProfiles.test.ts`, `src/components/accounts/AccountsTab.tsx`, `src/hooks/useAccounts.ts`, `src/hooks/useDebts.ts`, `src/hooks/useFinancialSelectors.ts`, `src/services/financeService.ts`
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- Con un perfil, alta y edición de cuentas y alta de deudas guardan siempre userA y el formulario vuelve a userA; las conjuntas antiguas se corrigen al editarlas, sin migrar datos (decisión del propietario)
- El saldo inicial de cuenta se guarda con su signo al crear y al editar, y el campo deja de exigir min=0, igual que la bienvenida
- En vista individual un ingreso o gasto reparte por el titular de su cuenta (sin cuenta, por el del movimiento) y una cuota por el de su cuenta de pago (sin ella, por el de la deuda): mismo criterio que el cierre, aplicado en saldos, desglose por etiqueta y proyección; la deuda pendiente sigue repartiéndose por el titular de la deuda porque es un pasivo, no caja (decisión del propietario: caja)
- La liquidación conjunta sale del selector al dominio (calculateJointSettlement) con Big y conversión a EUR por las tasas estáticas; redondea a céntimos como el resto del motor
<!-- ospec:decisions:end -->

- `src/__tests__/financeService.test.ts` estaba en el plan y no hizo falta tocarlo: sus pruebas de reparto usan movimientos sin cuenta o con cuenta del mismo titular y siguen en verde.
- Las deudas no tienen edición: una deuda guardada como conjunta en un perfil antes de 0.2.7 sigue conjunta. Solo cambia a qué cuenta se carga su cuota cuando no tiene cuenta de pago; el total del perfil no varía.
- Fuera de alcance: un traspaso entre la cuenta de una persona y la conjunta sigue moviendo el cierre individual sin aparecer en ingresos ni gastos (ya ocurría antes).

## Evidence

<!-- ospec:evidence:start -->
- ev-1: repro-run-pair for repro-test (2026-11-16T07:45:38.740Z)
- ev-2: check-run for checks-pass (2026-11-16T07:46:52.587Z)
- ev-3: adr-impact-declaration for adr-impact-declaration (2026-11-16T07:46:52.587Z)
- ev-4: migration-test for migration-compat-and-test (2026-11-16T07:47:42.059Z)
- ev-5: check-run for checks-pass (2026-11-16T07:48:17.175Z)
- ev-6: adr-impact-declaration for adr-impact-declaration (2026-11-16T07:48:17.175Z)
- ev-7: living-doc-current for living-doc (2026-11-16T07:48:17.260Z)
<!-- ospec:evidence:end -->
