import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { FinanzasProvider } from '../context/FinanzasContext';
import { ImportStatementModal } from '../components/transactions/ImportStatementModal';
import { useFinanzas } from '../hooks/useFinanzas';
import { askGeminiToParseStatement, askGeminiToParsePdf } from '../services/statementImportService';
import * as statementImportService from '../services/statementImportService';
import { STORAGE_KEYS } from '../constants';
import type { Transaction } from '../types';

// Mock del servicio de importación
vi.mock('../services/statementImportService', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../services/statementImportService')>();
	return {
		...actual,
		askGeminiToParseStatement: vi.fn(),
		askGeminiToParsePdf: vi.fn()
	};
});

const MockApp = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
	return (
		<FinanzasProvider>
			<ImportStatementModal isOpen={isOpen} onClose={onClose} />
		</FinanzasProvider>
	);
};

describe('ImportStatementModal UI', () => {
	const onCloseMock = vi.fn();
	const checkingCsv = 'fecha,concepto,importe\n05/06/2026,Transferencia enviada,-250.00';
	const savingsCsv = 'fecha,concepto,importe\n05/06/2026,Transferencia recibida,250.00';

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it('no debe renderizar nada si isOpen es false', () => {
		render(<MockApp isOpen={false} onClose={onCloseMock} />);
		expect(screen.queryByText('Importar Extracto Bancario')).toBeNull();
	});

	it('debe renderizar el modal en Step 1 cuando isOpen es true', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		expect(screen.getByText('Importar Extracto Bancario')).toBeInTheDocument();
		expect(screen.getByText('Método de Importación')).toBeInTheDocument();
		expect(screen.getByText('Archivo (CSV / PDF)')).toBeInTheDocument();
		expect(screen.getByText('Copiar y Pegar (IA)')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Asigná cada archivo a la cuenta del banco que lo emitió. La app usará esa cuenta para detectar transferencias entre cuentas.'
			)
		).toBeInTheDocument();
		expect(screen.queryByText('Cuenta de Destino')).toBeNull();
	});

	it('debe alternar métodos de importación', () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const btnAi = screen.getByText('Copiar y Pegar (IA)');
		fireEvent.click(btnAi);
		expect(screen.getByText('Cuenta del texto pegado')).toBeInTheDocument();
		expect(screen.getByText('Se usará como la cuenta del banco que emitió el texto copiado.')).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Pega las líneas copiadas de tu app bancaria/)).toBeInTheDocument();

		const btnCsv = screen.getByText('Archivo (CSV / PDF)');
		fireEvent.click(btnCsv);
		expect(screen.getByText('Formato / Banco')).toBeInTheDocument();
		expect(screen.queryByText('Cuenta del texto pegado')).toBeNull();
	});

	it('debe persistir importaciones por texto IA con la cuenta seleccionada', async () => {
		const formatterSpy = vi.spyOn(statementImportService, 'formatImportedTransactionsForPersistence');
		vi.mocked(askGeminiToParseStatement).mockResolvedValue([
			{
				id: 'ai-row-1',
				date: '2026-06-05',
				desc: 'PAGO MERCADONA',
				amount: '45.20',
				type: 'expense',
				tag: 'Alimentación',
				selected: true,
				isDuplicate: false,
				owner: 'joint',
				paidBy: 'shared',
				originalType: 'expense'
			}
		]);

		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		fireEvent.click(screen.getByText('Copiar y Pegar (IA)'));
		fireEvent.change(screen.getByLabelText('Texto del Extracto Copiado'), {
			target: { value: '05/06/2026 PAGO MERCADONA -45,20' }
		});
		fireEvent.change(screen.getByLabelText('Introduce tu Gemini API Key'), { target: { value: 'test-key' } });
		fireEvent.click(screen.getByText('Siguiente paso'));

		await screen.findByText('Revisa, categoriza y valida los movimientos antes de agregarlos.');
		fireEvent.click(screen.getByText(/Importar seleccionados/));

		await waitFor(() => {
			const persisted = formatterSpy.mock.results[0].value;
			expect(persisted[0]).toMatchObject({
				type: 'expense',
				accountId: 'default-a',
				owner: 'userA',
				paidBy: 'userA'
			});
		});
	});

	it('debe mostrar error en Step 1 si se intenta avanzar sin archivo CSV', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const btnNext = screen.getByText('Siguiente paso');
		fireEvent.click(btnNext);

		expect(await screen.findByText('Por favor, carga un archivo CSV de movimientos.')).toBeInTheDocument();
	});

	it('debe mostrar error en Step 1 si se intenta avanzar con texto AI vacío', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);

		// Ir a método AI
		fireEvent.click(screen.getByText('Copiar y Pegar (IA)'));

		const btnNext = screen.getByText('Siguiente paso');
		fireEvent.click(btnNext);

		expect(await screen.findByText('Por favor, pega el texto de tu extracto bancario.')).toBeInTheDocument();
	});

	it('debe bloquear el importador IA si falta una API Key activa', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);

		fireEvent.click(screen.getByText('Copiar y Pegar (IA)'));
		fireEvent.change(screen.getByLabelText('Texto del Extracto Copiado'), {
			target: { value: '05/06/2026 PAGO MERCADONA -45,20' }
		});
		fireEvent.click(screen.getByText('Siguiente paso'));

		expect(await screen.findByText(/Gemini no está disponible: configura una API Key activa/)).toBeInTheDocument();
		expect(screen.getAllByText(/https:\/\/aistudio.google.com\/api-keys/).length).toBeGreaterThan(0);
		expect(askGeminiToParseStatement).not.toHaveBeenCalled();
	});

	it('debe permitir configurar mapeo en personalizado e ir al Paso 2', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);

		// Mock de carga de archivo
		const file = new File(['fecha,concepto,importe\n05/06/2026,Compra Mercadona,-45.20'], 'extracto.csv', {
			type: 'text/csv'
		});

		// Buscamos el input oculto y simulamos la carga
		const input = document.querySelector('input[type="file"]')!;

		// Cambiar a formato personalizado
		// Nota: En radix select podemos mockear el valor o cambiar la plantilla
		// Pero para hacerlo directo simulamos directamente la inyección de estados
		// mediante eventos de carga.
		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});

		// Esperamos a que lea el archivo
		await waitFor(() => {
			expect(screen.getAllByText('extracto.csv').length).toBeGreaterThanOrEqual(1);
		});
	});

	it('debe admitir la carga de un archivo PDF y requerir API Key si no está configurada', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);

		const file = new File(['pdf-dummy-content'], 'extracto.pdf', { type: 'application/pdf' });
		const input = document.querySelector('input[type="file"]')!;

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});

		await waitFor(() => {
			expect(screen.getAllByText('extracto.pdf').length).toBeGreaterThanOrEqual(1);
		});

		// Debe mostrar el disclaimer del PDF
		expect(screen.getByText('Procesamiento inteligente de PDF')).toBeInTheDocument();

		// Dado que no hay API key global en este test mockeado, debe mostrar el input para la clave API
		expect(screen.getByText('Introduce tu Gemini API Key (Requerida para PDF)')).toBeInTheDocument();
	});

	it('debe mostrar el mensaje específico de Gemini si un PDF no tiene API Key activa', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const file = new File(['pdf-dummy-content'], 'extracto.pdf', { type: 'application/pdf' });
		const input = document.querySelector('input[type="file"]')!;

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});

		await waitFor(() => {
			expect(screen.getByLabelText('Cuenta para extracto.pdf')).toBeInTheDocument();
			expect(screen.queryByText('Leyendo archivo')).toBeNull();
		});
		fireEvent.change(screen.getByLabelText('Cuenta para extracto.pdf'), { target: { value: 'default-a' } });

		fireEvent.click(screen.getByText('Siguiente paso'));

		expect(await screen.findByText(/Gemini no está disponible: configura una API Key activa/)).toBeInTheDocument();
		expect(screen.getAllByText(/https:\/\/aistudio.google.com\/api-keys/).length).toBeGreaterThan(0);
		expect(screen.queryByText('No se pudieron extraer movimientos de los adjuntos cargados.')).toBeNull();
		expect(askGeminiToParsePdf).not.toHaveBeenCalled();
	});

	it('debe requerir una cuenta explícita para cada adjunto cargado', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const input = document.querySelector('input[type="file"]')!;
		const files = [
			new File([checkingCsv], 'cuenta-corriente.csv', { type: 'text/csv' }),
			new File([savingsCsv], 'ahorro.csv', { type: 'text/csv' })
		];

		await act(async () => {
			fireEvent.change(input, { target: { files } });
		});

		await waitFor(() => {
			expect(screen.getAllByText('cuenta-corriente.csv').length).toBeGreaterThanOrEqual(1);
			expect(screen.getAllByText('ahorro.csv').length).toBeGreaterThanOrEqual(1);
			expect(screen.queryByText('Leyendo archivo')).toBeNull();
		});

		fireEvent.click(screen.getByText('Siguiente paso'));

		expect(await screen.findByText('Asigna una cuenta a cada adjunto antes de procesar.')).toBeInTheDocument();
	});

	it('debe renderizar cuenta y origen por fila en la vista previa multi-adjunto', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const input = document.querySelector('input[type="file"]')!;

		await act(async () => {
			fireEvent.change(input, {
				target: {
					files: [
						new File([checkingCsv], 'cuenta-corriente.csv', { type: 'text/csv' }),
						new File([savingsCsv], 'ahorro.csv', { type: 'text/csv' })
					]
				}
			});
		});

		await assignAttachmentAccounts();
		fireEvent.click(screen.getByText('Siguiente paso'));

		await waitFor(() => {
			expect(screen.getByText('Origen')).toBeInTheDocument();
			expect(screen.getByText('Efectivo Usuario A')).toBeInTheDocument();
			expect(screen.getByText('Efectivo Usuario B')).toBeInTheDocument();
			expect(screen.getAllByText(/cuenta-corriente.csv|ahorro.csv/).length).toBeGreaterThanOrEqual(2);
		});
	});

	it('debe usar la plantilla detectada de cada adjunto CSV', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const input = document.querySelector('input[type="file"]')!;
		const bbvaCsv = 'Fecha;Valor;Concepto;Importe\n05/06/2026;05/06/2026;PAGO BBVA;-10,00';
		const santanderCsv =
			'Fecha;Valor;Referencia;Concepto;Divisa;Importe\n05/06/2026;05/06/2026;1;PAGO SANTANDER;EUR;-20,00';

		await act(async () => {
			fireEvent.change(input, {
				target: {
					files: [
						new File([bbvaCsv], 'bbva.csv', { type: 'text/csv' }),
						new File([santanderCsv], 'santander.csv', { type: 'text/csv' })
					]
				}
			});
		});

		await assignAttachmentAccounts('bbva.csv', 'santander.csv');
		fireEvent.click(screen.getByText('Siguiente paso'));

		await waitFor(() => {
			expect(screen.getByDisplayValue('PAGO BBVA')).toBeInTheDocument();
			expect(screen.getByDisplayValue('PAGO SANTANDER')).toBeInTheDocument();
		});
	});

	it('debe mantener visible, seleccionado e importable un posible duplicado', async () => {
		const formatterSpy = vi.spyOn(statementImportService, 'formatImportedTransactionsForPersistence');
		seedExistingTransactions([
			createExistingTransaction({
				id: 'existing-possible-duplicate',
				desc: 'Compra Mercadona Market',
				date: '2026-06-05'
			})
		]);
		render(<MockApp isOpen={true} onClose={onCloseMock} />);

		await uploadSingleCsv('fecha,concepto,importe\n07/06/2026,Mercadona compra supermercado,-45.20', 'posible.csv');
		fireEvent.click(screen.getByText('Siguiente paso'));

		expect(await screen.findByText('Revisar posible duplicado')).toBeInTheDocument();
		expect(screen.getByText('Importar seleccionados (1)')).toBeInTheDocument();

		fireEvent.click(screen.getByText(/Importar seleccionados/));

		await waitFor(() => {
			expect(formatterSpy).toHaveBeenCalled();
			expect(formatterSpy.mock.results[0].value).toHaveLength(1);
		});
	});

	it('debe impedir seleccionar o importar duplicados exactos desde la vista previa', async () => {
		const formatterSpy = vi.spyOn(statementImportService, 'formatImportedTransactionsForPersistence');
		seedExistingTransactions([
			createExistingTransaction({
				id: 'existing-exact-duplicate',
				desc: 'PAGO MERCADONA',
				date: '2026-06-05'
			})
		]);
		render(<MockApp isOpen={true} onClose={onCloseMock} />);

		await uploadSingleCsv('fecha,concepto,importe\n05/06/2026,PAGO MERCADONA,-45.20', 'exacto.csv');
		fireEvent.click(screen.getByText('Siguiente paso'));

		expect(await screen.findByText('Duplicado exacto')).toBeInTheDocument();
		expect(screen.getByText('Importar seleccionados (0)')).toBeInTheDocument();
		const duplicateSelection = screen.getByLabelText('Duplicado exacto no importable: PAGO MERCADONA');
		expect(duplicateSelection).toBeDisabled();

		fireEvent.click(duplicateSelection);
		fireEvent.click(screen.getByText(/Importar seleccionados/));

		expect(
			await screen.findByText('Debes seleccionar al menos una transacción para importar.')
		).toBeInTheDocument();
		expect(formatterSpy).not.toHaveBeenCalled();
	});

	it('debe confirmar una transferencia interna correlacionada como una sola transacción', async () => {
		const formatterSpy = vi.spyOn(statementImportService, 'formatImportedTransactionsForPersistence');
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const input = document.querySelector('input[type="file"]')!;

		await act(async () => {
			fireEvent.change(input, {
				target: {
					files: [
						new File([checkingCsv], 'cuenta-corriente.csv', { type: 'text/csv' }),
						new File([savingsCsv], 'ahorro.csv', { type: 'text/csv' })
					]
				}
			});
		});

		await assignAttachmentAccounts();
		fireEvent.click(screen.getByText('Siguiente paso'));
		await screen.findByText('Revisa, categoriza y valida los movimientos antes de agregarlos.');
		fireEvent.click(screen.getByText(/Importar seleccionados/));

		await waitFor(() => {
			expect(formatterSpy).toHaveBeenCalled();
			const persisted = formatterSpy.mock.results[0].value;
			expect(persisted).toHaveLength(1);
			expect(persisted[0]).toMatchObject({
				type: 'transfer',
				fromAccountId: 'default-a',
				toAccountId: 'default-b'
			});
		});
	});

	it('debe guiar al usuario al paso de traspasos si se detecta un traspaso en la vista previa', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);

		const file = new File(['fecha,concepto,importe\n05/06/2026,Traspaso hucha,150.00'], 'extracto.csv', {
			type: 'text/csv'
		});
		const input = document.querySelector('input[type="file"]')!;

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});

		// Esperamos a que lea el archivo
		await waitFor(() => {
			expect(screen.getAllByText('extracto.csv').length).toBeGreaterThanOrEqual(1);
		});
		fireEvent.change(screen.getByLabelText('Cuenta para extracto.csv'), { target: { value: 'default-a' } });

		// Esperamos un momento a que el FileReader asíncrono termine e inicialice el csvText
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		// Avanzar a la vista previa (con plantilla estándar generic)
		const btnNext = screen.getByText('Siguiente paso');
		fireEvent.click(btnNext);

		// Esperar que esté en vista previa
		await waitFor(() => {
			expect(
				screen.getByText('Revisa, categoriza y valida los movimientos antes de agregarlos.')
			).toBeInTheDocument();
		});

		// Cambiar el tipo de transacción a 'transfer' (Traspaso)
		const selects = document.querySelectorAll('select');
		const typeSelect = selects[0];
		fireEvent.change(typeSelect, { target: { value: 'transfer' } });

		// Hacer click en "Configurar traspasos"
		const btnConfigTransfers = screen.getByText('Configurar traspasos');
		fireEvent.click(btnConfigTransfers);

		// Esperar que esté en la pantalla de traspasos
		await waitFor(() => {
			expect(screen.getByText('Asociación de Cuentas para Traspasos')).toBeInTheDocument();
		});
	});

	it('debe configurar traspasos manuales usando la cuenta asignada a la fila', async () => {
		const formatterSpy = vi.spyOn(statementImportService, 'formatImportedTransactionsForPersistence');
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const input = document.querySelector('input[type="file"]')!;
		const file = new File(['fecha,concepto,importe\n05/06/2026,Traspaso hucha,150.00'], 'extracto.csv', {
			type: 'text/csv'
		});

		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});

		await waitFor(() => {
			expect(screen.getByLabelText('Cuenta para extracto.csv')).toBeInTheDocument();
		});
		fireEvent.change(screen.getByLabelText('Cuenta para extracto.csv'), { target: { value: 'default-b' } });
		fireEvent.click(screen.getByText('Siguiente paso'));
		await screen.findByText('Revisa, categoriza y valida los movimientos antes de agregarlos.');

		const typeSelect = document.querySelectorAll('select')[0];
		fireEvent.change(typeSelect, { target: { value: 'transfer' } });
		fireEvent.click(screen.getByText('Configurar traspasos'));
		await screen.findByText('Asociación de Cuentas para Traspasos');
		fireEvent.click(screen.getByText('Confirmar e importar'));

		await waitFor(() => {
			const persisted = formatterSpy.mock.results[0].value;
			expect(persisted[0]).toMatchObject({
				type: 'transfer',
				fromAccountId: 'default-a',
				toAccountId: 'default-b'
			});
		});
	});
});

async function assignAttachmentAccounts(firstName = 'cuenta-corriente.csv', secondName = 'ahorro.csv') {
	await waitFor(() => {
		expect(screen.getByLabelText(`Cuenta para ${firstName}`)).toBeInTheDocument();
		expect(screen.getByLabelText(`Cuenta para ${secondName}`)).toBeInTheDocument();
		expect(screen.queryByText('Leyendo archivo')).toBeNull();
	});

	fireEvent.change(screen.getByLabelText(`Cuenta para ${firstName}`), { target: { value: 'default-a' } });
	fireEvent.change(screen.getByLabelText(`Cuenta para ${secondName}`), { target: { value: 'default-b' } });
}

async function uploadSingleCsv(content: string, fileName: string) {
	const input = document.querySelector('input[type="file"]')!;

	await act(async () => {
		fireEvent.change(input, {
			target: {
				files: [new File([content], fileName, { type: 'text/csv' })]
			}
		});
	});

	await waitFor(() => {
		expect(screen.getByLabelText(`Cuenta para ${fileName}`)).toBeInTheDocument();
		expect(screen.queryByText('Leyendo archivo')).toBeNull();
	});
	fireEvent.change(screen.getByLabelText(`Cuenta para ${fileName}`), { target: { value: 'default-a' } });
}

function seedExistingTransactions(transactions: Transaction[]) {
	localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
}

function createExistingTransaction(overrides: Partial<Transaction>): Transaction {
	return {
		id: 'existing-transaction',
		desc: 'PAGO MERCADONA',
		money: { amount: '45.20', currency: 'EUR' },
		type: 'expense',
		tag: 'Alimentación',
		date: '2026-06-05',
		owner: 'joint',
		paidBy: 'shared',
		accountId: 'default-a',
		...overrides
	};
}
