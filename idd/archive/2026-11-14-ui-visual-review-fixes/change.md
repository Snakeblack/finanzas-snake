# ui-visual-review-fixes

## Intent and acceptance

Corregir cinco fallos de usabilidad detectados en la revision visual: color-scheme en tema claro, etiquetas de perfil en movil, boton de enviar del asesor en movil, campos recortados en Deudas y boton de guardar fuera de vista en Gastos e Ingresos

Acceptance: En tema claro el icono de calendario es visible; en movil los perfiles se distinguen y el boton de enviar del asesor tiene nombre accesible; los campos TIN, TAE/CER y Fecha de Inicio no se recortan; el boton de guardar transaccion queda visible a 1440x900; todos los tests pasan

## Plan

<!-- ospec:plan:start -->
- Files: `src/__tests__/visualReviewFixes.test.tsx`, `src/components/App.tsx`, `src/components/ai/AiTab.tsx`, `src/components/debts/DebtsTab.tsx`, `src/components/transactions/TransactionsTab.tsx`, `styles.css`
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- El boton de guardar transaccion se fija al pie de la tarjeta con position sticky y una sombra del color de la tarjeta que cubre su relleno inferior, porque el margen negativo deja un hueco doble al final del scroll
- En movil el selector de perfil muestra el nombre completo truncado con puntos suspensivos en lugar de sus tres primeras letras, que coinciden cuando los nombres comparten prefijo
<!-- ospec:decisions:end -->

## Evidence

<!-- ospec:evidence:start -->
- ev-1: repro-run-pair for repro-test (2026-11-14T08:10:30.782Z)
- ev-2: check-run for checks-pass (2026-11-14T08:43:00.565Z)
- ev-3: migration-test for migration-compat-and-test (2026-11-14T08:43:15.939Z)
- ev-4: check-run for checks-pass (2026-11-14T08:43:19.091Z)
- ev-5: living-doc-current for living-doc (2026-11-14T08:43:19.144Z)
<!-- ospec:evidence:end -->
