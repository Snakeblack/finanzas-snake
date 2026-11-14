# ui-ux-taste-skill

## Intent and acceptance

Refactor visual y de usabilidad/posicionamiento en toda la aplicacion bajo Leonxlnx/taste-skill (design-taste-frontend), ignorando .npmrc y artefactos locales de skills en git

Acceptance: La interfaz completa (cabecera, barra de control, KPIs, 6 pestañas y modales) aplica la jerarquia visual, posicionamiento y usabilidad de design-taste-frontend manteniendo intacta la logica financiera y todos los tests pasando

## Plan

<!-- ospec:plan:start -->
- Files: `.gitignore`, `src/components/App.tsx`, `src/components/accounts/AccountsTab.tsx`, `src/components/ai/AiTab.tsx`, `src/components/consolidation/ConsolidationTab.tsx`, `src/components/dashboard/OverviewTab.tsx`, `src/components/debts/DebtsTab.tsx`, `src/components/sync/SyncModal.tsx`, `src/components/transactions/EditTransactionForm.tsx`, `src/components/transactions/TransactionsTab.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/input.tsx`, `src/components/ui/select.tsx`, `styles.css`
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- Adoptar el sistema visual de design-taste-frontend (Leonxlnx/taste-skill): una sola jerarquia de superficies (--background, --card, --muted), bordes de 1px con realce superior sutil, espaciado y alineacion de bordes uniformes, y micro-interacciones de hover/press (elevacion de 1-2px, escala 0.985) manteniendo soporte claro/oscuro
- Reestructurar la barra de navegacion y controles globales en App.tsx para mejorar usabilidad: agrupar el selector de periodo y perfil con la navegacion y mostrar los KPIs mensuales con jerarquia compacta en todas las vistas operativas
- Unificar tokens de color en todas las pestañas eliminando clases hardcodeadas de modo oscuro (bg-slate-950, text-slate-100) en favor de variables semanticas (bg-card, bg-muted, text-foreground) para consistencia visual en modo oscuro y claro
<!-- ospec:decisions:end -->

## Evidence

<!-- ospec:evidence:start -->
- ev-1: check-run for checks-pass (2026-11-14T01:00:28.170Z)
- ev-2: check-run for checks-pass (2026-11-14T01:26:50.694Z)
- ev-3: migration-test for migration-compat-and-test (2026-11-14T01:27:53.862Z)
- ev-4: check-run for checks-pass (2026-11-14T01:28:10.706Z)
- ev-5: living-doc-current for living-doc (2026-11-14T01:28:10.812Z)
<!-- ospec:evidence:end -->
