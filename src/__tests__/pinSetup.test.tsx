import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../components/App';
import { FinanzasProvider } from '../context/FinanzasContext';
import { useFinanzas } from '../hooks/useFinanzas';
import { readProfileCount, readStoredAccounts, setCryptoKey } from '../services/storageService';

const SALT_KEY = 'finanzas_v3_password_salt';

const enterApp = async () => {
	render(<App />);
	await screen.findByText('Bienvenido a Finanzas Snake');
	fireEvent.click(screen.getByRole('button', { name: 'Inicializar Planificación' }));
	return screen.findByRole('button', { name: 'Configurar PIN de Seguridad' });
};

/** Deja pasar los efectos asíncronos del arranque, que antes devolvían la pantalla a la app. */
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

describe('configuración del PIN desde la interfaz', () => {
	beforeEach(() => {
		localStorage.clear();
		setCryptoKey(null);
	});

	afterEach(() => {
		cleanup();
		setCryptoKey(null);
	});

	it('debe abrir la pantalla de configuración y mantenerla hasta que la persona decida', async () => {
		fireEvent.click(await enterApp());
		await settle();

		expect(screen.getByText('Configurar PIN de acceso')).toBeInTheDocument();
		expect(screen.getByText(/no se puede recuperar/i)).toBeInTheDocument();
	});

	it('debe activar el cifrado conservando los datos que había en memoria', async () => {
		fireEvent.click(await enterApp());
		await settle();

		fireEvent.change(screen.getByLabelText(/Nuevo PIN/), { target: { value: '1234' } });
		fireEvent.change(screen.getByLabelText('Confirmar PIN'), { target: { value: '1234' } });
		fireEvent.click(screen.getByRole('button', { name: 'Activar seguridad local' }));

		expect(await screen.findByRole('button', { name: 'Bloquear Aplicación' })).toBeInTheDocument();
		expect(screen.queryByText('Bienvenido a Finanzas Snake')).not.toBeInTheDocument();
		expect(localStorage.getItem(SALT_KEY)).not.toBeNull();
		expect((await readStoredAccounts()).length).toBeGreaterThan(0);
	});

	it('debe volver a la aplicación sin activar el cifrado al cancelar', async () => {
		fireEvent.click(await enterApp());
		await settle();

		fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

		expect(await screen.findByRole('button', { name: 'Configurar PIN de Seguridad' })).toBeInTheDocument();
		expect(screen.queryByText('Bienvenido a Finanzas Snake')).not.toBeInTheDocument();
		expect(localStorage.getItem(SALT_KEY)).toBeNull();
	});
});

describe('número de perfiles con PIN activo', () => {
	beforeEach(() => {
		localStorage.clear();
		setCryptoKey(null);
	});

	afterEach(() => {
		cleanup();
		setCryptoKey(null);
	});

	let api: ReturnType<typeof useFinanzas>;
	const Probe = () => {
		api = useFinanzas();
		return <output data-testid="profiles">{api.profileCount}</output>;
	};
	const mount = () =>
		render(
			<FinanzasProvider>
				<Probe />
			</FinanzasProvider>
		);

	it('debe restaurar un solo perfil tras recargar y desbloquear', async () => {
		const first = mount();
		await waitFor(() => expect(api.isInitialized).toBe(true));
		act(() => api.setProfileCount(1));
		await waitFor(async () => expect(await readProfileCount()).toBe(1));
		await act(async () => {
			expect(await api.handleSetupPassword('1234')).toBe(true);
		});

		// Recarga: se pierde la memoria y la clave; quedan el disco y la sal.
		first.unmount();
		setCryptoKey(null);
		mount();
		await waitFor(() => expect(api.isLocked).toBe(true));
		expect(screen.getByTestId('profiles')).toHaveTextContent('2');

		await act(async () => {
			expect(await api.handleUnlock('1234')).toBe(true);
		});

		expect(screen.getByTestId('profiles')).toHaveTextContent('1');
		await settle();
		expect(await readProfileCount()).toBe(1);
	});
});
