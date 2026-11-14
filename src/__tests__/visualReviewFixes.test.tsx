import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../components/App';

describe('correcciones de la revisión visual', () => {
	it('debe aplicar color-scheme claro sobre el propio <html> con clase light', () => {
		const css = readFileSync(path.resolve(__dirname, '../../styles.css'), 'utf8');

		// `.light` vive en <html>: `.light html` nunca coincide y deja los controles nativos en oscuro.
		expect(css).toMatch(/html\.light\s*\{[^}]*color-scheme:\s*light/);
		expect(css).not.toMatch(/\.light\s+html\s*\{/);
	});

	it('debe mostrar etiquetas de perfil distinguibles cuando los nombres comparten prefijo', async () => {
		render(<App />);

		await screen.findByText('Bienvenido a Finanzas Snake');
		fireEvent.click(screen.getByRole('button', { name: 'Inicializar Planificación' }));

		// Sin recorte a 3 letras: «Usuario A» y «Usuario B» no pueden mostrarse ambos como «Usu».
		expect(await screen.findByRole('button', { name: 'Usuario A' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Usuario B' })).toBeInTheDocument();
		expect(screen.queryAllByText('Usu')).toHaveLength(0);
	});
});
