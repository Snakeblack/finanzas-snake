# 0007. Asistente de IA llamado directamente con la clave de la persona

- Status: accepted
- Date: 2026-11-14
- Evidence: src/services/geminiService.ts:199, src/services/statementImportService.ts:932

## Context and drivers

La restricción `constraint:business.constraints` admite la IA como función
opcional: los datos solo salen hacia el proveedor cuando la persona pone su
propia clave y lo pide. `scenario:confidencialidad` exige que esa salida sea
siempre una acción explícita. El código ya llama al proveedor desde el
navegador, sin intermediario propio, para el asesor y para leer extractos en
PDF.

## Options considered

1. Llamada directa del navegador al proveedor con la clave de la persona: sin
   coste ni servidor propio y la relación es entre la persona y su proveedor;
   la clave vive en el dispositivo y cada persona necesita la suya.
2. Intermediario propio que guarda una clave compartida: nadie configura nada;
   introduce un servidor que ve datos financieros y un coste por uso,
   contrario a 0001.
3. Modelo ejecutado en el dispositivo: nada sale; calidad y requisitos de
   equipo hoy insuficientes para leer extractos.

## Decision

Las funciones de IA son opcionales y la aplicación es plenamente útil sin
ellas. Cuando la persona las activa, el cliente llama directamente al
proveedor con la clave que ella aporta, que se guarda cifrada en el
dispositivo. Cada envío responde a una acción explícita y la interfaz indica
qué datos se van a enviar. El proveedor queda detrás de una interfaz de
adaptador: el resto del sistema no conoce su formato.

## Consequences

Más fácil: sin coste ni custodia; cambiar de proveedor toca un adaptador. Más
difícil: la persona gestiona su clave y sus límites de uso, y la aplicación
debe explicar errores del proveedor. Prohibido: enviar datos al proveedor en
segundo plano o sin clave propia, y hacer que una función contable dependa de
la IA.

## Fitness function

Las pruebas del adaptador cubren la clasificación de errores del proveedor y
que sin clave no se realiza ninguna llamada. Revisión manual: cada punto de
envío parte de un gesto de la persona.

- Check: `pnpm vitest run src/__tests__/geminiService.test.ts`

## Review trigger

Un modelo local alcanza la calidad necesaria, o el proveedor deja de permitir
llamadas directas desde el navegador.
