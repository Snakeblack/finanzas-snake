# h2-recurring-and-periods

## Intent and acceptance

H2-A recurrentes y periodos: los movimientos de meses sin periodo se ven y cuentan, la proyección cuenta cada recurrente una vez y «solo este» no corta la serie

Acceptance: (1) Importar, anotar o editar un movimiento con fecha en un mes sin periodo deja ese mes en la lista y el movimiento cuenta en ingresos, gastos y saldos; (2) con un recurrente de 100 € repetido seis meses, cada mes proyectado suma 100 €, no 600 €; (3) tras editar o borrar «solo este» en el último mes, al crear el mes siguiente (a mano o al abrir la aplicación) la serie sigue

## Plan

<!-- ospec:plan:start -->
- Files: `docs/api/backup-format.md`, `docs/roadmap.md`, `src/__tests__/backupRoundtrip.test.ts`, `src/__tests__/h2RecurringPeriods.test.ts`, `src/__tests__/h2RecurringPeriods.test.tsx`, `src/components/transactions/ImportStatementModal.tsx`, `src/context/FinanzasContext.tsx`, `src/hooks/usePeriods.ts`, `src/hooks/useTransactions.ts`, `src/services/financeService.ts`, `src/services/schema.ts`, `src/services/storageService.ts`, `src/types/index.ts`, `src/utils/backupValidator.ts`, `src/utils/dateUtils.ts`
- Work units: 3
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- Los meses que faltan para los movimientos los crea una única función pura (ensurePeriodsForTransactions en dateUtils) que el contexto aplica cada vez que cambian movimientos o periodos: cubre importar, anotar, editar, copias y sincronización sin tocar cada camino. Meses anteriores e intermedios vacíos; posteriores con los recurrentes clonados mes a mes
- El saldo inicial de las cuentas se ancla en el mes con apertura manual; al añadir meses por delante sin ninguno marcado, el antiguo primer mes pasa a ser la apertura manual para que el ancla no se mueva
- El motor de saldos calcula hacia atrás los meses anteriores al ancla restando su efecto neto al saldo inicial antes del recorrido hacia delante, que no cambia: sigue habiendo un solo motor (ADR 0004)
- La proyección suma una vez por mes los clones que cloneRecurringForMonth produciría para el mes siguiente al último, en lugar de todas las instancias de recurrentes del historial
- «Solo este» (editar o borrar) en el último mes guarda la instancia tal como estaba en el campo opcional Period.skippedRecurring; cloneRecurringForMonth la usa para seguir la serie cuando el mes no tiene otra instancia de ella. «Este y los siguientes» y «todos» la actualizan o la quitan. Viaja en copia y sincronización sin cambiar la versión 2 del formato
- Descartado guardar los borrados como movimientos ocultos: obligaría a filtrarlos en saldos, listas, asistente de IA, importación y sincronización
- Un movimiento solo crea meses dentro de diez años antes o después del actual, el mismo margen que ya usa readStoredPeriods al generar periodos: una fecha absurda (1970 de un dato antiguo sin fecha, un año mal tecleado) no genera cientos de meses
<!-- ospec:decisions:end -->

- Prior decision (memory): Copias y sincronización de ida y vuelta, los clones de recurrentes usan `<serie>-<YYYY-MM>` -> src/utils/dateUtils.ts (cloneRecurringForMonth): current
- Prior decision (memory): el orden manual (`sortIndex`) viaja en copia y sincronización como campo opcional sin cambiar la versión 2 -> idd/archive/2026-11-15-h1-data-integrity/change.md: current

## Evidence

<!-- ospec:evidence:start -->
- ev-1: repro-run-pair for repro-test (2026-11-15T13:24:05.032Z)
- ev-2: check-run for checks-pass (2026-11-15T13:24:42.568Z)
- ev-3: contract-spec-and-test for contract-spec-and-test (2026-11-15T13:24:42.568Z)
- ev-4: migration-test for migration-compat-and-test (2026-11-15T13:25:30.954Z)
- ev-5: check-run for checks-pass (2026-11-15T13:27:04.191Z)
- ev-6: contract-spec-and-test for contract-spec-and-test (2026-11-15T13:27:04.191Z)
- ev-7: adr-impact-declaration for adr-impact-declaration (2026-11-15T13:27:04.191Z)
- ev-8: migration-test for migration-compat-and-test (2026-11-15T13:27:12.841Z)
- ev-9: check-run for checks-pass (2026-11-15T13:27:30.002Z)
- ev-10: contract-spec-and-test for contract-spec-and-test (2026-11-15T13:27:30.002Z)
- ev-11: adr-impact-declaration for adr-impact-declaration (2026-11-15T13:27:30.002Z)
- ev-12: living-doc-current for living-doc (2026-11-15T13:27:30.100Z)
<!-- ospec:evidence:end -->
