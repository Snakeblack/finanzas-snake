import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../components/App';

vi.mock('../components/transactions/ImportStatementModal', () => ({
	ImportStatementModal: ({ isOpen }: { isOpen: boolean }) => (
		isOpen ? <div role="dialog">Importar Extracto Bancario</div> : null
	)
}));

describe('onboarding inicial', () => {
	it('debe permitir importar PDF/CSV por cuenta desde cero con saldos en blanco', async () => {
		render(<App />);

		await screen.findByText('Bienvenido a Finanzas Snake');

		for (const input of screen.getAllByLabelText(/Saldo inicial:/)) {
			fireEvent.change(input, { target: { value: '' } });
		}

		fireEvent.click(screen.getByRole('button', { name: 'Importar PDF/CSV por cuenta' }));

		await waitFor(() => {
			expect(screen.getByRole('dialog')).toHaveTextContent('Importar Extracto Bancario');
		});
	});

	it('debe inicializar saldos vacíos en cero y abrir la configuración de cuentas', async () => {
		render(<App />);

		await screen.findByText('Bienvenido a Finanzas Snake');

		for (const input of screen.getAllByLabelText(/Saldo inicial:/)) {
			fireEvent.change(input, { target: { value: '' } });
		}

		fireEvent.click(screen.getByRole('button', { name: 'Configurar cuentas' }));

		await screen.findByText('Cuentas Configuradas');
		expect(screen.getAllByText('Saldo Inicial: 0,00€').length).toBeGreaterThan(0);
	});
});
