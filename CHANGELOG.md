# Changelog

## [0.2.0] - 2026-07-14

### Añadido
- **Importación Multicuenta y Onboarding**: Integración de importación de extractos multicuentas y flujo guiado de bienvenida para nuevos usuarios.
- **Validación con Zod**: Esquemas de validación estrictos en IndexedDB para prevenir la corrupción de datos y unificación del validador de backups bajo esquemas Zod.
- **Proyección de Patrimonio Neto**: Gráfico SVG interactivo de proyecciones patrimoniales y balances temporales en la pestaña general (Overview).

### Modificado
- **Refactorización D1 (Desmantelamiento del God-Context)**: Extracción de selectores financieros y lógica de negocio derivada a hooks específicos (`useFinancialSelectors`, `usePeriods`, `useConsolidation`), reduciendo drásticamente la complejidad y tamaño de `FinanzasContext`.

### Solucionado
- **Estabilización de Tests**: Corrección de fugas de JSDOM/memoria en la descarga de PDF (`handleDownloadChatPDF`) mediante limpieza del iframe y uso de temporizadores simulados en Vitest.
- **Saneamiento del Linter**: Resolución del 100% de las advertencias del linter (ESLint flat config), eliminando imports no utilizados y mejorando tipados.
