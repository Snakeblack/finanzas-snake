# pin-setup-and-profile-count

## Intent and acceptance

El PIN se puede activar desde la interfaz y el modo de un perfil sobrevive a recargar con PIN activo

Acceptance: Sin PIN configurado, el botón de la cabecera abre la pantalla de configuración sin vaciar los datos en memoria; al confirmar un PIN válido los datos quedan cifrados y la aplicación sigue desbloqueada con los mismos datos; tras recargar y desbloquear con PIN activo, el número de perfiles guardado (1 o 2) se restaura y no se sobrescribe con 2

## Plan

<!-- ospec:plan:start -->
- Files: `src/__tests__/pinSetup.test.tsx`, `src/__tests__/useSecurity.test.tsx`, `src/components/App.tsx`, `src/context/FinanzasContext.tsx`, `src/hooks/useSecurity.ts`
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- Configurar el PIN es una acción distinta de bloquear: abre la pantalla de configuración sin limpiar el estado, porque handleSetupPassword cifra lo que hay en memoria
- El número de perfiles se añade al snapshot que se cifra al activar el PIN y a los appliers del desbloqueo, como dato obligatorio
<!-- ospec:decisions:end -->

## Evidence

<!-- ospec:evidence:start -->
- ev-1: check-run for checks-pass (2026-11-14T17:18:37.950Z)
- ev-2: repro-run-pair for repro-test (2026-11-14T17:19:07.462Z)
- ev-3: migration-test for migration-compat-and-test (2026-11-14T17:19:11.571Z)
- ev-4: check-run for checks-pass (2026-11-14T17:19:33.305Z)
- ev-5: frozen-review for trust-review (2026-11-14T17:21:49.475Z, subagent-stop)
- ev-6: frozen-review for trust-review (2026-11-14T17:23:11.175Z, subagent-stop)
- ev-7: check-run for checks-pass (2026-11-14T17:23:24.637Z)
- ev-8: migration-test for migration-compat-and-test (2026-11-14T17:23:43.140Z)
- ev-9: check-run for checks-pass (2026-11-14T17:23:56.610Z)
- ev-10: adr-impact-declaration for adr-impact-declaration (2026-11-14T17:23:56.610Z)
- ev-11: living-doc-current for living-doc (2026-11-14T17:24:03.253Z)
<!-- ospec:evidence:end -->
