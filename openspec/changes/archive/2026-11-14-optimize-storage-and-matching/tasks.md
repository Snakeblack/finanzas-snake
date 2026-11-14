Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

# Tareas de Implementación

## 1. Capa de Base de Datos y Persistencia (Diffing en Memoria y Seguridad)
- [x] Implementar la inicialización de mapas de caché (`transactionCache`, `debtCache`) durante las lecturas de IndexedDB en `src/services/storageService.ts`.
- [x] Modificar `saveStoredTransactionsStrict` y `saveStoredDebtsStrict` para realizar diffing con la caché y ejecutar escrituras/eliminaciones incrementales ($O(1)$) mediante `idb.saveSingleEntity` e `idb.deleteSingleEntity`.
- [x] Cachear la conexión de la base de datos (`cachedDb`) en `IndexedDBProvider` para evitar fugas de conexiones y agotamiento del pool del navegador.
- [x] Implementar salvaguarda `isStorageLocked` para abortar escrituras si la base de datos está bloqueada sin llave de descifrado en RAM.
- [x] Propagar los errores de lectura en IndexedDB (`readStoredTransactions`, `readStoredDebts`, `readStoredPeriods`) para impedir el borrado silencioso por auto-guardado reactivo en la UI.
- [x] Optimizar la comparación del diffing reemplazando `JSON.stringify` por comparadores de propiedades estructurados directos (`isTransactionEqual` e `isDebtEqual`).
- [x] Prevenir la ejecución de la migración silenciosa si el almacenamiento está cifrado y bloqueado en startup para evitar la pérdida total de datos legacy.
- [x] Serializar inicializaciones concurrentes de IndexedDB mediante el caching de la promesa activa de conexión (`initPromise`).
- [x] Implementar manejadores `onversionchange` y `onclose` en el pool para invalidar la conexión cacheada si se cierra de forma externa.
- [x] Batching transaccional: implementar `idb.executeBatch` para realizar todos los puts y deletes en una sola transacción de IndexedDB, optimizando la persistencia $O(1)$ masiva.
- [x] Acotar el rango de periodos generados a +/- 10 años para proteger contra thread hangs y out-of-memory por fechas corruptas en el pasado.
- [x] Añadir pruebas unitarias para migración pospuesta, executeBatch y acotamiento de periodos en `storageService.test.ts`.

## 2. Algoritmo de Correlación Bancaria (SEPA & Bizum)
- [x] Modificar `correlateInternalTransfers` en `src/services/statementImportService.ts` para aceptar una ventana temporal de hasta 2 días (`getDateDistanceDays(expense.date, income.date) <= 2`).
- [x] Validar el orden cronológico en la correlación (`expense.date <= income.date`) previniendo emparejamientos imposibles hacia atrás en el tiempo.
- [x] Detección de duplicados robusta: excluir palabras de parada genéricas (`STATEMENT_CONCEPT_STOP_WORDS`) del token matching de descripciones en `detectDuplicates` para evitar falsos positivos.
- [x] Detección Bizum: añadir soporte para "Bizum" como evidencia de transferencia en la lógica de parseo y conciliación.
- [x] Añadir pruebas unitarias para desfases de 1 y 2 días, Bizum, y exclusión de stop words en duplicados en `statementImportService.test.ts`.
