# Hoja de ruta

> Acordada el 2026-11-14. Orden: primero que funcione, después la estructura,
> después la interfaz. Los defectos salen de la auditoría de cableado de ese
> día; cada uno cita dónde está. Los marcados «reproducido» se reprodujeron
> con una prueba; el resto sale de leer el código y se confirma con una prueba
> al abordarlo.

## Primera entrega: el PIN se puede activar y el perfil único sobrevive

Esqueleto andante: un recorrido completo (R5 de
`docs/product/functional-scope.md`) que atraviesa interfaz, estado de
aplicación, cifrado y almacenamiento.

| Defecto | Dónde | Estado |
| --- | --- | --- |
| El botón «Configurar PIN» llama al bloqueo y el arranque lo revierte al no haber sal: el cifrado es inalcanzable para un usuario nuevo | `src/components/App.tsx:351`, `src/hooks/useSecurity.ts:251` | Reproducido |
| Con PIN activo, el número de perfiles vuelve a dos en cada recarga porque el desbloqueo no lo restaura | `src/context/FinanzasContext.tsx:466`, `src/hooks/useSecurity.ts:223` | Reproducido |

Hecho cuando: una persona nueva activa el PIN desde la interfaz, bloquea,
desbloquea y recarga, y conserva sus datos y su modo de un perfil; con el PIN
activo no hay datos financieros en claro en el almacenamiento.

## Hitos

### H1. Integridad de datos

| Defecto | Dónde | Estado |
| --- | --- | --- |
| Los recurrentes encadenan su identificador mes a mes hasta superar el máximo que acepta el validador: la copia exportada deja de poder importarse y la sincronización falla | `src/utils/dateUtils.ts:80`, `src/utils/backupValidator.ts:207` | Resuelto en 0.2.3 |
| El esquema de copias descarta el vínculo de serie recurrente | `src/utils/backupValidator.ts:206` | Resuelto en 0.2.3 |
| Importar escapa el texto y la interfaz no lo decodifica: los nombres se corrompen en cada ronda | `src/utils/backupValidator.ts:8` | Resuelto en 0.2.3 |
| El número de perfiles no viaja en la copia ni en la sincronización | `src/services/storageService.ts:1432`, `src/components/sync/SyncModal.tsx:18` | Resuelto en 0.2.3 |
| «Configurar cuenta» sustituye todos los periodos por uno; al recargar se duplican los recurrentes | `src/context/FinanzasContext.tsx:836` | Reproducido |
| Cuentas y periodos se guardan vaciando y reescribiendo en dos pasos | `src/services/storageService.ts:472` | Leído |
| El orden manual de movimientos no se guarda | `src/components/transactions/TransactionsTab.tsx:109` | Leído |

Aplica los ADR 0003, 0005 y 0008: un esquema por entidad, validar sin
transformar y escritura atómica.

### H2. Exactitud contable

| Defecto | Dónde | Estado |
| --- | --- | --- |
| Los movimientos de meses sin periodo no cuentan, y la importación no crea periodos: un extracto anterior al primer mes se guarda pero no se ve | `src/services/financeService.ts:606`, `src/components/transactions/ImportStatementModal.tsx:573` | Reproducido |
| La proyección suma cada instancia mensual de un recurrente: se infla con el historial | `src/services/financeService.ts:931` | Reproducido |
| Editar o borrar «solo este» corta la serie recurrente | `src/hooks/useTransactions.ts:300` | Leído |
| Dos filas idénticas legítimas de un extracto comparten huella y la segunda no se puede importar | `src/services/statementImportService.ts:68` | Reproducido |
| En un perfil, la segunda cuenta o deuda queda como conjunta sin poder corregirlo; el saldo inicial negativo se vuelve positivo | `src/hooks/useAccounts.ts:59`, `src/hooks/useDebts.ts:154` | Leído |
| En vista individual un gasto conjunto cuenta a medias en gastos y entero en saldo; la liquidación conjunta no convierte divisa | `src/services/financeService.ts:626`, `src/services/financeService.ts:720` | Leído |
| Un traspaso de viernes a lunes no se empareja (la ventana cuenta días naturales y no desempata) | `src/services/statementImportService.ts:555` | Leído |
| Segundo motor de saldos sin uso y saldos en coma flotante | `src/services/ledgerEngine.ts:16`, `src/types/index.ts:52` | Leído |

Aplica el ADR 0004: un solo motor y todo importe decimal exacto.

### H3. Fronteras de confianza y errores visibles

| Trabajo | Dónde |
| --- | --- |
| Derivar la clave de sincronización aparte del identificador de sesión y con derivación lenta | `src/services/syncService.ts:76` |
| Clave del asesor en cabecera, no en la dirección | `src/services/geminiService.ts:199`, `src/services/statementImportService.ts:932` |
| La función de credenciales no devuelve trazas ni nombres de variables | `api/get-turn-credentials.js:23` |
| Respetar los servidores de retransmisión que configure la persona | `src/services/syncService.ts:41`, `src/components/sync/SyncModal.tsx:137` |
| Mostrar en la interfaz todo fallo de guardado, importación, sincronización o IA, con registro local copiable | `src/services/storageService.ts:831` |
| No reintentar errores del proveedor que no son transitorios; acotar la longitud de respuesta | `src/services/geminiService.ts:217` |

Aplica los ADR 0007 y 0010.

### H4. Estructura en capas

Mover el código a las cuatro capas del ADR 0002 por partes, sin cambio de
comportamiento: dominio puro, adaptadores tras interfaces, la interfaz sin
importar adaptadores. Activar el modo estricto del compilador de forma
gradual (`tsconfig.json:10`). Al terminar, la regla «la interfaz no importa
adaptadores» pasa a comprobarse con un comando.

### H5. Rediseño de la interfaz

Sistema de tokens propio y migración a la versión mayor siguiente de la
biblioteca de estilos; rehacer cada pantalla alrededor de sus tareas
frecuentes (anotar, revisar el mes, importar), en móvil y escritorio, claro y
oscuro. Incluye el cableado menor pendiente: aviso de «copiado» que nunca
aparece y avisos de importación que no se cierran
(`src/components/ai/AiTab.tsx:256`, `src/hooks/useBackupSync.ts:86`).

### H6. Uso sin conexión, copias y rendimiento

Arranque sin red tras la primera carga; recordatorio de copia y solicitud de
almacenamiento persistente; escritura por entidad también para cuentas,
periodos y conversación; dividir el paquete inicial (hoy un único archivo de
820 kB).

### Después

Presupuestos por categoría, metas de ahorro, reglas de categorización y
conciliación con el saldo del extracto. Sin fecha: tipos de cambio reales,
conexión bancaria.

## Decisiones tomadas

- 2026-11-14: el cambio SDD `optimize-storage-and-matching` (verificado, con la
  revisión pendiente) se archiva tal cual en
  `openspec/changes/archive/2026-11-14-optimize-storage-and-matching/`, sin
  cerrar su revisión.

## Decisiones aplazadas

| Decisión | Dueño | Último momento responsable |
| --- | --- | --- |
| Dirección visual del rediseño (referencias, tipografía, densidad, color) | Propietario | Antes de empezar H5 |
| Carpetas concretas de las cuatro capas | Propietario | Al abrir el primer cambio de H4 |
| Cómo se actualiza la versión en clientes con arranque sin conexión | Propietario | Antes de empezar H6 |
| Vigencia de las credenciales públicas del retransmisor por defecto, o retirarlas | Propietario | Durante H3 |
| Añadir integración continua. Condición del propietario (2026-11-14): los flujos automáticos se ejecutan solo cuando hacen falta: filtrados por las rutas que cambian (nada en cambios solo de documentación), sin ejecuciones duplicadas por el mismo cambio y cancelando la anterior al llegar una nueva | Propietario | Si un despliegue roto llega a producción |
| Fusión de cambios entre dispositivos | Propietario | Si la sobrescritura al sincronizar pierde datos en uso real (reabre ADR 0006) |
