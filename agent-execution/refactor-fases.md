# ESPECIFICACIÓN TÉCNICA DE REFACTORIZACIÓN: FINANZAS-SNAKE V4

## OBJETIVO ARQUITECTÓNICO
Migrar la capa de persistencia de `localStorage` síncrono a **IndexedDB asíncrono con soporte transaccional ACID**. Introducir el principio de **Inmutabilidad (Event Sourcing)** en la gestión de saldos, implementar precisión matemática arbitraria (`big.js`) con soporte **multi-divisa**, y orquestar una **migración silenciosa automatizada** diferida al momento del desbloqueo criptográfico.

---

## FASE 1: DEPENDENCIAS Y MODELO DE DOMINIO (PRECISIÓN + MULTI-DIVISA)

### 1.1 Modificación de `package.json`
Añadir la librería de precisión arbitraria para evitar los errores de redondeo de punto flotante nativos de JavaScript en operaciones contables.

```json
{
  "dependencies": {
    "big.js": "^6.2.5"
  },
  "devDependencies": {
    "@types/big.js": "^6.2.2"
  }
}
```

### 1.2 Refactor de Modelos en `src/types/index.ts`
Sustituir la propiedad mutable `amount: number` por el *Value Object* inmutable `Money`.

```typescript
export type CurrencyCode = 'EUR' | 'USD' | 'GBP';

export type Money = {
  readonly amount: string; // Serializado estrictamente como string para preservar precisión en el almacenamiento
  readonly currency: CurrencyCode;
};

export type Transaction = {
  readonly id: string;
  readonly desc: string;
  readonly money: Money; // Refactor de campo numérico plano a Value Object
  readonly type: TransactionType;
  readonly tag: string;
  readonly date: string; // Formato YYYY-MM-DD
  readonly recurrence?: TransactionRecurrence;
  readonly originId?: string;
  readonly owner?: 'userA' | 'userB' | 'joint';
  readonly paidBy?: 'userA' | 'userB' | 'shared';
  readonly accountId?: string;
  readonly fromAccountId?: string;
  readonly toAccountId?: string;
};
```

### 1.3 Adaptación del Motor de Cálculo en `src/services/financeService.ts`
Implementar funciones puras de agregación financiera aislando las operaciones aritméticas mediante `big.js`.

```typescript
import Big from 'big.js';
import type { Money, CurrencyCode } from '../types';

/**
 * Agrega una colección de objetos Money asegurando consistencia de divisa.
 */
export const sumMoney = (values: Money[], targetCurrency: CurrencyCode): Money => {
  const total = values.reduce((acc, curr) => {
    if (curr.currency !== targetCurrency) {
      throw new Error(`Operación multi-divisa no soportada sin estrategia FX explícita: ${curr.currency} a ${targetCurrency}`);
    }
    return acc.plus(new Big(curr.amount));
  }, new Big('0.00'));

  return { 
    amount: total.toFixed(2), 
    currency: targetCurrency 
  };
};
```

---

## FASE 2: MOTOR CONTABLE DETERMINISTA (EVENT SOURCING)

### 2.1 Creación de `src/services/ledgerEngine.ts`
Crear el motor encargado de proyectar los saldos en tiempo de ejecución. El saldo ya no se lee de una propiedad mutable de la cuenta, sino que se calcula reduciendo el historial inmutable de transacciones ordenadas cronológicamente.

```typescript
import Big from 'big.js';
import type { Transaction, Account, CurrencyCode } from '../types';

/**
 * Proyecta los saldos reales de las cuentas procesando secuencialmente el flujo inmutable de transacciones.
 */
export const computeCurrentBalances = (
  accounts: Account[],
  transactions: Transaction[],
  targetCurrency: CurrencyCode = 'EUR'
): Record<string, string> => {
  const balances: Record<string, Big> = {};

  // Inicializar saldos con el balance de apertura de cada cuenta
  accounts.forEach(acc => {
    balances[acc.id] = new Big(acc.initialBalance.toString());
  });

  // Ordenación cronológica estricta para garantizar consistencia temporal
  const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  sortedTx.forEach(tx => {
    if (tx.money.currency !== targetCurrency) return; // Omitir temporalmente descalces de FX
    const amt = new Big(tx.money.amount);

    if (tx.type === 'income' && tx.accountId) {
      balances[tx.accountId] = (balances[tx.accountId] || new Big(0)).plus(amt);
    } else if (tx.type === 'expense' && tx.accountId) {
      balances[tx.accountId] = (balances[tx.accountId] || new Big(0)).minus(amt);
    } else if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
      balances[tx.fromAccountId] = (balances[tx.fromAccountId] || new Big(0)).minus(amt);
      balances[tx.toAccountId] = (balances[tx.toAccountId] || new Big(0)).plus(amt);
    }
  });

  const result: Record<string, string> = {};
  Object.keys(balances).forEach(id => {
    result[id] = balances[id].toFixed(2);
  });
  return result;
};
```

---

## FASE 3: PERSISTENCIA ASÍNCRONA (INDEXEDDB) Y MIGRACIÓN SILENCIOSA

### 3.1 Creación del Proveedor de Base de Datos `src/services/db/idbProvider.ts`
Encapsular el acceso asíncrono a la API nativa de IndexedDB del navegador utilizando transacciones ACID estructuradas para evitar corrupción de datos por cierres inesperados del hilo principal.

```typescript
import type { Transaction } from '../../types';

export class IndexedDBProvider {
  private dbName = 'FinanzasProDB_v4';
  private version = 1;

  public initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTransactionsBulk(txs: Transaction[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('transactions', 'readwrite');
      const store = transaction.objectStore('transactions');
      
      txs.forEach(tx => store.put(tx));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllTransactions(): Promise<Transaction[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('transactions', 'readonly');
      const request = transaction.objectStore('transactions').getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 3.2 Inyección de la Migración Silenciosa Diferida en `src/services/storageService.ts`
Implementar el mecanismo transparente que migra los datos de `localStorage` a IndexedDB. Al ser una migración diferida, se ejecuta automáticamente en segundo plano en el momento en el que la clave criptográfica pasa a estar activa en memoria RAM, permitiendo guardar los datos limpios y estructurados.

```typescript
import { IndexedDBProvider } from './db/idbProvider';
import type { Transaction } from '../types';

const idb = new IndexedDBProvider();

/**
 * Realiza una migración única, transparente y transaccional desde localStorage hacia IndexedDB.
 * Se invoca automáticamente tras el descifrado exitoso inicial de la base de datos.
 */
export const executeSilentMigrationIfRequired = async (decryptedTransactions: Transaction[]): Promise<void> => {
  const MIGRATION_FLAG = 'finanzas_v4_idb_migrated';
  if (localStorage.getItem(MIGRATION_FLAG) === 'true') return;

  try {
    if (decryptedTransactions.length > 0) {
      // Escritura transaccional en lote
      await idb.saveTransactionsBulk(decryptedTransactions);
    }
    // Confirmación del éxito del proceso para evitar re-ejecuciones
    localStorage.setItem(MIGRATION_FLAG, 'true');
    console.info('Migración silenciosa a IndexedDB completada con éxito.');
  } catch (error) {
    console.error('Error crítico no recuperable en el proceso de migración silenciosa:', error);
  }
};
```

---

## FASE 4: INVERSIÓN DE DEPENDENCIAS EN LA CAPA DE RED (P2P SYNC)

### 4.1 Refactor de `src/services/syncService.ts`
Aplicar el principio DIP (Inversión de Dependencias). El servicio de sincronización mediante canales WebRTC (PeerJS) debe quedar completamente ciego a la estrategia de almacenamiento (ya no lee variables cableadas de `localStorage`), delegando la extracción de datos en un contrato inyectado (`ISyncDataProvider`).

```typescript
import { Peer } from 'peerjs';

export interface ISyncDataProvider {
  exportPayload(): Promise<Record<string, any>>;
}

export interface HostCallbacks {
  onCodeGenerated: (code: string) => void;
  onConnectionEstablished: () => void;
  onDataSent: () => void;
  onError: (err: any) => void;
}

/**
 * Orquesta la sincronización P2P abstrayendo por completo el origen de datos (DIP).
 */
export const startSyncHost = (
  callbacks: HostCallbacks,
  dataProvider: ISyncDataProvider, // Dependencia pura inyectada
  customIceServers?: any[]
): { destroy: () => void } => {
  let peer: Peer | null = null;
  let isDestroyed = false;

  const initPeer = () => {
    peer = new Peer(undefined, { /* ... peer config ... */ });

    peer.on('connection', (conn) => {
      conn.on('open', async () => {
        if (isDestroyed) return;
        try {
          // Extracción puramente asíncrona estructurada desde el proveedor inyectado
          const payload = await dataProvider.exportPayload();
          
          conn.send({
            type: 'FINANZAS_PRO_SYNC',
            payload
          });

          setTimeout(() => { 
            if (!isDestroyed) callbacks.onDataSent(); 
          }, 600);
        } catch (err) {
          callbacks.onError(err);
        }
      });
    });
  };

  initPeer();
  return { 
    destroy: () => { 
      isDestroyed = true; 
      peer?.destroy(); 
    } 
  };
};
```

---

## DIRECTRICES DE EJECUCIÓN PARA EL AGENTE DE IA
"Por favor, procesa esta especificación paso a paso de manera secuencial. Comienza aplicando el refactor de tipos en `src/types/index.ts` y utiliza el compilador de TypeScript para resolver en cascada todas las referencias rotas que trataban el dinero como un primitivo mutable. Por último, acopla la función `executeSilentMigrationIfRequired` dentro del hook de inicialización del estado una vez que la clave en `storageService.ts` haya sido activada con éxito."