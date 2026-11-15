# h2-statement-import

## Intent and acceptance

Importación de extractos: dos filas idénticas legítimas comparten huella y la segunda no se puede importar; un traspaso de viernes a lunes no se empareja porque la ventana cuenta días naturales y no desempata

Acceptance: Un extracto con dos filas idénticas (misma fecha, importe, tipo, concepto y cuenta) importa ambas como movimientos distintos y reimportarlo no duplica ninguna; un gasto del viernes y un ingreso del lunes siguiente en otra cuenta, con indicios de traspaso, se emparejan como un único traspaso

## Plan

<!-- ospec:plan:start -->
- Files: `docs/roadmap.md`, `src/__tests__/statementImportService.test.ts`, `src/services/statementImportService.ts`
<!-- ospec:plan:end -->

## Decisions

<!-- ospec:decisions:start -->
- La primera aparición de una fila conserva la huella anterior y las filas idénticas siguientes del mismo adjunto añaden su orden (|#n) al origen de la huella: lo ya guardado se reconoce sin migrar datos
- detectDuplicates empareja uno a uno en dos pasadas: primero huella o correlación de traspaso, después traspaso manual y coincidencia exacta por concepto; un traspaso guardado se reclama por lado (origen y destino)
- El aviso de posible duplicado ignora los movimientos guardados que ya cubre otra fila del lote
- La ventana de traspasos cuenta días hábiles (lunes a viernes, sin festivos) en (fecha del gasto, fecha del ingreso], máximo 2; gana el candidato más cercano si lo es en ambos sentidos y en empate no se empareja; los candidatos ya emparejados no se excluyen para que el resultado no dependa del orden
<!-- ospec:decisions:end -->

- La prueba «no correlaciona T+3» usaba viernes 1 → lunes 4 de mayo de 2026, que con días hábiles es T+1; por decisión del propietario pasa a lunes 4 → jueves 7 (T+3 hábil real).
- Los festivos no se descuentan porque no hay calendario: un traspaso que cruza un festivo entre semana puede quedar fuera de la ventana y se empareja a mano.

## Evidence

<!-- ospec:evidence:start -->
- ev-1: repro-run-pair for repro-test (2026-11-15T20:57:43.514Z)
- ev-2: check-run for checks-pass (2026-11-15T20:58:47.686Z)
- ev-3: adr-impact-declaration for adr-impact-declaration (2026-11-15T20:58:47.686Z)
- ev-4: check-run for checks-pass (2026-11-15T20:59:26.070Z)
- ev-5: adr-impact-declaration for adr-impact-declaration (2026-11-15T20:59:26.070Z)
- ev-6: living-doc-current for living-doc (2026-11-15T20:59:26.188Z)
<!-- ospec:evidence:end -->
