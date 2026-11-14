# Finanzas Snake — resumen de producto

> Fuente: rondas de foundation del 2026-11-14 con el propietario, sobre la base
> de `README.md` y `docs/ARCHITECTURE.md`. El estado de cada respuesta está en
> `docs/architecture/knowledge-map.yaml`.

## Problema

Una pareja necesita llevar juntas sus finanzas —lo de cada persona y lo
compartido— sin entregar sus datos a un servicio: saber cuánto hay en cada
cuenta, qué entró y salió cada mes, cuánto se debe y cómo cierra el mes.

## Usuarios

| Quién | Qué hace |
| --- | --- |
| Persona A | Usa la aplicación en sus dispositivos; puede usarla sola (un perfil) |
| Persona B (opcional) | Comparte los mismos datos y permisos en los suyos |

Es una herramienta de uso propio. Está publicada en internet, pero no da
soporte a terceros.

## Objetivos

| # | Objetivo | Cómo se sabe que se cumple |
| --- | --- | --- |
| G1 | Exactitud contable | Saldos, periodos, deudas y amortizaciones correctos y coherentes entre pestañas (`exactitud-contable`) |
| G2 | Flujos cableados de extremo a extremo | Cada acción visible funciona completa y persiste; ningún botón o pantalla a medias (`integridad-datos`) |
| G3 | Interfaz propia y usable | Diseño con criterio propio, jerarquía clara y uso cómodo en móvil y escritorio (`usabilidad`) |

No hay medidas numéricas: cada objetivo se verifica con pruebas y con las
comprobaciones de su escenario de calidad.

## Restricciones

| Restricción | Fuente |
| --- | --- |
| Local-first: sin backend de datos ni cuentas de usuario | Propietario, ronda 1 |
| Alojamiento estático de coste cero | Propietario, ronda 1 |
| Los datos solo salen del dispositivo por sincronización cifrada entre dispositivos o hacia el proveedor de IA, con la clave de la persona y a petición explícita | Propietario, ronda 1 |
| Una sola persona desarrolla y responde de producción, sin guardia | Propietario, ronda 2 |
| Código propio sin licencia pública; solo dependencias de licencia permisiva | Propietario, ronda 7 |
| Sin telemetría: los errores se muestran en la aplicación | Propietario, ronda 8 |

## No objetivos

- Funciones nuevas (presupuestos, metas de ahorro, reglas de categorización,
  conciliación) antes de estabilizar lo existente y rehacer la interfaz.
- Dar servicio o soporte a terceros.
- Privacidad entre las dos personas: ambas ven todo.
