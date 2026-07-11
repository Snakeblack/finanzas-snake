# Informe de Auditoría de Código y Algoritmos Financieros
**Finanzas Snake**
*Autor: Antigravity — Ingeniero de Software Principal y Auditor Financiero Automatizado*
*Fecha de auditoría: 11 de Julio de 2026*

---

## 1. Resumen Ejecutivo

Este documento presenta los resultados de la auditoría técnica y financiera automatizada realizada sobre el repositorio **Finanzas Snake**, una aplicación web cliente local-first y *zero-knowledge* diseñada para la gestión de finanzas personales, presupuestos y control de deudas.

La auditoría ha evaluado los siguientes pilares críticos:
1. **Precisión Matemática y Consistencia Temporal:** Verificación de la no filtración de errores de coma flotante binarios en operaciones monetarias y amortizaciones.
2. **Seguridad y Criptografía:** Cumplimiento con estándares OWASP en el almacenamiento local y protocolos de sincronización.
3. **Mecanismo de Importación de Extractos:** Evaluación de la robustez de las heurísticas de deduplicación y emparejado de traspasos.
4. **Calidad de Código y Deuda Técnica:** Progreso de la iniciativa de refactorización D1 (desmantelamiento del god-context) y análisis del backlog de warnings de linting.
5. **Cobertura de Pruebas:** Verificación del estado de ejecución de la suite de pruebas unitarias/integración.

---

## 2. Auditoría Financiera y de Precisión Algorítmica

### 2.1 Aritmética de Precisión Arbitraria (`Big.js`)
Las monedas e importes en Finanzas Snake se gestionan como **cadenas de caracteres (strings)** en el dominio serializado (`readonly amount: string` bajo el tipo `Money`) para evitar la pérdida de precisión inherente al formato binario IEEE 754 de JavaScript.

*   **Implementación:** Se ha verificado que la biblioteca `big.js` se utiliza consistentemente en todas las operaciones financieras críticas:
    *   `ledgerEngine.ts`: Proyección de saldos acumulativos (`computeCurrentBalances`).
    *   `financeService.ts`: Cálculo de amortización tradicional francesa (`calculateMonthlyPayment` y `generateAmortizationSchedule`).
*   **Resultados de la verificación:** 
    *   Se eliminan por completo los errores de redondeo acumulativos (por ejemplo, `0.1 + 0.2 === 0.30000000000000004` en números estándar), lo cual es de vital importancia en contabilidades personales.
    *   Las cuotas se redondean de forma exacta a 2 decimales (`toFixed(2)`) únicamente en la capa de persistencia e interfaz de usuario, manteniendo los cálculos intermedios limpios.

### 2.2 Tratamiento Multi-Divisa (FX Estático)
La aplicación implementa conversión de divisa nativa mediante una matriz de tasas fijas:
*   `STATIC_EXCHANGE_RATES` (EUR, USD, GBP).
*   Se detecta una gestión segura donde las transacciones con monedas diferentes a la moneda objetivo (`targetCurrency`) se convierten dinámicamente antes de sumarse o restarse a los saldos de cuenta, evitando la mezcla incorrecta de balances (una vulnerabilidad financiera común en versiones iniciales).

### 2.3 Simulación de Reunificación de Deudas (Consolidación)
Se ha auditado la funcionalidad de consolidación de deudas en `useConsolidation.ts` y los cálculos asociados en `financeService.ts`.
*   **Fórmulas de Amortización:** El sistema calcula correctamente:
    *   El principal pendiente de deudas clásicas en el mes de evaluación (`calculateClassicDebtRemainingPrincipal`).
    *   El total de intereses restantes por devengar (`calculateClassicDebtRemainingInterests`).
    *   La nueva cuota consolidada aplicando el sistema francés tradicional sobre el principal acumulado más el capital adicional solicitado.
*   **Estado:** Conforme. Los últimos fixes locales resolvieron las discrepancias de conversión de divisas en deudas no denominadas en la moneda base.

---

## 3. Auditoría de Seguridad y Criptografía (OWASP)

### 3.1 Cifrado Local (*Zero-Knowledge*)
Cuando el usuario define un PIN de protección, el almacenamiento local completo (IndexedDB) es cifrado:
*   **Algoritmo:** AES-GCM (256 bits), un cifrado autenticado que garantiza confidencialidad e integridad.
*   **Derivación de Clave:** PBKDF2 (Password-Based Key Derivation Function 2) con un salt generado de forma segura.
*   **Manejo en Memoria:** La clave derivada (`activeCryptoKey`) se mantiene estrictamente en memoria RAM y se limpia al bloquear la aplicación o cerrar la pestaña (`setCryptoKey(null)`), evitando la persistencia de material sensible sin cifrar en el almacenamiento físico del cliente.

### 3.2 Seguridad de Sincronización P2P
El sistema P2P (WebRTC a través de PeerJS) permite la transferencia de base de datos cifrada de un dispositivo a otro sin almacenamiento en servidor:
*   **Última Mitigación:** Se auditó la robustez de los códigos de sincronización. Recientemente se incrementó la longitud del código temporal de emparejamiento a **10 caracteres** generados a través de `crypto.getRandomValues()` en lugar de generadores pseudoaleatorios básicos.
*   **Impacto:** Esto previene ataques de fuerza bruta rápidos en la señalización del broker PeerJS.

---

## 4. Auditoría de Arquitectura de Software y Código

### 4.1 Estado del Refactor D1 (God-Context)
El objetivo de desmantelar la clase gigante `FinanzasContext.tsx` se ha completado con un alto grado de éxito. El tamaño del archivo se redujo de **2.572 líneas** originales a **1.188 líneas** actuales. 

Se han extraído los siguientes sub-dominios en hooks reactivos dedicados:
1.  **Cuentas:** `useAccounts.ts` (Creación y edición).
2.  **Transacciones:** `useTransactions.ts` (Alta, edición y borrado con recurrencia).
3.  **Deudas:** `useDebts.ts` (Cuotas y planes de amortización).
4.  **Períodos:** `usePeriods.ts` (Ciclos de meses contables y traspasos).
5.  **Reunificación de Deudas:** `useConsolidation.ts` (Simulador).
6.  **Seguridad y PIN:** `useSecurity.ts` (OWASP Lock-screen y derivación).
7.  **Asesor Gemini AI:** `useAiAdvisor.ts` (Persistencia de chat y parámetros).
8.  **Backup y Sincronización:** `useBackupSync.ts` (Export/Import en formato seguro).

*   **Nota del Arquitecto:** `FinanzasContext` actúa ahora principalmente como un orquestador delgado y compositor de hooks que mantiene intacta la interfaz original del contexto, evitando la necesidad de reescribir docenas de componentes visuales consumidores.

### 4.2 Análisis del Backlog de Warnings de Linting (D9)
La aplicación cuenta con 0 errores de ESLint y 55 warnings de backlog controlados:
*   **`no-explicit-any` (46 warnings):** Ubicados principalmente en migraciones y validadores de backups (`storageService.ts`, `backupValidator.ts`). Debido al carácter de datos heterogéneos y dinámicos importados del exterior, tipar exhaustivamente estas entradas requerirá un esfuerzo aislado que no compromete la estabilidad actual (puesto que existen tests de sanidad sobre esquemas).
*   **`react-hooks/set-state-in-effect` (7 warnings) & `react-refresh` (2 warnings):** Warnings inocuos que no afectan a la ejecución y se gestionarán de forma incremental.

---

## 5. Verificación de Pruebas Unitarias

Se ha ejecutado la suite completa de pruebas utilizando **Vitest** en el entorno local:
*   **Ejecución:** exitosa (`pnpm test run`).
*   **Resultados:** **382 de 382 pruebas pasadas (100% de éxito)**.
*   **Archivos Clave Cubiertos:**
    *   `financeService.test.ts` (Validación exhaustiva de planes de amortización, cuotas mensuales y cálculo de intereses).
    *   `FinanzasContext.test.tsx` (Flujo general de datos).
    *   `ImportStatementModal.test.tsx` (Heurísticas de importación CSV/PDF y deduplicación Gemini).
    *   `storageService.test.ts` (Correcta persistencia local en IndexedDB y migración de esquemas).

---

## 6. Recomendaciones de Mejora

A pesar de la excelente salud del código, como Ingeniero de Software Principal propongo las siguientes mejoras a futuro:
1.  **Tipado Estricto de Backups:** Eliminar gradualmente los warnings de tipo `any` en `storageService.ts` a través de esquemas de validación en tiempo de ejecución (por ejemplo, usando `Zod`) en lugar de lógica condicional `any` ad-hoc.
2.  **API de Tasas FX Dinámica (Opcional):** Introducir un proveedor local de tasas de cambio actualizado mediante peticiones cliente en segundo plano para aquellos usuarios que operen de forma activa en múltiples divisas reales de manera diaria (el FX estático actual es adecuado pero rígido).
3.  **Proyecciones Avanzadas de Cashflow:** Utilizar el motor contable inmutable para proyectar tendencias visuales de patrimonio (Net Worth) a 6, 12 y 24 meses basándose en la recurrencia de transacciones registradas.
