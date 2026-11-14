# Alcance funcional

> Fuente: ronda 6 de foundation (2026-11-14) y el código existente. Todas las
> capacidades existen ya; el objetivo es que funcionen de extremo a extremo.
> Los defectos conocidos están en `docs/roadmap.md`.

## Actores

| Actor | Tipo | Relación |
| --- | --- | --- |
| Persona A | Humano | Dueña de sus datos y de lo conjunto |
| Persona B | Humano, opcional | Igual que A; sin roles ni permisos distintos |
| Proveedor de IA | Sistema externo | Recibe lo que la persona envía al asesor o al importar un PDF |
| Servicio de contacto | Sistema externo | Pone en contacto dos dispositivos para sincronizar |
| Retransmisor | Sistema externo | Retransmite la sincronización cuando no hay conexión directa |
| Alojamiento | Sistema externo | Entrega el código y las credenciales temporales del retransmisor |

El modo de un solo perfil es de primera clase: todo debe funcionar igual con
una persona que con dos.

## Capacidades

| Capacidad | Incluye |
| --- | --- |
| Núcleo contable | Cuentas; movimientos (ingreso, gasto, traspaso, recurrentes); periodos mensuales; panel del mes con saldos, desglose por categoría y proyección de patrimonio |
| Deudas y reunificación | Préstamos con cuadro de amortización; planes de pago por cuotas; simulador de reunificación |
| Importación, copia y sincronización | Importar extractos en CSV y PDF con detección de duplicados y emparejado de traspasos; copia de seguridad cifrable; sincronización entre dispositivos; bloqueo con PIN |
| Asesor de IA | Chat con el asesor sobre los datos propios; copiar y exportar la conversación a PDF |

## Recorridos principales

| # | Recorrido | Resultado esperado |
| --- | --- | --- |
| R1 | Primer uso: elegir uno o dos perfiles, crear cuentas con saldo inicial | El mes en curso queda abierto con los saldos correctos |
| R2 | Anotar un movimiento | Aparece en la lista, cambia el saldo de su cuenta y el panel del mes, y sigue ahí tras recargar |
| R3 | Revisar el mes y abrir el siguiente | Los recurrentes pasan una sola vez al mes nuevo y el saldo de apertura coincide con el cierre anterior |
| R4 | Importar un extracto | Las filas nuevas entran en su mes, los duplicados se avisan y el saldo cuadra con el del banco |
| R5 | Activar el PIN, bloquear y desbloquear | Los datos quedan cifrados en el dispositivo y vuelven intactos al desbloquear |
| R6 | Exportar una copia y restaurarla | El estado restaurado es idéntico al exportado |
| R7 | Sincronizar con el otro dispositivo | El receptor queda con los mismos datos que el emisor, tras avisar de que se sobrescribe |
| R8 | Registrar una deuda y simular una reunificación | El cuadro de amortización y el ahorro simulado son correctos |
| R9 | Preguntar al asesor | La respuesta usa los datos del periodo y la conversación se puede exportar |

## Primera entrega

Activar el PIN desde la interfaz y que el modo de un solo perfil sobreviva a
recargar con el PIN activo (R5). Atraviesa todas las capas —interfaz, estado
de aplicación, cifrado y almacenamiento— y corrige los dos defectos más graves
de cableado. Detalle en `docs/roadmap.md`.

## Exclusiones

| Excluido | Motivo | Hasta cuándo |
| --- | --- | --- |
| Presupuestos, metas de ahorro, reglas de categorización, conciliación | Primero estabilizar y rehacer la interfaz | Hasta cerrar el hito de rediseño |

Conexión bancaria automática, copia en servidores propios y tipos de cambio
reales no se han excluido de forma expresa: quedan como ideas sin fecha en la
hoja de ruta. La copia en servidores propios exigiría además reabrir el ADR
0001.
