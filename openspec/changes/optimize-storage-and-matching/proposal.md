# Propuesta: Optimización de Almacenamiento (O(1)) y Correlación de Traspasos (T+2)

## 1. Introducción y Objetivos
El motor contable y el almacenamiento de **Finanzas Snake** presentan dos limitaciones de diseño que impiden su escala enterprise y adaptación al mercado europeo:
* **Escrituras Ineficientes:** La persistencia a nivel de IndexedDB realiza operaciones bulk asíncronas de $O(N)$ reescribiendo la tabla entera tras cualquier cambio en el estado de React.
* **Correlación de Traspasos Inflexible:** La importación de extractos exige coincidencia exacta de fechas para emparejar transferencias internas, fallando ante las liquidaciones bancarias estándar (T+1 o T+2).

Esta propuesta detalla la introducción de persistencia incremental directa en los manejadores de eventos y un algoritmo de coincidencia de traspasos con ventana temporal flexible.

## 2. Impacto e Interfaz de Usuario
* **Rendimiento:** Reducción drástica del uso de CPU y RAM al evitar el re-cifrado de transacciones no modificadas.
* **Conciliación:** Agrupación correcta de traspasos bancarios con hasta 2 días de desfase, eliminando falsos duplicados o registros de transferencias huérfanas en la UI.
* **Sin Cambios de Contrato:** La estructura de tipos en `src/types/index.ts` y las firmas de hooks en `useTransactions` / `useDebts` no sufrirán alteraciones para los componentes visuales.
