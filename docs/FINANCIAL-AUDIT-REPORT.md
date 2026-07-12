# Informe de Auditoría de Código y Algoritmos Financieros
**Finanzas Snake**
*Autor: Antigravity — Ingeniero de Software Principal y Auditor Financiero Automatizado*
*Fecha de auditoría: 13 de Julio de 2026*

---

## 1. Resumen Ejecutivo

Este documento presenta los resultados de la auditoría técnica y financiera automatizada realizada sobre el repositorio **Finanzas Snake**, una aplicación web cliente local-first y *zero-knowledge* diseñada para la gestión de finanzas personales, presupuestos y control de deudas.

La auditoría ha evaluado los siguientes pilares críticos:
1. **Precisión Matemática y Consistencia Temporal:** Verificación de la no filtración de errores de coma flotante binarios en operaciones monetarias, amortizaciones y las nuevas proyecciones de balance/patrimonio neto.
2. **Seguridad y Criptografía:** Cumplimiento con estándares OWASP en el almacenamiento local y protocolos de sincronización, además de verificar la seguridad de dependencias (`pnpm audit`).
3. **Mecanismo de Importación de Extractos:** Evaluación de la robustez de las heurísticas de deduplicación y emparejado de traspasos.
4. **Calidad de Código y Deuda Técnica:** Progreso de la iniciativa de refactorización D1 (desmantelamiento del god-context) y análisis del backlog de warnings de linting.
5. **Cobertura de Pruebas:** Verificación del estado de ejecución de la suite de pruebas unitarias/integración tras las últimas incorporaciones algorítmicas.

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
*   `STATIC_EXCHANGE_RATES` (EUR, USD, GBP) definidos en `ledgerEngine.ts`.
*   Se detecta una gestión segura donde las transacciones con monedas diferentes a la moneda objetivo (`targetCurrency`) se convierten dinámicamente antes de sumarse o restarse a los saldos de cuenta, evitando la mezcla incorrecta de balances (una vulnerabilidad financiera común en versiones iniciales).

### 2.3 Simulación de Reunificación de Deudas (Consolidación)
Se ha auditado la funcionalidad de consolidación de deudas en `useConsolidation.ts` y los cálculos asociados en `financeService.ts`.
*   **Fórmulas de Amortización:** El sistema calcula correctamente:
    *   El principal pendiente de deudas clásicas en el mes de evaluación (`calculateClassicDebtRemainingPrincipal`).
    *   El total de intereses restantes por devengar (`calculateClassicDebtRemainingInterests`).
    *   La nueva cuota consolidada aplicando el sistema francés tradicional sobre el principal acumulado más el capital adicional solicitado.
*   **Estado:** Conforme. Los últimos fixes locales resolvieron las discrepancias de conversión de divisas en deudas no denominadas en la moneda base.

### 2.4 Motor de Proyección de Cashflow y Patrimonio Neto (`calculateProjections`)
Se ha realizado una auditoría exhaustiva del motor de proyecciones financieras en `financeService.ts` y su visualización:
*   **Cálculo de Activos y Pasivos:** El motor calcula la deuda pendiente efectiva mensual mediante `getEffectiveDebtRemaining`, ponderando adecuadamente la propiedad de las deudas (`userA`, `userB` o `joint`) y aplicando la tasa de reparto del 50% para deudas conjuntas en las vistas individuales.
*   **Gestión de Planes de Pago:** Para deudas fraccionadas (`PaymentPlanDebt`), el cálculo de deuda restante en un mes `m` se filtra de forma temporal considerando únicamente las cuotas pendientes futuras (`normalizeMonth(inst.dueMonth) >= evalMonth`), lo cual previene la sobreevaluación de pasivos al no contar cuotas pagadas o pasadas.
*   **Simulación de Futuro:** En los meses proyectados posteriores al histórico de períodos, la simulación se construye sobre el saldo final con precisión estricta usando `Big.js` para los flujos recurrentes y amortizaciones de deudas estimadas, garantizando consistencia temporal.
*   **Visualización Interactiva:** Se ha integrado un gráfico SVG interactivo de área y líneas en la pestaña general (Overview/Resumen) que muestra de forma dinámica la proyección de Activos, Pasivos y Patrimonio Neto a 12 meses, mejorando drásticamente la capacidad de análisis patrimonial del usuario.
*   **Resultados de la verificación:** El algoritmo y su componente visual cumplen rigurosamente con los principios contables y de visualización definidos, sin introducir fugas de precisión matemática ni de coherencia de asignación por propietario.

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

### 3.3 Auditoría de Dependencias (`pnpm audit`)
*   Se ha ejecutado la herramienta de auditoría de seguridad sobre todas las dependencias del árbol de paquetes.
*   **Resultado:** **0 vulnerabilidades detectadas**. El entorno actual no cuenta con brechas de seguridad conocidas en sus dependencias de terceros.

---

## 4. Auditoría de Arquitectura de Software y Código

### 4.1 Estado del Refactor D1 (God-Context)
El desmantelamiento de `FinanzasContext.tsx` continúa consolidado, manteniéndose en un tamaño controlado de **1.188 líneas** (una reducción drástica de las 2.572 líneas originales).

La modularización de subdominios se encuentra distribuida en hooks altamente cohesivos:
1.  **Cuentas:** `useAccounts.ts` (Creación y edición).
2.  **Transacciones:** `useTransactions.ts` (Alta, edición y borrado con recurrencia).
3.  **Deudas:** `useDebts.ts` (Cuotas y planes de amortización).
4.  **Períodos:** `usePeriods.ts` (Ciclos de meses contables y traspasos).
5.  **Reunificación de Deudas:** `useConsolidation.ts` (Simulador).
6.  **Seguridad y PIN:** `useSecurity.ts` (OWASP Lock-screen y derivación).
7.  **Asesor Gemini AI:** `useAiAdvisor.ts` (Persistencia de chat y parámetros).
8.  **Backup y Sincronización:** `useBackupSync.ts` (Export/Import en formato seguro).

`FinanzasContext` actúa limpiamente como capa de composición y orquestador cross-domain delgado, manteniendo intacta la compatibilidad con todos los componentes consumidores del cliente visual.

### 4.2 Análisis del Backlog de Warnings de Linting (D9)
*   **Resultado de ESLint:** **0 errores y 0 warnings encontrados**.
*   El backlog de warnings de linting ha sido completamente resuelto (0 warnings, 0 errores en total), incluyendo la eliminación de importaciones redundantes, alineación de dependencias reactivas en selectors y anotaciones en el validador de backups.

---

## 5. Verificación de Pruebas Unitarias

Se ha ejecutado la suite completa de pruebas utilizando **Vitest** en el entorno local:
*   **Ejecución:** Completamente exitosa (`pnpm test run`).
*   **Resultados:** **391 de 391 pruebas pasadas (100% de éxito)**.
*   **Nuevas Coberturas:** Se ha verificado la suite de pruebas unitarias cubriendo las validaciones de los esquemas Zod en IndexedDB y el comportamiento de proyecciones, con tasas de éxito y robustez perfectas.

---

## 6. Recomendaciones de Mejora

A pesar de la excelente salud del código y de los algoritmos financieros, se sugieren las siguientes propuestas de evolución de ingeniería:
1.  **Validación de Esquemas de Backup con Zod:** Tras la exitosa implementación de la validación estricta de base de datos local con Zod (`schema.ts`), se recomienda portar gradualmente las comprobaciones manuales de `backupValidator.ts` hacia estos esquemas Zod unificados para simplificar el mantenimiento y asegurar coherencia estructural completa.
2.  **Mecanismo de Integración de Tasas FX Dinámicas:** Evaluar la implementación de un worker en segundo plano para recuperar de forma periódica las tasas de conversión reales (en lugar de estáticas) para usuarios que gestionen balances multiactivo diariamente.
3.  **Proyecciones a Largo Plazo y Simulación de Escenarios:** Permitir al usuario simular variaciones hipotéticas (por ejemplo, incremento del tipo de interés, amortizaciones anticipadas de deudas o cambios en ingresos recurrentes) y observar su impacto proyectado en la tendencia del patrimonio neto a 24 o 36 meses.
