# Diseño de Sistema: Persistencia Eficiente y Algoritmo de Correlación

## 1. Diseño Criptográfico y Persistencia Eficiente por Diffing

Actualmente, las escrituras en lote de `storageService.ts` destruyen el rendimiento al crecer el volumen:
```typescript
// Actual: saveStoredTransactions re-encripta y re-escribe todas las transacciones
await idb.clearStore('transactions');
await idb.saveEntitiesBulk('transactions', encryptedTransactions);
```

### Arquitectura Propuesta (Diffing en Memoria):
Para evitar cambios invasivos en el ciclo de vida de React, los hooks de dominio y el contrato de `useFinanzas`, implementaremos un mecanismo de **dirty tracking / diffing** local en `storageService.ts` utilizando una caché en memoria (`Map`).

1. **Inicialización de Caché:**
   Al leer las entidades mediante `readStoredTransactions` y `readStoredDebts`, se poblará un mapa en memoria con el estado descifrado de las transacciones y deudas:
   ```typescript
   let transactionCache: Map<string, Transaction> | null = null;
   let debtCache: Map<string, Debt> | null = null;
   ```

2. **Escritura Incremental en Lote (`saveStoredTransactionsStrict` y `saveStoredDebtsStrict`):**
   Al recibir la llamada de persistencia masiva habitual (vía `useEffect` o restauración), se comparará el nuevo array con la caché en memoria:
   * **Eliminados:** Cualquier registro en la caché que no esté en el array entrante se eliminará con `idb.deleteSingleEntity(id)`.
   * **Nuevos/Modificados:** Cualquier registro del array entrante que no esté en la caché, o cuyo contenido sea diferente (comprobado vía comparación rápida estructurada/JSON), se cifrará y guardará con `idb.saveSingleEntity`.
   * **Actualización de Caché:** Se sincroniza la caché en memoria con el nuevo array.

Esto reduce el costo de la escritura de un solo elemento de $O(N)$ operaciones criptográficas y escrituras de disco a $O(1)$, manteniendo la compatibilidad al 100% con todos los efectos y componentes existentes en la SPA.


---

## 2. Ventana de Tolerancia Bancaria T+2 en Traspasos

El algoritmo en `statementImportService.ts` requiere flexibilidad de hasta 48 horas laborables (fines de semana/festivos).

### Heurística Actual:
```typescript
income.date === expense.date
```

### Heurística Rediseñada:
```typescript
const dateDist = getDateDistanceDays(expense.date, income.date);
const isDateWithinRange = dateDist !== undefined && dateDist <= 2;
```

Para evitar falsos positivos con importes idénticos en fechas cercanas (por ejemplo, dos compras en supermercados distintos por el mismo valor), se reforzará la verificación:
1. Las transacciones deben tener nombres de entidades/conceptos que indiquen traspaso (verificación `hasTransferEvidence` ya implementada).
2. Se priorizará el emparejamiento con la fecha de menor distancia temporal si existen múltiples candidatos con el mismo importe en la ventana de 2 días.
