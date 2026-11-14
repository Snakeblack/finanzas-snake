# 0009. Cifrado en reposo opcional con clave derivada del PIN

- Status: accepted
- Date: 2026-11-14
- Evidence: src/services/cryptoService.ts:44, src/services/storageService.ts:95, src/services/storageService.ts:112, src/hooks/useSecurity.ts:112

## Context and drivers

El escenario `scenario:confidencialidad` exige que, con PIN activo, quien
acceda al dispositivo no encuentre datos financieros ni la clave del asesor en
claro. No hay servidor que custodie claves (`constraint:business.constraints`).
El código ya deriva una clave del PIN, la mantiene solo en memoria y cifra con
ella todo lo que guarda; con la aplicación bloqueada no lee ni escribe.

## Options considered

1. Cifrado opcional con clave derivada del PIN y mantenida solo en memoria:
   protege el disco sin servidor; si se olvida el PIN los datos son
   irrecuperables salvo por una copia.
2. Cifrado obligatorio desde el primer uso: protección uniforme; añade
   fricción al empezar y el mismo riesgo de olvido para quien no lo necesita.
3. Sin cifrado propio, confiando en el del sistema operativo: nada que
   mantener; no protege frente a otra persona con la sesión abierta.

## Decision

El cifrado en reposo es opcional y lo activa la persona al fijar un PIN. La
clave se deriva del PIN con una derivación lenta y una sal aleatoria, existe
solo en memoria mientras la aplicación está desbloqueada y nunca se persiste.
Con cifrado activo, todo dato financiero y todo secreto se guarda cifrado con
autenticación; con la aplicación bloqueada no se lee ni se escribe ningún
dato, y bloquear borra de memoria la clave y los datos. Activar, cambiar o
quitar el PIN vuelve a cifrar todo de forma atómica.

## Consequences

Más fácil: proteger el dispositivo compartido sin infraestructura. Más
difícil: no hay recuperación de PIN; la interfaz debe decirlo y empujar a
tener copia. Las preferencias no sensibles pueden quedar en claro. Prohibido:
persistir la clave o el PIN, y guardar en claro un dato financiero o un
secreto cuando el cifrado está activo.

## Fitness function

Las pruebas cubren derivación, cifrado de ida y vuelta, rechazo con PIN
erróneo y que bloquear limpia el estado. Revisión manual tras cada cambio de
persistencia: con PIN activo, inspeccionar el almacenamiento del navegador y
no encontrar datos financieros en claro.

- Check: `pnpm vitest run src/__tests__/cryptoService.test.ts src/__tests__/useSecurity.test.tsx`

## Review trigger

El coste de la derivación lenta recomendado para contraseñas cambia de forma
sustancial, o se quiere desbloqueo con la biometría del dispositivo.
