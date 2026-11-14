# Línea base técnica

> Verdad actual de la arquitectura, acordada el 2026-11-14. Las decisiones
> están en `decisions/`, el estado de cada respuesta en `knowledge-map.yaml` y
> la arquitectura recuperada del código, con sus divergencias, en
> `component-map.yaml`. `docs/ARCHITECTURE.md` y `docs/NEXT-STEPS.md` son
> documentos anteriores que se conservan como historia; donde contradigan a
> este, manda este.

## Context and boundaries

Finanzas Snake es una aplicación que se ejecuta entera en el navegador de una
o dos personas y es dueña de todos sus datos (ADR 0001).

| Elemento | Dentro o fuera | Confianza |
| --- | --- | --- |
| Navegador de cada persona | Dentro | De confianza: único lugar con datos en claro |
| Alojamiento estático y función de credenciales | Fuera | No confiable; no ve datos financieros |
| Servicio de contacto y retransmisor de sincronización | Fuera | No confiable; solo ve carga cifrada |
| Proveedor de IA | Fuera | No confiable; ve lo que la persona envía a propósito |
| Bancos | Fuera | Sin integración: los datos entran a mano o por extracto |

Fuera de alcance: cuentas de usuario, servidor de datos, telemetría.

## Components and data

Estructura objetivo en cuatro capas con dependencia en un solo sentido
(ADR 0002). La columna «Hoy» indica dónde vive cada cosa en el código actual.

| Capa | Responsabilidad | Hoy | Puede depender de |
| --- | --- | --- | --- |
| Interfaz | Pantallas, diálogos, primitivas visuales, tokens de diseño | `src/components/**`, `styles.css` | Estado de aplicación; funciones puras del dominio |
| Estado de aplicación | Compone casos de uso, mantiene la copia de trabajo, dispara la persistencia | `src/context/**`, `src/hooks/**` | Dominio; adaptadores (por interfaz) |
| Dominio | Tipos, reglas contables, amortización, periodos, esquemas de entidad, migraciones de formato | `src/services/financeService.ts`, `src/services/ledgerEngine.ts`, `src/types/**`, `src/constants/**`, parte de `src/utils/**` | Nada |
| Adaptadores | Almacenamiento, cifrado, sincronización, asistente de IA, importación de archivos | Resto de `src/services/**`, parte de `src/utils/**` | Dominio |

Propiedad de los datos: un dueño y un escritor por dato (ADR 0003).

| Dato | Dueño y único escritor | Cifrado con PIN activo |
| --- | --- | --- |
| Cuentas, movimientos, deudas, periodos | Adaptador de almacenamiento | Sí |
| Nombres de perfil y número de perfiles | Adaptador de almacenamiento | Sí |
| Conversación con el asesor y clave del proveedor de IA | Adaptador de almacenamiento | Sí |
| Sal del PIN y valor de comprobación | Adaptador de cifrado | No aplica (no son secretos) |
| Preferencias de presentación (tema, ocultar importes) | Interfaz | No (no son sensibles) |
| Servidores de retransmisión configurados por la persona | Adaptador de sincronización | No |

Todo importe es decimal exacto en texto con su divisa (ADR 0004). El formato
persistente evoluciona solo añadiendo y se migra al leer (ADR 0005).

## Integrations

| Dependencia | Dueño | Protocolo | Modo de fallo y respuesta |
| --- | --- | --- | --- |
| Proveedor de IA | Tercero; clave de la persona | Llamada directa desde el navegador (ADR 0007) | Sin clave, clave inválida, límite de uso o sin red: mensaje claro; la contabilidad no depende de ello |
| Servicio de contacto | Tercero público | Canal de señalización para conexión directa (ADR 0006) | Caído: la sincronización no arranca y se avisa; la copia en archivo sigue disponible |
| Retransmisor | Tercero, con credenciales temporales | Retransmisión cuando no hay conexión directa | Sin credenciales: se usan los que configure la persona; si no conecta, se avisa |
| Función de credenciales | Propia, en el alojamiento | Petición sin estado (ADR 0011) | Falla o sin configurar: responde sin detalles internos y el cliente degrada |
| Alojamiento | Tercero | Archivos estáticos | Caído: la aplicación ya cargada sigue funcionando; no se pierden datos |

## Quality scenarios

Los escenarios completos, con su comprobación, están en
`knowledge-map.yaml`. Ninguno lleva medida numérica (decisión del propietario,
ronda 3).

| Id | Atributo | Estímulo | Respuesta | Prioridad |
| --- | --- | --- | --- | --- |
| `integridad-datos` | Integridad | Recargar, bloquear y desbloquear, importar o sincronizar tras un cambio | Están exactamente los cambios confirmados; lo inválido se rechaza entero | 1 |
| `exactitud-contable` | Exactitud | Consultar un saldo, un cierre o una deuda desde cualquier pestaña | Mismo importe en todas las vistas, con aritmética decimal exacta | 1 |
| `confidencialidad` | Seguridad | Inspeccionar el almacenamiento o el tráfico sin el PIN | Nada financiero en claro; nada sale sin acción explícita | 1 |
| `usabilidad` | Usabilidad | Anotar un movimiento, revisar el mes, importar un extracto | Tarea completa sin pasos muertos en móvil y escritorio | 1 |
| `modificabilidad` | Modificabilidad | Rediseñar una pantalla o cambiar una regla | El cambio toca una sola capa | 2 |
| `uso-sin-conexion` | Disponibilidad | Abrir la aplicación sin red | Arranca y permite consultar y anotar | 2 |
| `rendimiento-historial` | Rendimiento | Anotar o cambiar de mes con años de datos | Sigue siendo inmediato; guardar no crece con el historial | 2 |

## Constraints

| Restricción | Fuente |
| --- | --- |
| Sin backend de datos; coste de alojamiento cero | Propietario, ronda 1 |
| Datos fuera del dispositivo solo por sincronización cifrada o IA explícita | Propietario, ronda 1 |
| Una persona, sénior; responde de producción sin guardia | Propietario, ronda 2 |
| Local y producción desde la rama principal; sin integración continua | Propietario, ronda 5 |
| Versión semántica, registro de cambios y copias compatibles hacia atrás | Propietario, ronda 5 |
| Se mantiene la pila; solo dependencias de licencia permisiva | Propietario, ronda 7 |
| Sin telemetría; errores visibles y registro local de diagnóstico | Propietario, ronda 8 |
| Copia manual con recordatorio; todo lo exportado se puede reimportar | Propietario, ronda 8 |

## Test strategy

Qué protege cada nivel. No se fija porcentaje de cobertura.

| Nivel | Protege | Riesgo que cubre |
| --- | --- | --- |
| Unitario de dominio | Saldos, periodos, recurrentes, amortización, conversión de importes, migraciones de formato | `exactitud-contable` |
| Unitario de validación | Esquemas de entidad y rechazo de cargas mal formadas | `integridad-datos` |
| Ida y vuelta de adaptadores | Guardar y leer cada colección; exportar e importar una copia sin perder campos; cifrar y descifrar; cifrado de la carga de sincronización | `integridad-datos`, `confidencialidad` |
| Integración de estado | Cada recorrido de `docs/product/functional-scope.md` desde la acción hasta lo persistido, incluidos bloqueo y desbloqueo y el modo de un perfil | Cableado (G2) |
| Componente | Que cada control visible dispara su caso de uso y muestra el resultado o el error | Cableado (G2), `usabilidad` |
| Regla de dependencias | El dominio y los adaptadores no importan interfaz ni estado | `modificabilidad` |
| Manual | Recorrido en móvil y escritorio, claro y oscuro; almacenamiento sin datos en claro con PIN; arranque sin red | `usabilidad`, `confidencialidad`, `uso-sin-conexion` |

Todo defecto se corrige empezando por una prueba que lo reproduce.

## Technology record

Fuente común de las versiones: `package.json` leído el 2026-11-14.

| Elección | Implementa | Alternativas | Por qué | Fuente |
| --- | --- | --- | --- | --- |
| React 19 con TypeScript 6 | 0002 | Reescribir en otra biblioteca de interfaz | Ya en uso, la conoce el propietario y 415 pruebas dependen de ella; MIT y Apache-2.0; sin coste. Se activa el modo estricto del compilador de forma gradual | 2026-11-14 — `package.json`, `tsconfig.json:10` |
| Vite 8 y Vitest 4 | 0011 | Otro empaquetador | Ya en uso; genera el desplegable estático; MIT | 2026-11-14 — `package.json` |
| Tailwind con primitivas Radix; migración a la versión mayor siguiente de Tailwind durante el rediseño | 0002 | Mantener la versión 3; hojas de estilo a mano | Tokens de diseño propios en CSS nativo; MIT. La guía de migración se consulta al ejecutar ese cambio | 2026-11-14 — `package.json` (hoy `tailwindcss` 3.4); decisión del propietario, ronda 7 |
| big.js | 0004 | Enteros en unidad mínima; otra biblioteca decimal | Ya en uso en el motor contable; MIT; sin dependencias | 2026-11-14 — `package.json` |
| Zod 4 | 0008, 0005 | Validación a mano | Ya en uso en disco y copias; un esquema da también el tipo; MIT | 2026-11-14 — `package.json` |
| IndexedDB del navegador, sin biblioteca intermedia | 0003, 0001 | Almacenamiento de clave y valor del navegador; base de datos embebida | Transacciones atómicas y capacidad suficiente; nativo, sin licencia ni coste | 2026-11-14 — `src/services/db/idbProvider.ts:18` |
| Web Crypto: AES-GCM de 256 bits y PBKDF2 | 0009, 0010 | Biblioteca criptográfica de terceros | Nativo y auditado por el navegador; sin dependencia. El número de iteraciones se revisa al tocar el cifrado | 2026-11-14 — `src/services/cryptoService.ts:44` |
| PeerJS sobre WebRTC | 0006 | WebRTC sin biblioteca; solo copia en archivo | Ya en uso; MIT. Depende de un servicio de contacto público | 2026-11-14 — `package.json`, `src/services/syncService.ts:144` |
| Gemini como proveedor de IA | 0007 | Otro proveedor; modelo local | Ya integrado y con nivel gratuito para la persona; queda tras una interfaz de adaptador | 2026-11-14 — `src/services/geminiService.ts:199` |
| Vercel como alojamiento, con una función | 0011 | Otro alojamiento estático | Ya en uso con el dominio configurado; coste cero | 2026-11-14 — `vercel.json`, `api/get-turn-credentials.js:1` |
| pnpm | 0011 | npm | Ya en uso con bloqueo de versiones | 2026-11-14 — `package.json` |
