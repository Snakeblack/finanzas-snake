import React, { useState, useEffect, useRef } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription
} from '../ui/dialog';
import { Input } from '../ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from '../ui/select';
import {
	parseCSV,
	detectSeparator,
	BANK_TEMPLATES,
	processParsedRows,
	detectDuplicates,
	prepareImportedTransactions,
	correlateInternalTransfers,
	formatImportedTransactionsForPersistence,
	askGeminiToParseStatement,
	askGeminiToParsePdf
} from '../../services/statementImportService';
import { GEMINI_API_KEY_SETUP_URL, GEMINI_API_KEY_UNAVAILABLE_MESSAGE, isGeminiApiKeyError } from '../../services/geminiService';
import { DEFAULT_TAGS } from '../../constants';
import { ImportedTransaction, TransactionType } from '../../types';
import {
	Upload,
	FileText,
	AlertTriangle,
	CheckCircle,
	CheckSquare,
	Square,
	ChevronRight,
	Loader2,
	Trash2,
	RefreshCw,
	Settings,
	Sparkles
} from 'lucide-react';

interface ImportStatementModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type ImportMethod = 'csv' | 'ai';
type Step = 'config' | 'mapping' | 'preview' | 'transfers';

type ImportAttachmentStatus = 'loading' | 'ready' | 'error';

interface ImportAttachment {
	id: string;
	name: string;
	type: 'csv' | 'pdf';
	accountId: string;
	templateKey: keyof typeof BANK_TEMPLATES;
	csvText: string;
	csvRows: string[][];
	pdfBase64: string;
	status: ImportAttachmentStatus;
	error?: string;
}

const getErrorMessage = (error: unknown): string => error instanceof Error ? error.message : '';

const getGeminiApiKeyFailureMessage = (results: PromiseSettledResult<ImportedTransaction[]>[]): string => {
	const geminiFailure = results.find((result) => result.status === 'rejected' && isGeminiApiKeyError(result.reason));

	if (!geminiFailure || geminiFailure.status !== 'rejected') {
		return '';
	}

	return getErrorMessage(geminiFailure.reason) || GEMINI_API_KEY_UNAVAILABLE_MESSAGE;
};

const detectTemplateKey = (fileName: string): keyof typeof BANK_TEMPLATES => {
	const lowerName = fileName.toLowerCase();

	if (lowerName.includes('bbva')) return 'bbva';
	if (lowerName.includes('santander')) return 'santander';
	if (lowerName.includes('caixa')) return 'caixabank';
	if (lowerName.includes('revolut')) return 'revolut';

	return 'generic';
};

export function ImportStatementModal({ isOpen, onClose }: ImportStatementModalProps) {
	const {
		accounts,
		transactions,
		setTransactions,
		geminiApiKey,
		userAName,
		userBName
	} = useFinanzas();

	// Estados principales
	const [step, setStep] = useState<Step>('config');
	const [method, setMethod] = useState<ImportMethod>('csv');
	const [selectedAccountId, setSelectedAccountId] = useState<string>('');
	const [templateKey, setTemplateKey] = useState<string>('generic');

	// CSV States
	const [csvText, setCsvText] = useState<string>('');
	const [csvRows, setCsvRows] = useState<string[][]>([]);
	const [csvFilename, setCsvFilename] = useState<string>('');
	const [attachments, setAttachments] = useState<ImportAttachment[]>([]);
	
	// Mapeo Personalizado
	const [customMapping, setCustomMapping] = useState({
		dateCol: 0,
		descCol: 1,
		amountCol: 2,
		balanceCol: -1,
		hasHeader: true
	});

	// AI States
	const [aiText, setAiText] = useState<string>('');
	const [localApiKey, setLocalApiKey] = useState<string>('');

	// PDF States
	const [isPdf, setIsPdf] = useState<boolean>(false);
	const [pdfBase64, setPdfBase64] = useState<string>('');

	// Loading & Errors
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [error, setError] = useState<string>('');
	const hasLoadingAttachments = attachments.some((attachment) => attachment.status === 'loading');

	// Vista Previa de Transacciones
	const [importedTxs, setImportedTxs] = useState<ImportedTransaction[]>([]);
	const hasBalance = importedTxs.some((tx) => tx.balance !== undefined && tx.balance !== null && tx.balance !== '');
	const possibleDuplicateCount = importedTxs.filter((tx) => tx.possibleDuplicate && !tx.isDuplicate).length;
	const selectedImportableTxs = importedTxs.filter((tx) => tx.selected && !tx.isDuplicate);
	const importableTxs = importedTxs.filter((tx) => !tx.isDuplicate);
	const allImportableTxsSelected = importableTxs.length > 0 && importableTxs.every((tx) => tx.selected);

	// Referencias de archivos
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Inicializar cuenta seleccionada
	useEffect(() => {
		if (accounts.length > 0 && !selectedAccountId) {
			setSelectedAccountId(accounts[0].id);
		}
	}, [accounts, selectedAccountId]);

	// Inicializar API Key local con la global
	useEffect(() => {
		if (geminiApiKey) {
			setLocalApiKey(geminiApiKey);
		}
	}, [geminiApiKey]);

	// Resetear estados al cerrar
	const handleClose = () => {
		setStep('config');
		setCsvText('');
		setCsvRows([]);
		setCsvFilename('');
		setAttachments([]);
		setIsPdf(false);
		setPdfBase64('');
		setAiText('');
		setImportedTxs([]);
		setError('');
		setIsLoading(false);
		onClose();
	};

	// Manejar arrastre en la zona de archivos
	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		const files = e.dataTransfer.files;
		if (files?.length) handleFiles(files);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (files?.length) handleFiles(files);
	};

	const handleFiles = (fileList: FileList | File[]) => {
		Array.from(fileList).forEach((file, index) => handleFile(file, index));
	};

	const handleFile = (file: File, index = 0) => {
		const isPdfFile = file.name.toLowerCase().endsWith('.pdf');
		const isCsvFile = file.name.toLowerCase().endsWith('.csv');

		if (!isPdfFile && !isCsvFile) {
			setError('Por favor, selecciona un archivo en formato .csv o .pdf');
			return;
		}
		setError('');
		setCsvFilename(file.name);
		const attachmentId = `${file.name}-${file.size}-${file.lastModified}-${index}`;
		const attachmentBase: ImportAttachment = {
			id: attachmentId,
			name: file.name,
			type: isPdfFile ? 'pdf' : 'csv',
			accountId: '',
			templateKey: isCsvFile ? detectTemplateKey(file.name) : 'generic',
			csvText: '',
			csvRows: [],
			pdfBase64: '',
			status: 'loading'
		};

		setAttachments((prev) => [...prev.filter((attachment) => attachment.id !== attachmentId), attachmentBase]);

		if (isPdfFile) {
			setIsPdf(true);
			setCsvText('');
			setCsvRows([]);
			
			const reader = new FileReader();
			reader.onload = (event) => {
				const result = event.target?.result as string;
				const base64Data = result.split(',')[1] || '';
				setPdfBase64(base64Data);
				setAttachments((prev) =>
					prev.map((attachment) =>
						attachment.id === attachmentId
							? { ...attachment, pdfBase64: base64Data, status: base64Data ? 'ready' : 'error', error: base64Data ? undefined : 'PDF inválido' }
							: attachment
					)
				);
			};
			reader.readAsDataURL(file);
		} else {
			setIsPdf(false);
			setPdfBase64('');
			
			const reader = new FileReader();
			reader.onload = (event) => {
				const text = event.target?.result as string;
				setCsvText(text);
				
				// Auto-detectar separador
				const sep = detectSeparator(text);
				const rows = parseCSV(text, sep);
				setCsvRows(rows);
				setAttachments((prev) =>
					prev.map((attachment) =>
						attachment.id === attachmentId
							? { ...attachment, csvText: text, csvRows: rows, status: 'ready' }
							: attachment
					)
				);

				setTemplateKey(detectTemplateKey(file.name));
			};
			reader.readAsText(file);
		}
	};

	const parseAttachment = async (attachment: ImportAttachment): Promise<ImportedTransaction[]> => {
		const targetAccount = accounts.find(a => a.id === attachment.accountId);
		if (!targetAccount) {
			throw new Error('Cuenta no encontrada');
		}

		if (attachment.type === 'pdf') {
			const activeKey = localApiKey || geminiApiKey;
			if (!activeKey) {
				throw new Error(GEMINI_API_KEY_UNAVAILABLE_MESSAGE);
			}

			const parsed = await askGeminiToParsePdf(activeKey, attachment.pdfBase64, { accountName: targetAccount.name });
			return prepareImportedTransactions({
				transactions: parsed,
				accountId: attachment.accountId,
				sourceName: attachment.name,
				accountOwner: targetAccount.owner
			});
		}

		const template = BANK_TEMPLATES[attachment.templateKey];
		const rows = attachment.csvRows.length > 0 ? attachment.csvRows : parseCSV(attachment.csvText, detectSeparator(attachment.csvText));
		const parsed = processParsedRows(rows, template);

		return prepareImportedTransactions({
			transactions: parsed,
			accountId: attachment.accountId,
			sourceName: attachment.name,
			accountOwner: targetAccount.owner
		});
	};

	const processAttachments = async () => {
		if (attachments.length === 0) {
			return false;
		}

		if (attachments.some((attachment) => !attachment.accountId)) {
			setError('Asigna una cuenta a cada adjunto antes de procesar.');
			return true;
		}

		if (attachments.some((attachment) => attachment.status === 'loading')) {
			setError('Espera a que todos los adjuntos terminen de cargarse antes de procesar.');
			return true;
		}

		if (attachments.some((attachment) => attachment.status === 'error')) {
			setError('Quita los adjuntos con error antes de procesar.');
			return true;
		}

		setIsLoading(true);
		try {
			const parsedGroups = await Promise.allSettled(attachments.map(parseAttachment));
			const successfulTxs = parsedGroups.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
			const failedAttachments = parsedGroups
				.map((result, index) => result.status === 'rejected' ? attachments[index].name : '')
				.filter(Boolean);

			if (successfulTxs.length === 0) {
				setError(getGeminiApiKeyFailureMessage(parsedGroups) || 'No se pudieron extraer movimientos de los adjuntos cargados.');
				return true;
			}

			const correlatedTxs = correlateInternalTransfers(successfulTxs);
			const checkedTxs = detectDuplicates(correlatedTxs, transactions);
			setImportedTxs(checkedTxs);
			setStep('preview');

			if (failedAttachments.length > 0) {
				setError(`No se pudieron procesar estos adjuntos: ${failedAttachments.join(', ')}.`);
			}
		} catch (err: unknown) {
			setError(getErrorMessage(err) || 'Ocurrió un error inesperado al procesar los adjuntos.');
		} finally {
			setIsLoading(false);
		}

		return true;
	};

	// Procesar Paso 1
	const handleProcessConfig = async () => {
		setError('');
		if (method === 'csv' && templateKey === 'custom') {
			const csvAttachments = attachments.filter((attachment) => attachment.type === 'csv');
			if (csvAttachments.length !== 1 || attachments.length !== 1) {
				setError('El mapeo personalizado solo admite un adjunto CSV. Quita los demás adjuntos o usa una plantilla por archivo.');
				return;
			}
			const [attachment] = csvAttachments;
			if (!attachment.accountId) {
				setError('Asigna una cuenta al adjunto antes de configurar el mapeo personalizado.');
				return;
			}
			if (attachment.status === 'loading') {
				setError('Espera a que el adjunto termine de cargarse antes de configurar el mapeo.');
				return;
			}
			if (attachment.status === 'error') {
				setError('Quita el adjunto con error antes de configurar el mapeo.');
				return;
			}

			setSelectedAccountId(attachment.accountId);
			setCsvText(attachment.csvText);
			setCsvRows(attachment.csvRows);
			setCsvFilename(attachment.name);
			setStep('mapping');
			return;
		}

		if (method === 'csv' && await processAttachments()) {
			return;
		}
		if (!selectedAccountId) {
			setError('Por favor, selecciona una cuenta para asociar los movimientos.');
			return;
		}

		if (method === 'csv') {
			if (isPdf) {
				if (!pdfBase64) {
					setError('Por favor, selecciona un archivo PDF válido.');
					return;
				}
				const activeKey = localApiKey || geminiApiKey;
				if (!activeKey) {
					setError(GEMINI_API_KEY_UNAVAILABLE_MESSAGE);
					return;
				}

				setIsLoading(true);
				try {
					const targetAccount = accounts.find(a => a.id === selectedAccountId);
					const parsed = await askGeminiToParsePdf(activeKey, pdfBase64, { accountName: targetAccount?.name });
					if (parsed.length === 0) {
						setError('La IA no pudo detectar transacciones en el PDF provisto. Asegúrate de que el documento es un extracto válido.');
						setIsLoading(false);
						return;
					}

					const finalTxs = prepareImportedTransactions({
						transactions: parsed,
						accountId: selectedAccountId,
						sourceName: csvFilename || 'extracto.pdf',
						accountOwner: targetAccount?.owner || 'joint'
					});

					const checkedTxs = detectDuplicates(finalTxs, transactions);
					setImportedTxs(checkedTxs);
					setStep('preview');
				} catch (err: any) {
					setError(err.message || 'Ocurrió un error inesperado al procesar el PDF con IA.');
				} finally {
					setIsLoading(false);
				}
			} else {
				if (!csvText) {
					setError('Por favor, carga un archivo CSV de movimientos.');
					return;
				}

				if (templateKey === 'custom') {
					// Ir al configurador de mapeo
					setStep('mapping');
				} else {
					// Procesar con plantilla seleccionada
					const template = BANK_TEMPLATES[templateKey as keyof typeof BANK_TEMPLATES];
					const sep = detectSeparator(csvText);
					const rows = parseCSV(csvText, sep);
					const parsed = processParsedRows(rows, template);
					
					if (parsed.length === 0) {
						setError('No se pudieron extraer movimientos. Verifica que el archivo CSV tiene el formato esperado.');
						return;
					}
					
					const targetAccount = accounts.find(a => a.id === selectedAccountId);
					const finalTxs = prepareImportedTransactions({
						transactions: parsed,
						accountId: selectedAccountId,
						sourceName: csvFilename || 'extracto.csv',
						accountOwner: targetAccount?.owner || 'joint'
					});

					const checkedTxs = detectDuplicates(finalTxs, transactions);
					setImportedTxs(checkedTxs);
					setStep('preview');
				}
			}
		} else {
			// Método AI
			if (!aiText.trim()) {
				setError('Por favor, pega el texto de tu extracto bancario.');
				return;
			}
			const activeKey = localApiKey || geminiApiKey;
			if (!activeKey) {
				setError(GEMINI_API_KEY_UNAVAILABLE_MESSAGE);
				return;
			}

			setIsLoading(true);
			try {
				const parsed = await askGeminiToParseStatement(activeKey, aiText);
				if (parsed.length === 0) {
					setError('La IA no pudo detectar transacciones en el texto provisto. Asegúrate de incluir importes y fechas.');
					setIsLoading(false);
					return;
				}

				const targetAccount = accounts.find(a => a.id === selectedAccountId);
				const finalTxs = prepareImportedTransactions({
					transactions: parsed,
					accountId: selectedAccountId,
					sourceName: 'Texto pegado (IA)',
					accountOwner: targetAccount?.owner || 'joint'
				});

				const checkedTxs = detectDuplicates(finalTxs, transactions);
				setImportedTxs(checkedTxs);
				setStep('preview');
			} catch (err: any) {
				setError(err.message || 'Ocurrió un error inesperado al procesar con IA.');
			} finally {
				setIsLoading(false);
			}
		}
	};

	// Confirmar mapeo personalizado
	const handleProcessCustomMapping = () => {
		const parsed = processParsedRows(csvRows, customMapping);
		if (parsed.length === 0) {
			setError('No se pudieron extraer movimientos con este mapeo. Comprueba los índices de las columnas.');
			return;
		}

		const targetAccount = accounts.find(a => a.id === selectedAccountId);
		const finalTxs = prepareImportedTransactions({
			transactions: parsed,
			accountId: selectedAccountId,
			sourceName: csvFilename || 'custom.csv',
			accountOwner: targetAccount?.owner || 'joint'
		});

		const checkedTxs = detectDuplicates(finalTxs, transactions);
		setImportedTxs(checkedTxs);
		setStep('preview');
	};

	// Cambios en los inputs de transacciones en vista previa
	const handleTxChange = (id: string, patch: Partial<ImportedTransaction>) => {
		setImportedTxs(prev =>
			prev.map(tx => (tx.id === id ? { ...tx, ...patch } as ImportedTransaction : tx))
		);
	};

	const handleAttachmentAccountChange = (id: string, accountId: string) => {
		setAttachments(prev =>
			prev.map(attachment => (attachment.id === id ? { ...attachment, accountId } : attachment))
		);
	};

	const handleAttachmentTemplateChange = (id: string, attachmentTemplateKey: keyof typeof BANK_TEMPLATES) => {
		setAttachments(prev =>
			prev.map(attachment => (attachment.id === id ? { ...attachment, templateKey: attachmentTemplateKey } : attachment))
		);
	};

	const handleRemoveAttachment = (id: string) => {
		setAttachments(prev => prev.filter(attachment => attachment.id !== id));
	};

	// Alternar selección de una transacción en vista previa
	const toggleSelectTx = (id: string) => {
		setImportedTxs(prev =>
			prev.map(tx => (tx.id === id && !tx.isDuplicate ? { ...tx, selected: !tx.selected } : tx))
		);
	};

	// Alternar selección de todas las transacciones
	const toggleSelectAll = () => {
		setImportedTxs(prev =>
			prev.map(tx => (tx.isDuplicate ? tx : { ...tx, selected: !allImportableTxsSelected }))
		);
	};

	// Eliminar fila de la vista previa
	const handleDeleteRow = (id: string) => {
		setImportedTxs(prev => prev.filter(tx => tx.id !== id));
	};

	// Confirmar importación
	const handleImportConfirm = () => {
		if (selectedImportableTxs.length === 0) {
			setError('Debes seleccionar al menos una transacción para importar.');
			return;
		}

		const formattedTxs = formatImportedTransactionsForPersistence(selectedImportableTxs, accounts);

		// Mezclar y ordenar por fecha descendente
		const newTransactionsList = [...formattedTxs, ...transactions].sort((a, b) =>
			b.date.localeCompare(a.date)
		);

		setTransactions(newTransactionsList);
		handleClose();
	};

	const getPossibleDuplicateLabel = (tx: ImportedTransaction): string => {
		if (!tx.possibleDuplicate) {
			return '';
		}

		return `Revisar posible duplicado: ${tx.possibleDuplicate.reason}. Movimiento existente del ${tx.possibleDuplicate.existingDate}.`;
	};

	const handleNextFromPreview = () => {
		if (selectedImportableTxs.length === 0) {
			setError('Debes seleccionar al menos una transacción para importar.');
			return;
		}

		// Check if any selected transaction is a transfer
		const hasTransfers = selectedImportableTxs.some(tx => tx.type === 'transfer' && !tx.transferCorrelationId);
		if (hasTransfers) {
			// Initialize default from/to accounts for transfer transactions if they are not set yet
			setImportedTxs(prev =>
				prev.map(tx => {
					if (tx.selected && tx.type === 'transfer') {
						const rowAccountId = tx.accountId || selectedAccountId;
						const otherAccounts = accounts.filter(a => a.id !== rowAccountId);
						const defaultOtherId = otherAccounts[0]?.id || '';
						
						return {
							...tx,
							fromAccountId: tx.fromAccountId || (tx.originalType === 'expense' ? rowAccountId : defaultOtherId),
							toAccountId: tx.toAccountId || (tx.originalType === 'income' ? rowAccountId : defaultOtherId)
						};
					}
					return tx;
				})
			);
			setStep('transfers');
		} else {
			handleImportConfirm();
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(val) => { if (!val) handleClose(); }}>
			<DialogContent className={`premium-card p-6 border border-slate-800 bg-slate-900 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto ${step === 'preview' || step === 'transfers' ? 'sm:max-w-5xl w-[90vw]' : 'sm:max-w-xl w-[95vw]'}`}>
				<DialogHeader className="mb-4">
					<div className="flex items-center gap-3">
						<div className="p-2.5 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
							<Upload className="w-5 h-5" />
						</div>
						<div>
							<DialogTitle className="text-xl font-bold tracking-wide text-slate-100">
								Importar Extracto Bancario
							</DialogTitle>
							<DialogDescription className="text-xs text-slate-450 mt-1">
								{step === 'config' && 'Configura el origen y el método de carga.'}
								{step === 'mapping' && 'Asocia las columnas de tu CSV con los campos requeridos.'}
								{step === 'preview' && 'Revisa, categoriza y valida los movimientos antes de agregarlos.'}
								{step === 'transfers' && 'Asocia las cuentas de origen y destino para cada traspaso.'}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{/* INDICADOR DE PASOS */}
				<div className="flex items-center gap-2 mb-6 border-b border-slate-800/80 pb-4 text-xs font-semibold shrink-0">
					<span className={`px-2 py-1 rounded-lg ${step === 'config' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-950 text-slate-450'}`}>
						1. Configuración
					</span>
					<ChevronRight className="w-3.5 h-3.5 text-slate-650" />
					{templateKey === 'custom' && (
						<>
							<span className={`px-2 py-1 rounded-lg ${step === 'mapping' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-950 text-slate-450'}`}>
								2. Mapeo
							</span>
							<ChevronRight className="w-3.5 h-3.5 text-slate-650" />
						</>
					)}
					<span className={`px-2 py-1 rounded-lg ${step === 'preview' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-950 text-slate-450'}`}>
						{templateKey === 'custom' ? '3' : '2'}. Vista Previa
					</span>
					{importedTxs.some(t => t.selected && t.type === 'transfer' && !t.transferCorrelationId) && (
						<>
							<ChevronRight className="w-3.5 h-3.5 text-slate-650" />
							<span className={`px-2 py-1 rounded-lg ${step === 'transfers' ? 'bg-indigo-600 text-white font-bold' : 'bg-slate-950 text-slate-450'}`}>
								{templateKey === 'custom' ? '4' : '3'}. Traspasos
							</span>
						</>
					)}
				</div>

				{error && (
					<div className="mb-6 p-4 bg-rose-500/15 border border-rose-500/20 text-rose-400 rounded-2xl flex items-start gap-2 text-xs leading-relaxed animate-in fade-in zoom-in-95">
						<AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
						<span>{error}</span>
					</div>
				)}

				{/* PASO 1: CONFIGURACIÓN */}
				{step === 'config' && (
					<div className="space-y-5">
						{/* Pestañas de Método */}
						<div className="space-y-2">
							<label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
								Método de Importación
							</label>
							<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
								<button
									type="button"
									onClick={() => setMethod('csv')}
									className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
										method === 'csv'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									<FileText className="w-4 h-4" /> Archivo (CSV / PDF)
								</button>
								<button
									type="button"
									onClick={() => setMethod('ai')}
									className={`py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
										method === 'ai'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									<Sparkles className="w-4 h-4 text-current" /> Copiar y Pegar (IA)
								</button>
							</div>
						</div>

						{method === 'ai' && (
							<div className="space-y-2">
								<label htmlFor="import-account-selector" className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
									Cuenta del texto pegado
								</label>
								<Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
									<SelectTrigger id="import-account-selector" className="w-full bg-slate-950 border-slate-800 h-11 text-slate-100">
										<SelectValue placeholder="Selecciona la cuenta asociada" />
									</SelectTrigger>
									<SelectContent>
										{accounts.map(acc => (
											<SelectItem key={acc.id} value={acc.id}>
												{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<p className="text-[10px] leading-relaxed text-slate-500">
									Se usará como la cuenta del banco que emitió el texto copiado.
								</p>
							</div>
						)}

						{/* SUB-SECCIÓN CSV */}
						{method === 'csv' && (
							<div className="space-y-5">
								{/* Selector de plantilla */}
								{!isPdf ? (
									<div className="space-y-2">
										<label htmlFor="csv-template-selector" className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
											Formato / Banco
										</label>
										<Select value={templateKey} onValueChange={setTemplateKey}>
											<SelectTrigger id="csv-template-selector" className="w-full bg-slate-950 border-slate-800 h-11 text-slate-100">
												<SelectValue placeholder="Selecciona la plantilla de banco" />
											</SelectTrigger>
											<SelectContent>
												{Object.entries(BANK_TEMPLATES).map(([key, t]) => (
													<SelectItem key={key} value={key}>
														{t.name}
													</SelectItem>
												))}
												<SelectItem value="custom">Mapeo Personalizado...</SelectItem>
											</SelectContent>
										</Select>
									</div>
								) : (
									<div className="space-y-4">
										<div className="p-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-start gap-2.5 text-xs leading-relaxed animate-in fade-in zoom-in-95">
											<Sparkles className="w-5 h-5 shrink-0 text-indigo-400 mt-0.5 animate-pulse" />
											<div>
												<span className="font-bold text-slate-200 block mb-0.5">Procesamiento inteligente de PDF</span>
												<span>Este archivo PDF se analizará utilizando la API de Gemini para extraer de forma estructurada las fechas, descripciones e importes de tus movimientos bancarios.</span>
											</div>
										</div>

										{!geminiApiKey && (
											<div className="space-y-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
												<label htmlFor="modal-gemini-key-pdf" className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wide">
													Introduce tu Gemini API Key (Requerida para PDF)
												</label>
												<Input
													id="modal-gemini-key-pdf"
													type="password"
													placeholder="AIzaSy..."
													value={localApiKey}
													onChange={(e) => setLocalApiKey(e.target.value)}
													className="bg-slate-950 border-slate-850 px-3 h-10 text-xs text-slate-100"
												/>
												<p className="text-[9px] text-slate-500 leading-normal">
													Obtén tu clave en {GEMINI_API_KEY_SETUP_URL}. Tus claves se guardan localmente según la configuración de la app.
												</p>
											</div>
										)}
									</div>
								)}

								{/* Zona Dropzone */}
								<div className="space-y-2">
									<label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
										Subir Archivo
									</label>
									<p className="text-[11px] leading-relaxed text-slate-500">
										Asigná cada archivo a la cuenta del banco que lo emitió. La app usará esa cuenta para detectar transferencias entre cuentas.
									</p>
									<div
										onDragOver={handleDragOver}
										onDrop={handleDrop}
										onClick={() => fileInputRef.current?.click()}
										className="border-2 border-dashed border-slate-800 hover:border-indigo-500/40 bg-slate-950/40 hover:bg-slate-950/80 rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 relative group"
									>
										<input
											ref={fileInputRef}
											type="file"
											accept=".csv,.pdf"
											multiple
											onChange={handleFileSelect}
											className="hidden"
										/>
										<div className="p-3 bg-slate-900 rounded-full group-hover:scale-110 transition-all border border-slate-800">
											<Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-400" />
										</div>
										<div>
											<p className="text-xs font-bold text-slate-200">
												{csvFilename || 'Arrastra tu extracto .csv o .pdf aquí'}
											</p>
											<p className="text-[10px] text-slate-500 mt-1">
												O haz clic para explorar tus archivos
											</p>
										</div>
									</div>
								</div>

								{attachments.length > 0 && (
									<div className="space-y-3">
										<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
											<span className="text-xs font-bold text-slate-300">Adjuntos cargados</span>
											<span className="text-[10px] text-slate-500">La cuenta asignada será el origen del archivo.</span>
										</div>
										<div className="grid gap-2">
										{attachments.map((attachment) => (
											<div key={attachment.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3 grid gap-3 sm:grid-cols-[1fr_220px_220px_auto] sm:items-center">
												<div className="min-w-0">
													<span className="block truncate text-xs font-bold text-slate-200">{attachment.name}</span>
													<span className={`text-[10px] ${attachment.status === 'error' ? 'text-rose-400' : 'text-slate-500'}`}>
														{attachment.status === 'loading' ? 'Leyendo archivo' : attachment.status === 'error' ? attachment.error : attachment.type.toUpperCase()}
													</span>
												</div>
												<label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
													<span>{`Cuenta para ${attachment.name}`}</span>
													<select
														aria-label={`Cuenta para ${attachment.name}`}
														value={attachment.accountId}
														onChange={(event) => handleAttachmentAccountChange(attachment.id, event.target.value)}
														className="h-9 rounded-xl border border-slate-800 bg-slate-950 px-2 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-indigo-500"
													>
														<option value="">Selecciona cuenta</option>
														{accounts.map(acc => (
															<option key={acc.id} value={acc.id}>{acc.name}</option>
														))}
													</select>
												</label>
													{attachment.type === 'csv' && (
														<label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
															<span>{`Plantilla para ${attachment.name}`}</span>
															<select
																aria-label={`Plantilla para ${attachment.name}`}
																value={attachment.templateKey}
																onChange={(event) => handleAttachmentTemplateChange(attachment.id, event.target.value as keyof typeof BANK_TEMPLATES)}
																className="h-9 rounded-xl border border-slate-800 bg-slate-950 px-2 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-indigo-500"
															>
																{Object.entries(BANK_TEMPLATES).map(([key, template]) => (
																	<option key={key} value={key}>{template.name}</option>
																))}
															</select>
														</label>
													)}
													<button
														type="button"
														onClick={() => handleRemoveAttachment(attachment.id)}
														className="justify-self-start sm:justify-self-end p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
														title="Quitar adjunto"
													>
														<Trash2 className="w-4 h-4" />
													</button>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}

						{/* SUB-SECCIÓN AI */}
						{method === 'ai' && (
							<div className="space-y-5">
								{/* API Key si falta */}
								{!geminiApiKey && (
									<div className="space-y-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl">
										<label htmlFor="modal-gemini-key" className="block text-[10px] font-bold text-indigo-400 uppercase tracking-wide">
											Introduce tu Gemini API Key
										</label>
										<Input
											id="modal-gemini-key"
											type="password"
											placeholder="AIzaSy..."
											value={localApiKey}
											onChange={(e) => setLocalApiKey(e.target.value)}
											className="bg-slate-950 border-slate-850 px-3 h-10 text-xs"
										/>
										<p className="text-[9px] text-slate-500 leading-normal">
											Obtén tu clave en {GEMINI_API_KEY_SETUP_URL}. Tus claves se guardan localmente según la configuración de la app.
										</p>
									</div>
								)}

								{/* Campo de Texto */}
								<div className="space-y-2">
									<label htmlFor="ai-paste-textarea" className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
										Texto del Extracto Copiado
									</label>
									<textarea
										id="ai-paste-textarea"
										rows={6}
										value={aiText}
										onChange={(e) => setAiText(e.target.value)}
										placeholder="Pega las líneas copiadas de tu app bancaria aquí. Por ejemplo:&#10;05/06/2026 PAGO EN MERCADONA -45,20 EUR&#10;04/06/2026 ABONO NOMINA +1.500,00 EUR"
										className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs font-mono outline-none focus:border-indigo-500 text-slate-200 placeholder:text-slate-600 resize-none h-[150px]"
									/>
								</div>
							</div>
						)}

						{/* Botón de envío */}
						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={handleProcessConfig}
								disabled={isLoading || (method === 'csv' && hasLoadingAttachments)}
								className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.3)] text-white font-bold py-3 rounded-2xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
							>
								{isLoading ? (
									<>
										<Loader2 className="w-4.5 h-4.5 animate-spin" />
										<span>Procesando movimientos...</span>
									</>
								) : (
									<>
										<span>Siguiente paso</span>
										<ChevronRight className="w-4 h-4" />
									</>
								)}
							</button>
						</div>
					</div>
				)}

				{/* PASO 2: MAPEO PERSONALIZADO */}
				{step === 'mapping' && (
					<div className="space-y-6">
						<div className="p-4 bg-slate-950 border border-slate-850 rounded-2xl">
							<span className="text-xs font-bold text-slate-300 block mb-2">Previsualización del CSV:</span>
							<div className="overflow-x-auto text-[10px] font-mono text-slate-550 space-y-1.5">
								{csvRows.slice(0, 4).map((row, idx) => (
									<div key={idx} className="flex gap-2 bg-slate-900 p-1.5 rounded border border-slate-800/40">
										<span className="font-bold text-indigo-400 shrink-0 select-none w-4">{idx}:</span>
										{row.map((field, cellIdx) => (
											<span key={cellIdx} className="bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-850 truncate max-w-[120px]">
												Col {cellIdx}: "{field}"
											</span>
										))}
									</div>
								))}
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							{/* Selector Fecha */}
							<div className="space-y-2">
								<label htmlFor="custom-map-date" className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
									Columna Fecha
								</label>
								<Select
									value={String(customMapping.dateCol)}
									onValueChange={(val) => setCustomMapping(prev => ({ ...prev, dateCol: parseInt(val) }))}
								>
									<SelectTrigger id="custom-map-date" className="bg-slate-950 border-slate-850 h-10">
										<SelectValue placeholder="Selecciona columna" />
									</SelectTrigger>
									<SelectContent>
										{csvRows[0]?.map((_, idx) => (
											<SelectItem key={idx} value={String(idx)}>
												Columna {idx} (ej. "{csvRows[0][idx] || 'vacía'}")
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Selector Concepto */}
							<div className="space-y-2">
								<label htmlFor="custom-map-desc" className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
									Columna Concepto
								</label>
								<Select
									value={String(customMapping.descCol)}
									onValueChange={(val) => setCustomMapping(prev => ({ ...prev, descCol: parseInt(val) }))}
								>
									<SelectTrigger id="custom-map-desc" className="bg-slate-950 border-slate-850 h-10">
										<SelectValue placeholder="Selecciona columna" />
									</SelectTrigger>
									<SelectContent>
										{csvRows[0]?.map((_, idx) => (
											<SelectItem key={idx} value={String(idx)}>
												Columna {idx} (ej. "{csvRows[0][idx] || 'vacía'}")
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Selector Importe */}
							<div className="space-y-2">
								<label htmlFor="custom-map-amount" className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
									Columna Importe
								</label>
								<Select
									value={String(customMapping.amountCol)}
									onValueChange={(val) => setCustomMapping(prev => ({ ...prev, amountCol: parseInt(val) }))}
								>
									<SelectTrigger id="custom-map-amount" className="bg-slate-950 border-slate-850 h-10">
										<SelectValue placeholder="Selecciona columna" />
									</SelectTrigger>
									<SelectContent>
										{csvRows[0]?.map((_, idx) => (
											<SelectItem key={idx} value={String(idx)}>
												Columna {idx} (ej. "{csvRows[0][idx] || 'vacía'}")
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Selector Saldo */}
							<div className="space-y-2">
								<label htmlFor="custom-map-balance" className="block text-xs font-bold text-slate-400 uppercase tracking-wide">
									Columna Saldo (Opcional)
								</label>
								<Select
									value={String(customMapping.balanceCol)}
									onValueChange={(val) => setCustomMapping(prev => ({ ...prev, balanceCol: parseInt(val) }))}
								>
									<SelectTrigger id="custom-map-balance" className="bg-slate-950 border-slate-850 h-10">
										<SelectValue placeholder="Selecciona columna" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="-1">Ninguna (Omitir)</SelectItem>
										{csvRows[0]?.map((_, idx) => (
											<SelectItem key={idx} value={String(idx)}>
												Columna {idx} (ej. "{csvRows[0][idx] || 'vacía'}")
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Checkbox Header */}
							<div className="flex items-center gap-3 pt-8 pl-2">
								<button
									type="button"
									onClick={() => setCustomMapping(prev => ({ ...prev, hasHeader: !prev.hasHeader }))}
									className="flex items-center gap-2 text-xs font-semibold text-slate-350 hover:text-slate-200"
								>
									{customMapping.hasHeader ? (
										<CheckSquare className="w-4.5 h-4.5 text-indigo-500" />
									) : (
										<Square className="w-4.5 h-4.5 text-slate-700" />
									)}
									<span>Omitir primera fila (cabecera)</span>
								</button>
							</div>
						</div>

						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={() => setStep('config')}
								className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2.5 rounded-2xl text-xs transition-all"
							>
								Volver
							</button>
							<button
								type="button"
								onClick={handleProcessCustomMapping}
								className="w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-2.5 rounded-2xl text-xs transition-all shadow-md active:scale-95"
							>
								Procesar
							</button>
						</div>
					</div>
				)}

				{/* PASO 3: VISTA PREVIA */}
				{step === 'preview' && (
					<div className="space-y-6 flex flex-col min-h-0">
						{/* Resumen Informativo */}
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-950/60 border border-slate-850 rounded-2xl text-xs">
							<div className="space-y-1">
								<span className="font-semibold text-slate-300">Origen:</span>
								<span className="text-slate-100 font-bold block">
									{attachments.length > 0 ? `${attachments.length} adjunto(s)` : accounts.find(a => a.id === selectedAccountId)?.name}
								</span>
								{possibleDuplicateCount > 0 && (
									<span className="block text-[11px] text-amber-400">
										{possibleDuplicateCount} movimiento(s) requieren revisión por posible duplicado.
									</span>
								)}
							</div>
							<div className="flex gap-4">
								<div className="text-center bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-xl">
									<span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Importar</span>
									<span className="text-sm font-black text-indigo-400">
										{selectedImportableTxs.length}
									</span>
								</div>
								<div className="text-center bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-xl">
									<span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Gasto</span>
									<span className="text-sm font-black text-rose-400">
										{importedTxs.filter(t => t.selected && t.type === 'expense').length}
									</span>
								</div>
								<div className="text-center bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-xl">
									<span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Ingreso</span>
									<span className="text-sm font-black text-emerald-400">
										{importedTxs.filter(t => t.selected && t.type === 'income').length}
									</span>
								</div>
							</div>
						</div>

						{/* Tabla */}
						<div className="overflow-x-auto max-h-[45vh] pr-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
							<table className={`w-full text-left border-collapse ${hasBalance ? 'min-w-[800px]' : 'min-w-[700px]'}`}>
								<thead>
									<tr className="border-b border-slate-800/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-950/40 sticky top-0 z-10 backdrop-blur-sm">
										<th className="py-2.5 pl-3 w-10 text-center">
											<button
												type="button"
												onClick={toggleSelectAll}
										className="p-1 hover:bg-slate-800 rounded text-indigo-400 flex items-center justify-center mx-auto"
										title="Seleccionar / Deseleccionar todos"
									>
										{allImportableTxsSelected ? (
											<CheckSquare className="w-4 h-4" />
										) : (
													<Square className="w-4 h-4 text-slate-500" />
												)}
											</button>
										</th>
										<th className="py-2.5 w-[110px]">Fecha</th>
										<th className="py-2.5 w-[170px]">Origen</th>
										<th className="py-2.5">Concepto</th>
										<th className="py-2.5 w-[90px] text-right">Importe (€)</th>
										{hasBalance && <th className="py-2.5 w-[90px] text-right">Saldo (€)</th>}
										<th className="py-2.5 w-[90px] text-center">Tipo</th>
										<th className="py-2.5 w-[140px]">Etiqueta</th>
										<th className="py-2.5 w-[130px]">Propietario</th>
										<th className="py-2.5 w-10 text-center"></th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-850 text-xs">
									{importedTxs.map((tx) => (
										<tr
											key={tx.id}
											className={`transition-all ${
												tx.selected ? 'bg-slate-950/10 hover:bg-slate-900/40' : 'opacity-40 hover:opacity-70'
										} ${tx.isDuplicate || tx.possibleDuplicate ? 'border-l-2 border-l-amber-500' : ''}`}
										>
											<td className="py-3 text-center align-middle">
											<button
												type="button"
												onClick={() => toggleSelectTx(tx.id)}
												disabled={tx.isDuplicate}
												aria-label={tx.isDuplicate ? `Duplicado exacto no importable: ${tx.desc}` : `Seleccionar movimiento: ${tx.desc}`}
												className={`p-1 rounded flex items-center justify-center mx-auto text-indigo-400 ${tx.isDuplicate ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-850'}`}
											>
													{tx.selected ? (
														<CheckSquare className="w-4 h-4" />
													) : (
														<Square className="w-4 h-4 text-slate-650" />
													)}
												</button>
											</td>
										<td className="py-3 pr-2">
											<Input
													type="date"
													value={tx.date}
													onChange={(e) => handleTxChange(tx.id, { date: e.target.value })}
													className="h-8 text-[11px] font-mono px-1.5 bg-slate-950 border-slate-850 text-slate-100"
											/>
										</td>
										<td className="py-3 pr-2 align-middle">
											<span className="block text-[11px] font-bold text-slate-200">
												{accounts.find(a => a.id === tx.accountId)?.name || 'Sin cuenta'}
											</span>
											<span className="block max-w-[150px] truncate text-[10px] text-slate-500" title={tx.sourceName}>
												{tx.sourceName || csvFilename || 'Origen manual'}
											</span>
										</td>
										<td className="py-3 pr-2 space-y-1">
												<Input
													type="text"
													value={tx.desc}
													onChange={(e) => handleTxChange(tx.id, { desc: e.target.value })}
													className="h-8 text-[11px] px-2 bg-slate-950 border-slate-850 text-slate-200"
												/>
												{tx.isDuplicate && (
													<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-500 rounded font-bold animate-pulse">
														<AlertTriangle className="w-3 h-3" /> Duplicado exacto
													</span>
												)}
												{tx.possibleDuplicate && !tx.isDuplicate && (
													<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-[9px] text-amber-400 rounded font-bold" title={getPossibleDuplicateLabel(tx)}>
														<AlertTriangle className="w-3 h-3" /> Revisar posible duplicado
													</span>
												)}
											</td>
											<td className="py-3 pr-2">
												<Input
													type="number"
													step="0.01"
													value={tx.amount}
													onChange={(e) => handleTxChange(tx.id, { amount: e.target.value })}
													className="h-8 text-[11px] text-right font-mono px-1.5 bg-slate-950 border-slate-850 text-slate-100"
												/>
											</td>
											{hasBalance && (
												<td className="py-3 pr-2 text-right font-mono text-slate-400 align-middle shrink-0">
													{tx.balance ? `${parseFloat(tx.balance).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '-'}
												</td>
											)}
											<td className="py-3 pr-2 text-center align-middle">
												<select
													value={tx.type}
													onChange={(e) => {
														const newType = e.target.value as TransactionType;
														handleTxChange(tx.id, {
															type: newType,
															tag: DEFAULT_TAGS[newType][0]
														});
													}}
													className="h-8 text-[11px] bg-slate-950 border border-slate-850 rounded-lg text-slate-300 px-1 font-semibold outline-none w-full"
												>
													<option value="expense">Gasto</option>
													<option value="income">Ingreso</option>
													<option value="transfer">Traspaso</option>
												</select>
											</td>
											<td className="py-3 pr-2">
												<select
													value={tx.tag}
													onChange={(e) => handleTxChange(tx.id, { tag: e.target.value })}
													className="h-8 text-[11px] bg-slate-950 border border-slate-850 rounded-lg text-slate-350 px-1.5 outline-none w-full"
												>
													{DEFAULT_TAGS[tx.type].map(tag => (
														<option key={tag} value={tag}>
															{tag}
														</option>
													))}
												</select>
											</td>
											<td className="py-3 pr-2">
												<select
													value={`${tx.owner}-${tx.paidBy}`}
													onChange={(e) => {
														const [newOwner, newPaidBy] = e.target.value.split('-');
														handleTxChange(tx.id, {
															owner: newOwner as 'userA' | 'userB' | 'joint',
															paidBy: newPaidBy as 'userA' | 'userB' | 'shared'
														});
													}}
													className="h-8 text-[11px] bg-slate-950 border border-slate-850 rounded-lg text-slate-350 px-1 outline-none w-full"
												>
													<option value="joint-shared">Conjunto (Común)</option>
													<option value="userA-userA">{userAName} (Propio)</option>
													<option value="userB-userB">{userBName} (Propio)</option>
													<option value="joint-userA">Conjunto (paga {userAName})</option>
													<option value="joint-userB">Conjunto (paga {userBName})</option>
												</select>
											</td>
											<td className="py-3 text-center align-middle">
												<button
													type="button"
													onClick={() => handleDeleteRow(tx.id)}
													className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-450 rounded-lg transition-colors"
													title="Eliminar fila"
												>
													<Trash2 className="w-3.5 h-3.5" />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Botones de Acción */}
						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={() => setStep('config')}
								className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-all"
							>
								Volver a configurar
							</button>
							<button
								type="button"
								onClick={handleNextFromPreview}
								className="w-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
							>
								<CheckCircle className="w-4 h-4" />
								<span>
									{importedTxs.some(t => t.selected && t.type === 'transfer' && !t.transferCorrelationId)
										? 'Configurar traspasos' 
										: `Importar seleccionados (${selectedImportableTxs.length})`}
								</span>
							</button>
						</div>
					</div>
				)}

				{/* PASO: GESTIONAR TRASPASOS */}
				{step === 'transfers' && (
					<div className="space-y-6 flex flex-col min-h-0">
						<div className="p-4 bg-slate-950/60 border border-slate-850 rounded-2xl text-xs space-y-2">
							<span className="font-bold text-slate-200 block">Asociación de Cuentas para Traspasos</span>
							<p className="text-slate-450 text-[11px] leading-relaxed">
								La cuenta del archivo ya está asignada. Acá solo elegís la cuenta contraparte para resolver manualmente el traspaso.
							</p>
						</div>

						<div className="overflow-y-auto max-h-[45vh] pr-1 space-y-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
							{importedTxs.filter(t => t.selected && t.type === 'transfer').map((tx) => {
								const rowAccountId = tx.accountId || selectedAccountId;
								const otherAccounts = accounts.filter(a => a.id !== rowAccountId);
								const activeAccountName = accounts.find(a => a.id === rowAccountId)?.name || 'Cuenta activa';

								return (
									<div key={tx.id} className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
										<div className="space-y-1 md:max-w-[40%]">
											<span className="text-[10px] font-mono text-slate-500 block">{tx.date}</span>
											<span className="font-bold text-slate-250 block truncate" title={tx.desc}>{tx.desc}</span>
											<span className="text-xs font-black text-indigo-400 block">{parseFloat(tx.amount).toFixed(2)} €</span>
										</div>

										<div className="flex flex-col gap-3 shrink-0 bg-slate-900/60 p-3 rounded-xl border border-slate-800/60 sm:flex-row sm:items-end">
											{tx.originalType === 'expense' ? (
												<>
													<div className="grid gap-1">
														<span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cuenta de origen</span>
														<span className="text-xs font-bold text-slate-300 px-2 py-1.5 bg-slate-950 border border-slate-850 rounded-lg">
															{activeAccountName}
														</span>
													</div>
													<ChevronRight className="hidden w-4 h-4 text-indigo-400 shrink-0 mb-2 sm:block" />
													<label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
														<span>Cuenta de destino</span>
														<select
															aria-label={`Cuenta de destino para ${tx.desc}`}
															value={tx.toAccountId || ''}
															onChange={(e) => handleTxChange(tx.id, { toAccountId: e.target.value })}
															className="min-w-[160px] text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-100 px-2 py-1.5 outline-none font-semibold normal-case tracking-normal"
														>
															{otherAccounts.map(acc => (
																<option key={acc.id} value={acc.id}>
																	{acc.name}
																</option>
															))}
															{otherAccounts.length === 0 && (
																<option value="">(No hay otras cuentas)</option>
															)}
														</select>
														<span className="normal-case tracking-normal text-slate-500 font-medium">Contraparte de este traspaso manual.</span>
													</label>
												</>
											) : (
												<>
													<label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
														<span>Cuenta de origen</span>
														<select
															aria-label={`Cuenta de origen para ${tx.desc}`}
															value={tx.fromAccountId || ''}
															onChange={(e) => handleTxChange(tx.id, { fromAccountId: e.target.value })}
															className="min-w-[160px] text-xs bg-slate-950 border border-slate-850 rounded-lg text-slate-100 px-2 py-1.5 outline-none font-semibold normal-case tracking-normal"
														>
															{otherAccounts.map(acc => (
																<option key={acc.id} value={acc.id}>
																	{acc.name}
																</option>
															))}
															{otherAccounts.length === 0 && (
																<option value="">(No hay otras cuentas)</option>
															)}
														</select>
														<span className="normal-case tracking-normal text-slate-500 font-medium">Contraparte de este traspaso manual.</span>
													</label>
													<ChevronRight className="hidden w-4 h-4 text-indigo-400 shrink-0 mb-2 sm:block" />
													<div className="grid gap-1">
														<span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cuenta de destino</span>
														<span className="text-xs font-bold text-slate-300 px-2 py-1.5 bg-slate-950 border border-slate-850 rounded-lg">
															{activeAccountName}
														</span>
													</div>
												</>
											)}
										</div>
									</div>
								);
							})}
						</div>

						{/* Botones de Acción */}
						<div className="flex gap-3 pt-2">
							<button
								type="button"
								onClick={() => setStep('preview')}
								className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-3 rounded-2xl text-xs transition-all"
							>
								Volver a vista previa
							</button>
							<button
								type="button"
								onClick={handleImportConfirm}
								className="w-1/2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-2xl text-xs transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
							>
								<CheckCircle className="w-4 h-4" />
								<span>Confirmar e importar</span>
							</button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
