# Changelog

## [Unreleased]

## [0.2.2] - 2026-11-14

### Fixed
- El PIN se puede activar desde la interfaz y el modo de un perfil sobrevive a recargar con PIN activo (pin-setup-and-profile-count)

## [0.2.1] - 2026-11-14

### Changed
- Saltar la construcción en Vercel cuando un push solo cambia documentación (vercel-skip-docs-builds)

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
