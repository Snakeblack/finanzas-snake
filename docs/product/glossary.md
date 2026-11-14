# Glosario

| Término | Significado | En el código |
| --- | --- | --- |
| Perfil | Cada persona que usa la aplicación. Hay uno o dos | `userA`, `userB`, `profileCount` |
| Conjunto | Lo que pertenece a las dos personas a la vez | `joint` (propietario), `shared` (pagador) |
| Cuenta | Lugar donde hay dinero (banco o efectivo), de una persona o conjunta, con un saldo inicial | `Account` |
| Importe | Cantidad decimal exacta con su divisa | `Money` |
| Movimiento | Ingreso, gasto o traspaso con importe, fecha, categoría, propietario y pagador. No se muta una vez confirmado | `Transaction` |
| Traspaso | Movimiento entre dos cuentas propias; no es ingreso ni gasto | `transfer` |
| Movimiento recurrente | Movimiento que se repite cada mes; cada mes tiene su propia instancia, enlazada a la serie | `recurrence`, `originId` |
| Categoría | Etiqueta que clasifica un movimiento o una deuda | `tag` |
| Periodo | Mes contable. Tiene saldo de apertura y agrupa los movimientos de ese mes | `Period` |
| Saldo de apertura | Dinero disponible al empezar un periodo | `openingBalance` |
| Deuda | Dinero que se debe. Clásica (préstamo con interés y plazo) o plan de pagos (cuotas pactadas) | `Debt`, `ClassicDebt`, `PaymentPlanDebt` |
| Cuadro de amortización | Reparto de cada cuota de un préstamo entre interés y capital | `generateAmortizationSchedule` |
| Reunificación | Simulación de sustituir varias deudas por una sola | `consolidation` |
| Extracto | Archivo del banco (CSV o PDF) con movimientos para importar | `ImportedTransaction` |
| Duplicado | Fila de un extracto que ya existe como movimiento. El exacto no se importa; el posible se avisa | `isDuplicate`, `possibleDuplicate` |
| Copia de seguridad | Archivo exportado con todos los datos, que se puede volver a importar | `FinanceBackupPayload` |
| Instantánea | Conjunto completo de los datos en un momento dado; es lo que viaja en una copia o una sincronización | `FinanceBackupSnapshot` |
| Código de sincronización | Código de un solo uso que la persona introduce para emparejar dos dispositivos | `generateShortCode` |
| PIN | Secreto del que se deriva la clave que cifra los datos en el dispositivo | `handleSetupPassword` |
| Bloqueo | Estado en que la aplicación no tiene la clave en memoria y no lee ni escribe datos | `isLocked` |
| Asesor | Asistente de IA que responde sobre los datos del periodo | `useAiAdvisor` |
| Pestaña | Cada sección principal de la interfaz | `ActiveTab` |
