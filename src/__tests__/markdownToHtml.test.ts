import { describe, it, expect } from 'vitest';
import { convertMarkdownToHtml } from '../utils/markdownToHtml';

describe('convertMarkdownToHtml', () => {
	it('convierte negritas y escapa HTML peligroso en el texto inline', () => {
		const html = convertMarkdownToHtml('Hola **mundo** <script>');
		expect(html).toContain('<strong>mundo</strong>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('<script>');
	});

	it('renderiza listas no ordenadas y ordenadas', () => {
		const ul = convertMarkdownToHtml('- uno\n- dos');
		expect(ul).toContain('<ul');
		expect(ul.match(/<li/g)).toHaveLength(2);

		const ol = convertMarkdownToHtml('1. uno\n2. dos');
		expect(ol).toContain('<ol');
	});

	it('renderiza encabezados desplazando dos niveles (h1 -> h3)', () => {
		expect(convertMarkdownToHtml('# Título')).toContain('<h3');
	});

	it('renderiza bloques de código con su lenguaje', () => {
		const html = convertMarkdownToHtml('```js\nconst a = 1;\n```');
		expect(html).toContain('<pre');
		expect(html).toContain('const a = 1;');
		expect(html).toContain('>js<'); // etiqueta de lenguaje en el span
	});

	it('renderiza una tabla Markdown como <table> con cabecera y celdas', () => {
		const html = convertMarkdownToHtml('| A | B |\n| --- | --- |\n| 1 | 2 |');
		expect(html).toContain('<table');
		expect(html).toContain('<th style="padding: 8px 12px; border-right: 1px solid #e2e8f0; ">A</th>');
		expect(html).toContain('>1</td>');
	});

	it('aplica alineación cuando el separador lleva pipe de cierre y alineación', () => {
		const html = convertMarkdownToHtml('| A | B |\n| :-- | --: |\n| 1 | 2 |');
		expect(html).toContain('text-align: right;');
	});

	it('aplica alineación cuando el separador NO lleva pipe de cierre', () => {
		const html = convertMarkdownToHtml('| A | B |\n| :-- | --:\n| 1 | 2 |');
		expect(html).toContain('text-align: right;');
	});

	it('renderiza tablas de una sola columna', () => {
		const html = convertMarkdownToHtml('| A |\n| :-- |\n| 1 |');
		expect(html).toContain('<table');
		expect(html).toContain('text-align: left;');
		expect(html).toContain('>1</td>');
	});
});
