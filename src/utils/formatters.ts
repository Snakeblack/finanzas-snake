import type { NumericInput } from '../types';

/**
 * Convierte una entrada numérica (número o string) a un número flotante de JavaScript válido.
 * Si no es válido o es indefinido, retorna 0.
 *
 * @param value Valor numérico de entrada (string o número)
 * @returns Número flotante válido o 0
 */
export const toNumber = (value: NumericInput | undefined): number => {
	const parsed = typeof value === 'number' ? value : parseFloat(value ?? '');
	return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Decodifica las entidades HTML básicas (&amp;, &quot;, &#039;, &lt;, &gt;) a sus caracteres correspondientes.
 * Procesa &amp; primero para corregir casos de doble-escapado (ej. &amp;quot; -> &quot; -> ").
 *
 * @param str Cadena de texto que puede contener entidades HTML
 * @returns Cadena con caracteres decodificados
 */
export const decodeHtmlEntities = (str: string): string => {
	if (!str) return '';
	let decoded = str;
	// Ejecutar dos pasadas para resolver de forma segura entidades doble-escapadas (ej: &amp;quot; -> &quot; -> ")
	for (let i = 0; i < 2; i++) {
		const prev = decoded;
		decoded = decoded
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#039;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>');
		if (decoded === prev) break;
	}
	return decoded;
};
