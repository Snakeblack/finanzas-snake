# h1-data-integrity

## Intent and acceptance

H1 integridad de datos: «Configurar cuenta» conserva los periodos, cuentas y periodos se guardan en una sola operación atómica y el orden manual de movimientos se guarda

Acceptance: (1) Con varios meses y recurrentes, guardar «Configurar cuenta» sin cambiar el mes de inicio deja los mismos periodos y movimientos y tras recargar no hay recurrentes duplicados; (2) guardar cuentas o periodos nunca vacía el almacén en un paso aparte: un fallo a mitad deja los datos anteriores; (3) tras reordenar a mano movimientos del mismo día y recargar, se ven en el orden elegido

## Plan

<!-- ospec:plan:start -->
- Files: `docs/api/backup-format.md`, `docs/roadmap.md`, `setupTests.ts`, `src/__tests__/FinanzasContext.test.tsx`, `src/__tests__/h1DataIntegrity.test.ts`, `src/__tests__/storageService.test.ts`, `src/components/transactions/TransactionsTab.tsx`, `src/context/FinanzasContext.tsx`, `src/hooks/useFinancialSelectors.ts`, `src/services/db/idbProvider.ts`, `src/services/schema.ts`, `src/services/storageService.ts`, `src/types/index.ts`, `src/utils/backupValidator.ts`, `src/utils/dateUtils.ts`, `src/utils/transactionOrder.ts`
- Work units: 3
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- «Configurar cuenta» rechaza con un aviso un mes de inicio posterior al primero existente; uno anterior añade meses vacíos y traslada la apertura manual (reconfigurePeriods, función pura en dateUtils)
- Cuentas y periodos se sustituyen en una sola transacción de IndexedDB (replaceAllEntities) que aborta si una escritura lanza; la escritura por entidad queda para H6
- El orden manual es un campo opcional sortIndex por movimiento, asignado a todos los del día al arrastrar; viaja en copia y sincronización sin cambiar la versión del formato porque solo añade
- El doble de IndexedDB de las pruebas restaura el almacén al abortar y rechaza valores no clonables, para poder probar la atomicidad
<!-- ospec:decisions:end -->

## Evidence

<!-- ospec:evidence:start -->
- ev-1: repro-run-pair for repro-test (2026-11-15T08:35:06.996Z)
- ev-2: migration-test for migration-compat-and-test (2026-11-15T08:35:30.688Z)
- ev-3: check-run for checks-pass (2026-11-15T08:36:21.360Z)
- ev-4: contract-spec-and-test for contract-spec-and-test (2026-11-15T08:36:21.360Z)
- ev-5: adr-impact-declaration for adr-impact-declaration (2026-11-15T08:36:21.360Z)
- ev-6: living-doc-current for living-doc (2026-11-15T08:36:29.321Z)
<!-- ospec:evidence:end -->
