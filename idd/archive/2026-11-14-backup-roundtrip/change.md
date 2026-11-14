# backup-roundtrip

## Intent and acceptance

Una copia exportada o una sincronización se reimporta siempre y conserva todos los datos

Acceptance: Exportar e importar (o sincronizar) devuelve exactamente los mismos movimientos, incluido el vínculo de serie recurrente, los mismos textos sin escapar y el mismo número de perfiles; un recurrente clonado durante muchos meses sigue teniendo un identificador que el validador acepta, y las copias con identificadores largos ya existentes se importan

## Plan

<!-- ospec:plan:start -->
- Files: `docs/api/backup-format.md`, `src/__tests__/backupRoundtrip.test.ts`, `src/__tests__/backupValidator.test.ts`, `src/__tests__/storageService.test.ts`, `src/components/sync/SyncModal.tsx`, `src/constants/index.ts`, `src/context/FinanzasContext.tsx`, `src/hooks/useBackupSync.ts`, `src/hooks/usePeriods.ts`, `src/services/storageService.ts`, `src/utils/backupValidator.ts`, `src/utils/dateUtils.ts`
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- Los clones de recurrentes usan el identificador de la serie más el mes, de longitud acotada, en lugar de encadenar el del clon anterior
- El validador acepta los identificadores largos ya existentes en lugar de reescribirlos: el formato solo añade (ADR 0005)
- La validación deja de escapar HTML: el texto se guarda como llegó y se escapa al presentarlo (ADR 0008)
- Las copias y la sincronización llevan una marca de formato (finanzas_backup_format); una carga sin marca es anterior y sus textos se decodifican antes de validarla
- Los datos guardados en el dispositivo se reparan una sola vez al arrancar o desbloquear, con una bandera en la configuración de IndexedDB
- El volcado de lo importado al estado es una sola función (applyImportedBackup) que comparten la copia en archivo y la sincronización
<!-- ospec:decisions:end -->

## Evidence

<!-- ospec:evidence:start -->
- ev-1: repro-run-pair for repro-test (2026-11-14T19:18:45.351Z)
- ev-2: migration-test for migration-compat-and-test (2026-11-14T19:20:36.046Z)
- ev-3: check-run for checks-pass (2026-11-14T19:21:07.637Z)
- ev-4: contract-spec-and-test for contract-spec-and-test (2026-11-14T19:21:07.637Z)
- ev-5: adr-impact-declaration for adr-impact-declaration (2026-11-14T19:21:07.637Z)
- ev-6: living-doc-current for living-doc (2026-11-14T19:21:42.945Z)
<!-- ospec:evidence:end -->
