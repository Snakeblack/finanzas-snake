import { describe, it, expect } from 'vitest';
import { stripMarkdown, buildChatPlaintext } from '../utils/chatPlaintext';
import type { ChatMessage } from '../types';

describe('stripMarkdown', () => {
	it('elimina negritas, cursivas y código inline', () => {
		expect(stripMarkdown('Esto es **muy** _importante_ y `code`')).toBe('Esto es muy importante y code');
	});

	it('elimina bloques de código conservando el contenido', () => {
		expect(stripMarkdown('```js\nconst a = 1;\n```')).toBe('const a = 1;');
	});

	it('elimina encabezados y conserva el texto', () => {
		expect(stripMarkdown('# Título\n## Subtítulo')).toBe('Título\nSubtítulo');
	});

	it('convierte enlaces a solo su texto', () => {
		expect(stripMarkdown('Mira [aquí](https://example.com)')).toBe('Mira aquí');
	});

	it('aplana tablas a columnas separadas por tabulación y vacía la fila separadora', () => {
		const md = '| A | B |\n| --- | --- |\n| 1 | 2 |';
		// La fila separadora se vacía (deja una línea en blanco), las filas se tabulan.
		expect(stripMarkdown(md)).toBe('A\tB\n\n1\t2');
	});

	it('colapsa líneas en blanco múltiples y recorta', () => {
		expect(stripMarkdown('uno\n\n\n\ndos\n\n')).toBe('uno\n\ndos');
	});
});

describe('buildChatPlaintext', () => {
	const messages: ChatMessage[] = [
		{ role: 'user', content: '¿Cómo voy?', timestamp: '10:00' },
		{ role: 'model', content: 'Vas **bien**.', timestamp: '10:01' }
	];

	it('serializa cada mensaje con timestamp y rol', () => {
		expect(buildChatPlaintext(messages)).toBe('[10:00] Tú:\n¿Cómo voy?\n\n[10:01] Asesor Gemini:\nVas bien.');
	});

	it('no aplica stripMarkdown al mensaje del usuario', () => {
		const out = buildChatPlaintext([{ role: 'user', content: 'Texto **literal**', timestamp: '09:00' }]);
		expect(out).toBe('[09:00] Tú:\nTexto **literal**');
	});

	it('devuelve cadena vacía sin mensajes', () => {
		expect(buildChatPlaintext([])).toBe('');
	});
});
