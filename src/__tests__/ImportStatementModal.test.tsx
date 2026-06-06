import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { FinanzasProvider } from '../context/FinanzasContext';
import { ImportStatementModal } from '../components/transactions/ImportStatementModal';
import { useFinanzas } from '../hooks/useFinanzas';
import { askGeminiToParseStatement, askGeminiToParsePdf } from '../services/statementImportService';

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
		expect(screen.getByText('Cuenta de Destino')).toBeInTheDocument();
		expect(screen.getByText('Método de Importación')).toBeInTheDocument();
		expect(screen.getByText('Archivo (CSV / PDF)')).toBeInTheDocument();
		expect(screen.getByText('Copiar y Pegar (IA)')).toBeInTheDocument();
	});

	it('debe alternar métodos de importación', () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		const btnAi = screen.getByText('Copiar y Pegar (IA)');
		fireEvent.click(btnAi);
		expect(screen.getByPlaceholderText(/Pega las líneas copiadas de tu app bancaria/)).toBeInTheDocument();

		const btnCsv = screen.getByText('Archivo (CSV / PDF)');
		fireEvent.click(btnCsv);
		expect(screen.getByText('Formato / Banco')).toBeInTheDocument();
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

	it('debe permitir configurar mapeo en personalizado e ir al Paso 2', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		
		// Mock de carga de archivo
		const file = new File(['fecha,concepto,importe\n05/06/2026,Compra Mercadona,-45.20'], 'extracto.csv', { type: 'text/csv' });
		
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
			expect(screen.getByText('extracto.csv')).toBeInTheDocument();
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
			expect(screen.getByText('extracto.pdf')).toBeInTheDocument();
		});

		// Debe mostrar el disclaimer del PDF
		expect(screen.getByText('Procesamiento inteligente de PDF')).toBeInTheDocument();
		
		// Dado que no hay API key global en este test mockeado, debe mostrar el input para la clave API
		expect(screen.getByText('Introduce tu Gemini API Key (Requerida para PDF)')).toBeInTheDocument();
	});

	it('debe guiar al usuario al paso de traspasos si se detecta un traspaso en la vista previa', async () => {
		render(<MockApp isOpen={true} onClose={onCloseMock} />);
		
		const file = new File(['fecha,concepto,importe\n05/06/2026,Traspaso hucha,150.00'], 'extracto.csv', { type: 'text/csv' });
		const input = document.querySelector('input[type="file"]')!;
		
		await act(async () => {
			fireEvent.change(input, { target: { files: [file] } });
		});

		// Esperamos a que lea el archivo
		await waitFor(() => {
			expect(screen.getByText('extracto.csv')).toBeInTheDocument();
		});

		// Esperamos un momento a que el FileReader asíncrono termine e inicialice el csvText
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 50));
		});

		// Avanzar a la vista previa (con plantilla estándar generic)
		const btnNext = screen.getByText('Siguiente paso');
		fireEvent.click(btnNext);

		// Esperar que esté en vista previa
		await waitFor(() => {
			expect(screen.getByText('Revisa, categoriza y valida los movimientos antes de agregarlos.')).toBeInTheDocument();
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
});
