# Changelog

## [Unreleased]

## [0.2.7] - 2026-11-16

### Fixed
- Con un perfil, la segunda cuenta o deuda y las siguientes quedan a nombre de la persona en lugar de como conjuntas; editar una cuenta guardada como conjunta la corrige (h2-joint-profiles)
- El saldo inicial negativo de una cuenta (descubierto, tarjeta) se guarda con su signo al crearla y al editarla (h2-joint-profiles)
- En vista individual, ingresos, gastos y cuotas cuentan según la cuenta que mueve el dinero (propia entera, conjunta a medias), igual que el cierre: Apertura + Ingresos − Gastos − Deuda = Cierre (h2-joint-profiles)
- «Cuentas del mes» convierte a euros los gastos comunes pagados en otra divisa (h2-joint-profiles)

## [0.2.6] - 2026-11-15

### Fixed
- Un extracto con dos filas idénticas (dos cafés iguales el mismo día) importa las dos; cada movimiento ya guardado, importado o anotado a mano, cubre una sola fila, y reimportar el extracto no duplica ninguna (h2-statement-import)
- Un traspaso enviado el viernes y recibido el lunes se empareja: la ventana cuenta dos días hábiles y, con varios candidatos, gana el más cercano en ambos sentidos (h2-statement-import)

## [0.2.5] - 2026-11-15

### Fixed
- Un movimiento con fecha en un mes sin periodo (importado, anotado o editado) crea los meses que faltan y cuenta; los meses anteriores se calculan hacia atrás sin cambiar el saldo del mes configurado (h2-recurring-and-periods)
- La proyección cuenta cada recurrente una vez al mes en lugar de sumar todo su historial (h2-recurring-and-periods)
- Editar o borrar «solo este» en el último mes ya no corta la serie recurrente, tampoco tras recargar, restaurar una copia o sincronizar (h2-recurring-and-periods)

## [0.2.4] - 2026-11-15

### Fixed
- «Configurar cuenta» conserva los meses existentes y ya no duplica los recurrentes al recargar; un mes de inicio posterior al primero se rechaza con un aviso (h1-data-integrity)
- Cuentas y periodos se guardan en una sola operación: un fallo al guardar ya no deja el almacén vacío (h1-data-integrity)
- El orden manual de los movimientos de un día se guarda y viaja en la copia y la sincronización (h1-data-integrity)

## [0.2.3] - 2026-11-14

### Fixed
- Una copia exportada o una sincronización se reimporta siempre y conserva todos los datos (backup-roundtrip)

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
