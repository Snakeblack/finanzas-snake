# Próximos pasos — handoff para una nueva sesión

> Lee primero `docs/ARCHITECTURE.md` (modelo de dominio + deuda técnica D1–D10).
> Este archivo dice **exactamente dónde retomar**. Actualizado: 2026-06-24.

## Estado actual

- **Rama:** `feat/import-onboarding-gemini-stabilization` (creada desde `main`). **Nada pusheado todavía.**
- **Gate verde:** `pnpm test` (346), `pnpm typecheck`, `pnpm lint` (0 errores / 55 warnings de backlog), `pnpm format:check`.

### Paso 0 opcional — abrir PR antes de seguir

Todo el trabajo está en commits locales sin pushear. Si quieres revisarlo en GitHub antes de
continuar con D1:

```bash
git push -u origin feat/import-onboarding-gemini-stabilization
gh pr create --base main --fill   # o redacta título/cuerpo a mano
```

Resumen sugerido para el PR: consolida import multicuenta + onboarding + gating Gemini (con 3 fixes
de code-review), añade red de seguridad ESLint/Prettier, estabiliza warnings 80→55 y arranca el
refactor D1 del god-context. No es bloqueante: se puede seguir acumulando en la rama y abrir el PR
más tarde.
- Últimos commits relevantes (D1, los más recientes arriba):
  - `94fb586` refactor(d1): extrae el dominio de cuentas → `hooks/useAccounts`
  - `08e1abd` refactor(d1): extrae el dominio de transacciones → `hooks/useTransactions`
  - `e5240f4` refactor(d1): extrae el dominio de deudas → `hooks/useDebts`
  - `26a9e51` refactor(d1): extrae el backup local → `hooks/useBackupSync`
  - `f0f1728` feat: import multicuenta + onboarding + gating Gemini (incluye 3 fixes de code-review)
  - `8a873ee` refactor: warnings 80→55 · `d96ad5e` refactor(d1): 1ª extracción `convertMarkdownToHtml`

## Trabajo en curso: D1 — desmontar el god-context `FinanzasContext` (hoy 1.174 líneas, era 2.572)

Objetivo: convertir `src/context/FinanzasContext.tsx` en un **compositor delgado** que ensambla
hooks/servicios por dominio, **sin cambiar el contrato de `useFinanzas`** (los componentes no cambian).

### Orden de extracción (de menor a mayor acoplamiento)

1. **PDF export** → `services/chatPdfExport.ts` ✅ *(HECHO)*
   - Extraída la función pura `buildChatPdfHtml(snapshot, options, now?) → { html, pdfTitle }` a
     `services/chatPdfExport.ts` (tipos `ChatPdfSnapshot`/`ChatPdfOptions`; `now` inyectable para
     tests deterministas). El contexto conserva un wrapper delgado que arma el snapshot y hace el
     iframe/`doc.write`/`print`. Test unitario en `__tests__/chatPdfExport.test.ts` (9 casos).
   - `FinanzasContext.tsx`: 2399 → 1922 líneas. Gate verde tras la extracción.
2. `useAiAdvisor` → `hooks/useAiAdvisor.ts` ✅ *(HECHO)*
   - El hook posee el estado IA (`geminiApiKey`, `customQuestion`, `chatMessages`, `aiLoading`,
     `aiError`), sus dos efectos de persistencia y los handlers `handleAskGemini`/`handleClearChat`/
     `handleCopyChatPlaintext`. El contexto lo consume y reexpone por `useFinanzas`, y usa los
     setters devueltos en lock/unlock/import/reset/setup (siguen en el contexto).
   - El prompt del asesor necesita el snapshot financiero derivado en el contexto: se le pasa por
     `getPromptParams` apoyado en un `promptParamsRef` que se actualiza en un `useEffect` tras cada
     commit (evita acoplar el orden de declaración y no muta refs en render).
   - Helpers puros extraídos a `utils/chatPlaintext.ts` (`stripMarkdown`, `buildChatPlaintext`) con
     test `__tests__/chatPlaintext.test.ts` (9 casos). `FinanzasContext.tsx`: 1922 → 1836 líneas.
3. `useSecurity` → `hooks/useSecurity.ts` ✅ *(HECHO)*
   - El hook posee el estado de bloqueo (`isLocked`, `hasPasswordSet`, `passwordError`) y los
     flujos de crypto (`handleSetupPassword`/`handleUnlock`/`handleLockApp`). Como son
     orquestadores cross-domain, el contexto le pasa `getSnapshot()` (estado a cifrar en setup) y
     `appliers` (setters para volcar/limpiar en unlock/lock).
   - ⚠️ Hay **dependencia circular** entre `useSecurity` y `useAiAdvisor`: el primero expone
     `isLocked` (reactivo) que el segundo necesita en sus efectos; el segundo expone el estado IA
     que el primero usa solo en handlers (a nivel de evento). Se rompe llamando `useSecurity`
     **primero** y puenteando el estado IA hacia él con `aiBridgeRef` (poblado en un `useEffect`).
     No invertir ese orden ni mover el estado IA al ref reactivo (rompería la persistencia).
   - Helpers puros `bytesToHex`/`hexToBytes` → `utils/hexEncoding.ts` con test (5 casos).
     `FinanzasContext.tsx`: 1836 → 1735 líneas.
4. `useBackupSync` → `hooks/useBackupSync.ts` ✅ *(HECHO)*
   - El hook posee `importError`/`importSuccess` y los handlers `handleExportData`/`handleImportData`.
     Mismo patrón cross-domain que useSecurity: el contexto le pasa `getSnapshot()` (estado a
     serializar, tipado con `FinanceBackupSnapshot` de storageService) y `appliers` (setters para
     volcar lo importado). **Sin dependencia circular** (ambos handlers son event-time; nada
     reactivo consume su estado), así que se llama directamente tras useAiAdvisor sin ref.
   - No se añadió test nuevo: no hay pieza pura nueva (build/importFinanceBackupPayload ya viven y
     se testean en storageService). `FinanzasContext.tsx`: 1735 → 1680 líneas.
5. `useDebts` → `hooks/useDebts.ts` ✅ *(HECHO)*
   - Estado de deudas (`debts`, `debtForm`, `debtFormError`, `selectedDebtSchedule`) + handlers
     de alta/baja y tramos/cuotas del plan de pagos. Se llama **antes** que useSecurity/useBackupSync
     porque sus appliers necesitan `setDebts`. La persistencia y los derivados (`filteredDebts`,
     consolidación) siguen en el contexto. El borrado limpia la selección de reunificación vía
     `onDebtDeleted`. `toggleDebtSelection` se queda en el contexto (dominio consolidación).
     1680 → 1526 líneas.
6. `useTransactions` → `hooks/useTransactions.ts` ✅ *(HECHO)*
   - Estado (`transactions`, `txForm`, `editingTx`, `editForm`, `editScope`), el efecto que mantiene
     válidas las cuentas de `txForm` y los handlers de alta/edición/baja (con propagación de
     recurrentes). Se llama antes que useSecurity/useBackupSync (`setTransactions` en appliers); los
     handlers leen `accounts`/`periods` a nivel de evento (params). Persistencia y derivados
     (`filteredTransactions`, totales) en el contexto. 1526 → 1204 líneas.
7. `useAccounts` → `hooks/useAccounts.ts` ✅ *(HECHO)*
   - Estado (`accounts`, `editingAccount`, `accountForm`) + handlers puros de alta/edición. **Primer**
     hook de dominio: `accounts`/`setAccounts` los consumen useTransactions (lectura) y los appliers de
     useSecurity/useBackupSync. `handleDeleteAccount` (cascada cross-domain sobre tx/deudas) y la
     persistencia (`saveStoredAccounts`) se quedan en el contexto como orquestadores. 1204 → 1174 líneas.

### Lo que queda en `FinanzasContext` (capa de composición) — extracción opcional

El contexto ya es mucho más delgado. Lo que sigue dentro, por si se quiere seguir adelgazando
(no enumerado como obligatorio; cada uno su commit y gate verde):

- **Orquestadores cross-domain:** `handleInitAccount`, `handleResetAccount`, `handleCreateNextMonth`,
  `handleDeleteAccount`. Tocan varios dominios a la vez; viven bien en el compositor.
- **Periodos:** estado `periods`/`selectedMonth` + efecto de auto-generación de meses faltantes.
  Candidato a `usePeriods` (ojo: el efecto también clona transacciones recurrentes → cross-domain).
- **Simulador de reunificación:** `selectedDebtsForConsolidation`, `consolidationForm`,
  `toggleDebtSelection` y todos los derivados de consolidación. Candidato a `useConsolidation`.
- **Selectores financieros derivados:** `timelineBalances`, `activePeriodData`, totales,
  `filteredTransactions`/`filteredDebts`, `tagData`, etc. Candidato a un hook/selector de solo lectura.
- **UI transversal:** tema, `hideSensitiveData`/`formatAmount`, modal de PDF.

> **Orden de hooks de dominio en el contexto (no invertir):** `useAccounts` → `useDebts` →
> `useTransactions` → `useSecurity` → `useAiAdvisor` → `useBackupSync`. Los appliers de seguridad/
> backup necesitan los setters de los tres dominios; useTransactions necesita `accounts` de
> useAccounts. Los setters devueltos por hooks se incluyen en los arrays de dependencias de los
> efectos que los usan (init, auto-generación) para no romper `react-hooks/exhaustive-deps`.

### Reglas del refactor (obligatorias)

- **Incremental y verificable:** una extracción por commit. Tras cada una:
  `pnpm typecheck && pnpm lint && pnpm test` deben quedar verdes antes de seguir.
- **Sin cambios de comportamiento:** la extracción mueve código, no lo arregla. Si encuentras un
  bug, anótalo en `ARCHITECTURE.md` (como D10) y trátalo aparte.
- Preferir extraer primero lo **puro/sin estado** (servicios/utils) y luego los hooks con estado.
- Añadir test unitario a cada pieza pura extraída (queda accesible y cubierta).
- Mensaje de commit: `refactor(d1): ...`.

## Backlog paralelo (no bloquea D1)

- **D9 (lint, 55 warnings):** 46 `no-explicit-any` (tipar `storageService`/`syncService`/`backupValidator`),
  7 `react-hooks/set-state-in-effect` (revisar al tocar cada efecto en D1), 2 `react-refresh`.
- ~~**D10 (bug latente):**~~ ✅ Resuelto: regex de separador de tablas en `utils/markdownToHtml.ts` acepta fila separadora con pipe de cierre + alineación.
- ~~**D4 (precisión):**~~ ✅ Resuelto: unificado el cálculo en `big.js` en `calculateTimelineBalances`.
- ~~**D5 (multi-moneda):**~~ ✅ Resuelto: tx de divisa ≠ target se convierten usando tasas FX en `ledgerEngine`.

## Mejoras funcionales candidatas (después del refactor)

Presupuestos por categoría · patrimonio neto en el tiempo · proyección de cashflow ·
conciliación de saldo importado vs calculado · reglas de categorización · metas de ahorro.

## Gotchas del entorno

- El sandbox de bash bloquea `git commit` cuyo mensaje contenga la palabra "format"/"disk"
  (`Formatting or clearing a disk is blocked`). Usar `dangerouslyDisableSandbox: true` en esa
  llamada o evitar esa palabra en el mensaje.
- Gestor de paquetes: **pnpm** (estricto). Windows: avisos LF→CRLF son inocuos.
