# 0010. Solo el dispositivo es de confianza

- Status: accepted
- Date: 2026-11-14
- Evidence: src/services/syncService.ts:76, src/services/syncService.ts:84, src/services/geminiService.ts:199, api/get-turn-credentials.js:23, vercel.json:7

## Context and drivers

El escenario `scenario:confidencialidad` y la restricción
`constraint:business.constraints` sitúan toda la confianza en el dispositivo
de la persona. La aplicación usa servicios de terceros que no controla: el
alojamiento, el servicio que pone en contacto dos dispositivos, el que
retransmite cuando no hay conexión directa y el proveedor de IA. Hoy el
identificador público de una sesión de sincronización y su clave de cifrado se
obtienen del mismo resumen del código, de modo que quien ve el identificador
conoce la clave; la clave del asesor viaja en la dirección de la llamada; y la
función de credenciales devuelve trazas y nombres de variables de entorno.

## Options considered

1. Tratar a todo tercero como no confiable y cifrar o minimizar lo que ve:
   coherente con el modelo local; exige disciplina en cada integración.
2. Confiar en el cifrado del canal que ofrece cada tercero: menos trabajo; el
   tercero que termina el canal puede leer el contenido.
3. Eliminar las integraciones con terceros: nada que proteger; se pierden la
   sincronización y la IA.

## Decision

La única zona de confianza es el dispositivo de la persona. El alojamiento, el
servicio de contacto, el retransmisor y el proveedor de IA son no confiables:
ninguno recibe datos financieros en claro, salvo el proveedor de IA y solo lo
que la persona envía a propósito (0007). La clave que cifra una sincronización
se deriva del código de un solo uso con una derivación lenta y de forma
independiente de cualquier identificador que vea un tercero. Un secreto nunca
viaja en una dirección ni aparece en un registro o en un mensaje de error, y
los errores que salen de un componente de servidor no revelan detalles
internos. El navegador solo puede conectar con los orígenes de las
integraciones registradas.

## Consequences

Más fácil: razonar sobre qué ve cada tercero; añadir o cambiar un tercero sin
ampliar la confianza. Más difícil: cada integración nueva pasa por esta
revisión y por la lista de orígenes permitidos; depurar errores de servidor
con menos detalle. Prohibido: derivar una clave y un identificador público del
mismo valor, y poner secretos en direcciones, registros o respuestas.

## Fitness function

Revisión manual de cada cambio que toque una integración: qué recibe el
tercero, de dónde sale cada clave y qué contiene cada respuesta de error. Las
pruebas de sincronización verifican que el identificador de sesión no permite
obtener la clave.

## Review trigger

Se añade un tercero nuevo, o la persona decide operar ella misma el servicio
de contacto o el retransmisor.
