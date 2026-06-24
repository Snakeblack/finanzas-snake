# Finanzas Snake — Arquitectura y entendimiento del dominio

> Documento vivo. Captura cómo está construida la app hoy, su modelo de dominio,
> el flujo de datos y la deuda técnica/funcional conocida. Punto de partida para
> refactors y mejoras. Última actualización: 2026-06-24.

## 1. Qué es

SPA de finanzas personales **local-first y zero-knowledge** para dos usuarios (pareja/joint).
Sin backend de datos: todo vive en el navegador.

- **Stack:** React + TypeScript + Vite + Tailwind + Radix UI. Gestor: `pnpm` (estricto).
- **Persistencia:** IndexedDB (vía `services/db/idbProvider.ts`).
- **Seguridad:** cifrado AES-GCM 256 opcional con clave derivada por PBKDF2 desde un PIN.
- **Sincronización:** P2P por WebRTC (PeerJS), sin servidor intermediario.
- **IA:** Asesor con Gemini (`gemini-3.5-flash`); la API Key la pone el usuario y se cifra localmente.
- **Despliegue:** `finanzas.mretamozo.com` (Vercel).
- **Verificación:** `pnpm test` (Vitest, 317 tests), `pnpm typecheck`, `pnpm lint` (ESLint flat config,
  0 errores / ~80 warnings de backlog), `pnpm format` (Prettier: tabs, comillas simples, printWidth 120).

## 2. Modelo de dominio (`src/types/index.ts`)

- **`Money`** — Value Object: `{ amount: string, currency: CurrencyCode }`. El importe es **string**
  para preservar precisión (se opera con `big.js`). `CurrencyCode = EUR | USD | GBP`.
- **`Account`** — cuenta (banco/efectivo): `id, name, owner (userA|userB|joint), initialBalance`.
- **`Period`** — saldo de apertura de un mes contable: `month, openingBalance, openingBalanceA?, openingBalanceB?, isManualInit?`.
- **`Transaction`** (inmutable) — `income | expense | transfer`; `money`, `tag`, `date (YYYY-MM-DD)`,
  `recurrence`, `originId` (recurrentes propagadas), `owner`, `paidBy`, `accountId`/`fromAccountId`/`toAccountId`.
- **`Debt`** = `ClassicDebt` (amortización francesa, TIN/TAE, plazo) | `PaymentPlanDebt`
  (financiación con tramos/cuotas `installments` y estado `pending|paid`).
- **`ImportedTransaction`** — fila previsualizable de importación (extracto), con `selected`,
  `isDuplicate`, `possibleDuplicate`, `importFingerprint`, `transferCorrelationId`, `balance`.
- Forms: `TxForm`, `DebtForm`, `ConsolidationForm` (strings de entrada de UI).

## 3. Mapa de módulos

### Servicios (`src/services/`)
- **`ledgerEngine.ts`** — `computeCurrentBalances`: proyecta saldos reales de cuentas recorriendo
  el flujo inmutable de transacciones con `big.js`. ⚠️ Ignora tx cuya `currency` ≠ target (no hay FX real).
- **`financeService.ts`** — matemática financiera: `sumMoney`, deducción de tag, amortización
  (`generateAmortizationSchedule`, `calculateMonthlyPayment`, planes de pago), `calculateTimelineBalances`
  (motor mes a mes), `getTagBreakdown`, `getEffectiveAmount`, `getTransactionOwner`.
- **`storageService.ts`** (1.1k) — IndexedDB + **migraciones** (`migrateTransaction/migrateDebt`,
  migración silenciosa) + backup import/export + lectores sync/async por entidad + Gemini key + chat IA.
- **`cryptoService.ts`** — AES-GCM / PBKDF2.
- **`syncService.ts`** — P2P WebRTC (PeerJS).
- **`geminiService.ts`** — asesor chat + clasificación de errores de API Key (401/403 ⇒ key inválida).
- **`statementImportService.ts`** — parseo CSV/PDF, extracción con Gemini, detección de duplicados,
  emparejado de transferencias internas, normalización de importes/saldos/fechas.
- **`db/idbProvider.ts`** — wrapper de IndexedDB.

### Estado (`src/context/`)
- **`FinanzasContext.tsx`** (2.5k) — **God-context**: ~40 `useState` + ~30 handlers. Concentra TODO:
  cuentas, transacciones, deudas, periodos, estado de UI, chat IA, lock/crypto, exportación a PDF,
  sync, importación. Se consume vía `hooks/useFinanzas.ts`.

### UI (`src/components/`)
- `App.tsx` (1.4k) — layout, tabs, onboarding/init, modales, lock screen.
- Tabs: `dashboard/OverviewTab`, `transactions/TransactionsTab`, `debts/DebtsTab`,
  `consolidation/ConsolidationTab`, `ai/AiTab`, `accounts/AccountsTab`.
- Modales/forms: `transactions/ImportStatementModal` (1.4k), `transactions/EditTransactionForm`, `sync/SyncModal`.
- `ui/` — primitivas sobre Radix (button, card, dialog, input, select). `common/` — Icons, MarkdownRenderer.

### Utils (`src/utils/`)
- `dateUtils`, `formatters`, `openingBalance`, `backupValidator`.

## 4. Flujo de datos

1. **Arranque:** `getInitialData()` (storageService) hidrata estado sync desde IndexedDB; si hay PIN,
   la app queda *locked* hasta `handleUnlock` (deriva clave, descifra).
2. **Mutaciones:** los handlers de `FinanzasContext` actualizan estado y persisten vía `saveStored*`.
3. **Cálculo:** `calculateTimelineBalances` + `computeCurrentBalances` derivan saldos para los tabs.
4. **Importación:** `statementImportService` parsea → previsualiza `ImportedTransaction[]` (duplicados,
   transferencias) → confirma → se vuelcan a `Transaction[]`.
5. **Backup/Sync:** export/import de payload cifrable; sync P2P comparte el snapshot entre dispositivos.

## 5. Deuda técnica conocida

| # | Área | Problema | Impacto |
|---|------|----------|---------|
| D1 | `FinanzasContext` | God-object: dominio + UI + crypto + PDF + IA + sync mezclados. **En progreso**: extraído `convertMarkdownToHtml`→`utils/` (2572→2399 líneas). Pendiente: PDF export (handleDownloadChatPDF), hooks `useAiAdvisor`/`useSecurity`/`useBackupSync`/`useTransactions`/`useDebts`/`useAccounts` | Altísimo coste de cambio |
| D10 | `utils/markdownToHtml` | Bug latente pre-existente: el regex de separador de tablas no acepta fila separadora con pipe de cierre + alineación (`\| :-- \| --: \|`); se trata como datos | Tablas con alineación mal renderizadas en PDF |
| D2 | `ImportStatementModal`, `App` | Componentes de ~1.4k líneas | Difíciles de mantener/revisar |
| D3 | `storageService` | Persistencia + migraciones + backup + dominio en un solo archivo (1.1k); usa `any` | Acoplamiento, riesgo en migraciones |
| D4 | **Precisión monetaria** | `ledgerEngine` usa `big.js`/string pero `calculateTimelineBalances` agrega en `number` (float) | Posibles descuadres de céntimos en la línea temporal |
| D5 | **Multi-moneda** | `CurrencyCode` admite EUR/USD/GBP pero no hay tasas FX; tx de otra moneda se ignoran | Funcionalidad incompleta y silenciosa |
| D6 | Duplicación | `normalizeAmount`/`normalizeBalance` casi idénticas; `getFallbackTag` inline duplicado; demote de transferencia en 2 sitios | Drift al cambiar reglas |
| ~~D7~~ | Tooling | ✅ Resuelto: ESLint flat config + Prettier + scripts (`lint`, `format`). Backlog de lint reducido 80→55 warnings (ver D9) | — |
| D9 | Backlog de lint | 55 warnings restantes (consciente): 46 `no-explicit-any` (migraciones/sync/backup — tipar es esfuerzo aparte), 7 `react-hooks/set-state-in-effect` (patrones de "sincronizar al abrir/por prop"; se revisarán al hacer D1), 2 `react-refresh/only-export-components` (solo afecta HMR) | Bajo; saldar gradualmente |
| D8 | Importación | Heurística de "posible duplicado" laxa (1 token ≥4 chars) | Falsos positivos de aviso |

## 6. Ideas de mejora funcional (hacia "app top")

- **Presupuestos por categoría** con alertas de sobregasto.
- **Net worth / patrimonio** en el tiempo (cuentas + deudas).
- **Proyección de cashflow** y escenarios.
- **Conciliación de cuenta**: comparar saldo importado del extracto vs saldo calculado.
- **Reglas de categorización** (motor configurable, no solo deducción por concepto).
- **Metas de ahorro / objetivos**.
- **Multi-moneda real** con tasas FX (cierra D5).

## 7. Invariantes y decisiones a respetar

- Local-first / zero-knowledge: **nada de datos a servidores**.
- `Transaction` es inmutable; el dinero se serializa como string y se opera con `big.js`.
- Duplicados exactos en importación: NO seleccionables. "Posibles duplicados": se avisan pero
  quedan seleccionados (decisión de UX intencional).
- Errores de Gemini: solo 401/403 ⇒ "API Key inválida"; 400 es request inválido (no key).
