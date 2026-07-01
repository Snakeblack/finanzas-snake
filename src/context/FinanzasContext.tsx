import {
	createContext,
	useState,
	useEffect,
	useRef,
	type ReactNode,
	type SyntheticEvent,
	type Dispatch,
	type SetStateAction
} from 'react';
import type {
	Account,
	Transaction,
	Period,
	Debt,
	TxForm,
	DebtForm,
	ConsolidationForm,
	ChatMessage,
	ActiveTab,
	ClassicDebt,
	TagBreakdown
} from '../types';
import {
	getInitialData,
	readStoredDebts,
	saveStoredTransactions,
	saveStoredDebts,
	saveStoredPeriods,
	saveStoredAccounts,
	readGeminiApiKey,
	readAiChat,
	readStoredTransactions,
	readStoredAccounts,
	readStoredPeriods,
	readUserNames,
	saveUserNames,
	readProfileCount,
	saveProfileCount,
	executeSilentMigrationIfRequired
} from '../services/storageService';
import { addMonthsToMonth, getValidDateForMonth, normalizeMonth, autoGenerateMissingPeriods } from '../utils/dateUtils';
import { toNumber } from '../utils/formatters';
import { parseOpeningBalanceInput } from '../utils/openingBalance';
import { buildChatPdfHtml, type ChatPdfOptions } from '../services/chatPdfExport';
import {
	calculateDebtMonthlyPayment,
	calculateClassicDebtInstallment,
	calculateMonthlyPayment,
	getPaymentPlanRemainingAmount,
	getPaymentPlanOverdueAmount,
	calculateTimelineBalances,
	getTagBreakdown,
	isPaymentPlanDebt,
	isClassicDebt,
	getEffectiveAmount
} from '../services/financeService';
import type { PromptContextParams } from '../services/geminiService';
import { useAiAdvisor } from '../hooks/useAiAdvisor';
import { useSecurity } from '../hooks/useSecurity';
import { useBackupSync } from '../hooks/useBackupSync';
import { useDebts } from '../hooks/useDebts';
import { useTransactions } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';

/**
 * Interfaz que define el valor del contexto de finanzas globales.
 */
export interface FinanzasContextType {
	// Nombres de usuarios
	userAName: string;
	setUserAName: (name: string) => void;
	userBName: string;
	setUserBName: (name: string) => void;
	profileCount: 1 | 2;
	setProfileCount: (count: 1 | 2) => void;

	// Modos de vista y pestañas
	viewMode: 'all' | 'userA' | 'userB';
	setViewMode: (mode: 'all' | 'userA' | 'userB') => void;
	activeTab: ActiveTab;
	setActiveTab: (tab: ActiveTab) => void;

	// Datos principales
	accounts: Account[];
	setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
	transactions: Transaction[];
	setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
	periods: Period[];
	setPeriods: React.Dispatch<React.SetStateAction<Period[]>>;
	debts: Debt[];
	setDebts: React.Dispatch<React.SetStateAction<Debt[]>>;
	selectedMonth: string;
	setSelectedMonth: (month: string) => void;

	// Formulario e interfaz de transacciones
	txForm: TxForm;
	setTxForm: React.Dispatch<React.SetStateAction<TxForm>>;
	editingTx: Transaction | null;
	setEditingTx: (tx: Transaction | null) => void;
	editForm: TxForm;
	setEditForm: React.Dispatch<React.SetStateAction<TxForm>>;
	editScope: 'only-this' | 'future' | 'all';
	setEditScope: (scope: 'only-this' | 'future' | 'all') => void;

	// Formulario e interfaz de deudas
	debtForm: DebtForm;
	setDebtForm: React.Dispatch<React.SetStateAction<DebtForm>>;
	debtFormError: string;
	setDebtFormError: (error: string) => void;
	selectedDebtSchedule: Debt | null;
	setSelectedDebtSchedule: (debt: Debt | null) => void;

	// Cuentas y formularios
	editingAccount: Account | null;
	setEditingAccount: (acc: Account | null) => void;
	accountForm: { name: string; owner: 'userA' | 'userB' | 'joint'; initialBalance: string };
	setAccountForm: React.Dispatch<
		React.SetStateAction<{ name: string; owner: 'userA' | 'userB' | 'joint'; initialBalance: string }>
	>;

	// Inicialización
	initFlow: 'past' | 'current';
	setInitFlow: (flow: 'past' | 'current') => void;
	initMonth: string;
	setInitMonth: (month: string) => void;
	initBalance: string;
	setInitBalance: (bal: string) => void;
	initBalanceA: string;
	setInitBalanceA: (bal: string) => void;
	initBalanceB: string;
	setInitBalanceB: (bal: string) => void;
	isReconfiguring: boolean;
	setIsReconfiguring: (val: boolean) => void;
	reconfigAccounts: Account[];
	setReconfigAccounts: React.Dispatch<React.SetStateAction<Account[]>>;

	// PDF y exportaciones
	isExportPdfModalOpen: boolean;
	setIsExportPdfModalOpen: (val: boolean) => void;
	pdfExportOptions: { showContext: boolean; showDebts: boolean; showTransactions: boolean; showChat: boolean };
	setPdfExportOptions: React.Dispatch<
		React.SetStateAction<{ showContext: boolean; showDebts: boolean; showTransactions: boolean; showChat: boolean }>
	>;

	// Reunificación
	selectedDebtsForConsolidation: string[];
	setSelectedDebtsForConsolidation: (ids: string[]) => void;
	consolidationForm: ConsolidationForm;
	setConsolidationForm: React.Dispatch<React.SetStateAction<ConsolidationForm>>;

	// Gemini AI
	geminiApiKey: string;
	setGeminiApiKey: (key: string) => void;
	customQuestion: string;
	setCustomQuestion: (question: string) => void;
	chatMessages: ChatMessage[];
	setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
	aiLoading: boolean;
	aiError: string;
	setAiError: (err: string) => void;
	copiedChat: boolean;

	// Import / Export
	importError: string;
	setImportError: (err: string) => void;
	importSuccess: string;
	setImportSuccess: (msg: string) => void;

	// Seguridad y Bloqueo (OWASP)
	isLocked: boolean;
	isInitialized: boolean;
	hasPasswordSet: boolean;
	passwordError: string;
	setPasswordError: (err: string) => void;
	handleSetupPassword: (password: string) => Promise<boolean>;
	handleUnlock: (password: string) => Promise<boolean>;
	handleLockApp: () => void;

	// Ocultar Datos Sensibles
	hideSensitiveData: boolean;
	toggleSensitiveData: () => void;
	formatAmount: (amount: number, options?: { showSign?: boolean; decimals?: number; forceShow?: boolean }) => string;

	// Tema (Modo Claro/Oscuro)
	theme: 'light' | 'dark';
	toggleTheme: () => void;

	// Valores calculados
	activePeriodData: any;
	totalIncomes: number;
	totalExpenses: number;
	totalMonthlyDebtPayments: number;
	netMonthlyBalance: number;
	currentOpeningBalance: number;
	currentClosingBalance: number;
	filteredTransactions: Transaction[];
	recurringIncomes: number;
	oneOffIncomes: number;
	recurringExpenses: number;
	oneOffExpenses: number;
	filteredDebts: Debt[];
	jointPaidByA: number;
	jointPaidByB: number;
	netOwed: number;
	tagData: TagBreakdown[];
	maxTagAmount: number;
	timelineBalances: Record<string, any>;

	// Consolidación calculada
	consolidatedDebtsObjects: Debt[];
	consolidatedPrincipal: number;
	additionalCapital: number;
	totalNewPrincipal: number;
	currentConsolidatedMonthlySum: number;
	currentTotalInterests: number;
	newConsolidatedCuota: number;
	newTotalConsolidatedPayment: number;
	newConsolidatedInterests: number;

	// Manejadores de acciones
	handleInitAccount: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleResetAccount: () => void;
	handleCreateNextMonth: () => void;
	handleAddTransaction: (e: SyntheticEvent<HTMLFormElement>, customForm?: TxForm) => void;
	handleStartEditTransaction: (tx: Transaction) => void;
	handleSaveEditTransaction: (e: SyntheticEvent<HTMLFormElement>, customForm?: TxForm) => void;
	handleDeleteTransaction: (id: string) => void;
	handleDeleteDebt: (id: string) => void;
	handleAddDebt: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleAddAccount: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleStartEditAccount: (acc: Account) => void;
	handleSaveEditAccount: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleDeleteAccount: (id: string) => void;
	toggleDebtSelection: (id: string) => void;
	updatePaymentPlanTranche: (id: string, patch: Partial<{ id: string; months: string; amount: string }>) => void;
	addPaymentPlanTranche: () => void;
	removePaymentPlanTranche: (id: string) => void;
	togglePaymentPlanInstallmentStatus: (debtId: string, installmentId: string) => void;
	handleAskGemini: (questionText: string) => Promise<void>;
	handleClearChat: () => void;
	handleCopyChatPlaintext: () => void;
	handleDownloadChatPDF: (options: {
		showContext: boolean;
		showDebts: boolean;
		showTransactions: boolean;
		showChat: boolean;
	}) => void;
	handleExportData: () => void;
	handleImportData: (e: SyntheticEvent<HTMLFormElement>, jsonString: string) => void;
}

export const FinanzasContext = createContext<FinanzasContextType | undefined>(undefined);

export const FinanzasProvider = ({ children }: { children: ReactNode }) => {
	const currentMonthString = new Date().toISOString().substring(0, 7);

	// === ESTADOS GLOBALES ===
	const [userAName, setUserAName] = useState('Usuario A');
	const [userBName, setUserBName] = useState('Usuario B');
	const [profileCount, setProfileCount] = useState<1 | 2>(2);
	const [viewMode, setViewMode] = useState<'all' | 'userA' | 'userB'>('all');

	// Estado para ocultar datos sensibles
	const [hideSensitiveData, setHideSensitiveData] = useState<boolean>(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('finanzas_hide_sensitive_data') === 'true';
		}
		return false;
	});

	const toggleSensitiveData = () => {
		setHideSensitiveData((prev) => {
			const newVal = !prev;
			localStorage.setItem('finanzas_hide_sensitive_data', String(newVal));
			return newVal;
		});
	};

	// === TEMA (MODO CLARO / OSCURO) ===
	const [theme, setTheme] = useState<'light' | 'dark'>(() => {
		if (typeof window !== 'undefined') {
			return (localStorage.getItem('finanzas_theme') as 'light' | 'dark') || 'dark';
		}
		return 'dark';
	});

	const toggleTheme = () => {
		setTheme((prev) => {
			const newVal = prev === 'dark' ? 'light' : 'dark';
			localStorage.setItem('finanzas_theme', newVal);
			return newVal;
		});
	};

	useEffect(() => {
		if (typeof window !== 'undefined') {
			const root = window.document.documentElement;
			if (theme === 'light') {
				root.classList.add('light');
			} else {
				root.classList.remove('light');
			}
		}
	}, [theme]);

	const formatAmount = (amount: number, options?: { showSign?: boolean; decimals?: number; forceShow?: boolean }) => {
		if (hideSensitiveData && !options?.forceShow) {
			const sign = amount < 0 ? '-' : options?.showSign && amount > 0 ? '+' : '';
			return `${sign}***€`;
		}
		const decimals = options?.decimals !== undefined ? options.decimals : 2;
		const absoluteAmount = Math.abs(amount);
		const formatted = absoluteAmount.toLocaleString('es-ES', {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		const sign = amount < 0 ? '-' : options?.showSign && amount > 0 ? '+' : '';
		return `${sign}${formatted}€`;
	};

	// El estado de seguridad/PIN (isLocked, hasPasswordSet, passwordError) y sus flujos
	// viven en useSecurity (D1); el hook se inicializa más abajo, tras declarar el estado
	// de dominio que necesita para cifrar/descifrar.

	// Estado local para evitar sobreescrituras accidentales durante el arranque
	const [isInitialized, setIsInitialized] = useState(false);

	// === DOMINIO DE CUENTAS ===
	// El estado de cuentas (accounts, editingAccount, accountForm) y sus handlers puros viven en
	// useAccounts (D1). Es el primer hook de dominio: accounts/setAccounts los consumen
	// useTransactions (lectura) y los appliers de useSecurity/useBackupSync. El borrado de cuenta
	// (cross-domain con tx/deudas) y la persistencia siguen en el contexto.
	const {
		accounts,
		setAccounts,
		editingAccount,
		setEditingAccount,
		accountForm,
		setAccountForm,
		handleAddAccount,
		handleSaveEditAccount,
		handleStartEditAccount
	} = useAccounts(profileCount);

	const [periods, setPeriods] = useState<Period[]>(() => getInitialData().periods);

	const [selectedMonth, setSelectedMonth] = useState(() => {
		const currentMonth = new Date().toISOString().substring(0, 7);
		const storedPeriods = getInitialData().periods;
		if (storedPeriods.length > 0) {
			const exists = storedPeriods.some((p) => p.month === currentMonth);
			if (exists) return currentMonth;
			return storedPeriods[storedPeriods.length - 1].month;
		}
		return currentMonth;
	});

	const [activeTab, setActiveTab] = useState<ActiveTab>('overview');

	// Formularios de inicialización/reconfiguración
	const [initFlow, setInitFlow] = useState<'past' | 'current'>('current');
	const [initMonth, setInitMonth] = useState(currentMonthString);
	const [initBalance, setInitBalance] = useState('0');
	const [initBalanceA, setInitBalanceA] = useState('0');
	const [initBalanceB, setInitBalanceB] = useState('0');
	const [isReconfiguring, setIsReconfiguring] = useState(false);
	const [reconfigAccounts, setReconfigAccounts] = useState<Account[]>([]);
	const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
	const [pdfExportOptions, setPdfExportOptions] = useState({
		showContext: true,
		showDebts: true,
		showTransactions: true,
		showChat: true
	});

	// === SIMULADOR DE REUNIFICACIÓN ===
	const [selectedDebtsForConsolidation, setSelectedDebtsForConsolidation] = useState<string[]>([]);
	const [consolidationForm, setConsolidationForm] = useState<ConsolidationForm>({
		tae: '5.5',
		termMonths: '36',
		extraCapital: ''
	});

	// === DOMINIO DE DEUDAS ===
	// El estado de deudas (debts, debtForm, debtFormError, selectedDebtSchedule) y sus handlers
	// viven en useDebts (D1). Se llama antes que useSecurity/useBackupSync porque sus appliers
	// necesitan setDebts. La persistencia y los derivados (filteredDebts, consolidación) siguen
	// en el contexto. El borrado limpia la selección de reunificación vía onDebtDeleted.
	const {
		debts,
		setDebts,
		debtForm,
		setDebtForm,
		debtFormError,
		setDebtFormError,
		selectedDebtSchedule,
		setSelectedDebtSchedule,
		handleAddDebt,
		handleDeleteDebt,
		updatePaymentPlanTranche,
		addPaymentPlanTranche,
		removePaymentPlanTranche,
		togglePaymentPlanInstallmentStatus
	} = useDebts({
		initialDebtFormDate: selectedMonth,
		onDebtDeleted: (id) =>
			setSelectedDebtsForConsolidation(selectedDebtsForConsolidation.filter((itemId) => itemId !== id)),
		profileCount
	});

	// === DOMINIO DE TRANSACCIONES ===
	// El estado de transacciones (transactions, txForm, editingTx, editForm, editScope) y sus
	// handlers viven en useTransactions (D1). Se llama antes que useSecurity/useBackupSync porque
	// sus appliers necesitan setTransactions. Los handlers leen accounts/periods a nivel de evento
	// (se pasan como params). La persistencia y los derivados (filteredTransactions, totales)
	// siguen en el contexto, que reusa transactions/setTransactions del hook.
	const {
		transactions,
		setTransactions,
		txForm,
		setTxForm,
		editingTx,
		setEditingTx,
		editForm,
		setEditForm,
		editScope,
		setEditScope,
		handleAddTransaction,
		handleStartEditTransaction,
		handleSaveEditTransaction,
		handleDeleteTransaction
	} = useTransactions({
		currentMonthString,
		initialSelectedMonth: selectedMonth,
		accounts,
		periods,
		profileCount
	});

	// === SEGURIDAD (PIN) + ASESOR IA ===
	// Ambos hooks comparten ciclo de vida: el bloqueo afecta la persistencia del chat, y
	// configurar/desbloquear/bloquear vuelca o limpia el estado IA. useSecurity va primero
	// porque expone isLocked (reactivo) que useAiAdvisor necesita en sus efectos. A la inversa,
	// useSecurity solo lee/escribe el estado IA en sus handlers (a nivel de evento), así que se
	// lo pasamos vía aiBridgeRef (poblado tras el commit) sin introducir un ciclo reactivo.
	const aiBridgeRef = useRef<{
		geminiApiKey: string;
		chatMessages: ChatMessage[];
		setGeminiApiKey: Dispatch<SetStateAction<string>>;
		setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	}>({
		geminiApiKey: '',
		chatMessages: [],
		setGeminiApiKey: () => {},
		setChatMessages: () => {}
	});

	const {
		isLocked,
		setIsLocked,
		hasPasswordSet,
		passwordError,
		setPasswordError,
		handleSetupPassword,
		handleUnlock,
		handleLockApp
	} = useSecurity({
		getSnapshot: () => ({
			accounts,
			transactions,
			debts,
			periods,
			geminiApiKey: aiBridgeRef.current.geminiApiKey,
			chatMessages: aiBridgeRef.current.chatMessages,
			userAName,
			userBName
		}),
		appliers: {
			setAccounts,
			setTransactions,
			setDebts,
			setPeriods,
			setUserAName,
			setUserBName,
			setGeminiApiKey: (value) => aiBridgeRef.current.setGeminiApiKey(value),
			setChatMessages: (value) => aiBridgeRef.current.setChatMessages(value),
			setSelectedMonth,
			setIsInitialized
		}
	});

	// El asesor IA vive en useAiAdvisor (D1). El prompt necesita el snapshot financiero
	// derivado más abajo en este render; se lo pasamos vía ref que se actualiza tras el commit.
	const promptParamsRef = useRef<() => PromptContextParams>(() => {
		throw new Error('promptParamsRef usado antes de calcular el contexto financiero');
	});
	const {
		geminiApiKey,
		setGeminiApiKey,
		customQuestion,
		setCustomQuestion,
		chatMessages,
		setChatMessages,
		aiLoading,
		aiError,
		setAiError,
		handleAskGemini,
		handleClearChat,
		handleCopyChatPlaintext
	} = useAiAdvisor({
		isInitialized,
		isLocked,
		getPromptParams: () => promptParamsRef.current()
	});

	// Puente del estado IA hacia useSecurity (sus handlers lo consumen a nivel de evento).
	useEffect(() => {
		aiBridgeRef.current = { geminiApiKey, chatMessages, setGeminiApiKey, setChatMessages };
	});
	const [copiedChat] = useState(false);

	// Backup local (export/import) — useBackupSync (D1). Como atraviesa todo el dominio, le
	// pasamos getSnapshot (estado a serializar) y appliers (setters para volcar lo importado).
	const { importError, setImportError, importSuccess, setImportSuccess, handleExportData, handleImportData } =
		useBackupSync({
			getSnapshot: () => ({
				accounts,
				transactions,
				debts,
				periods,
				userAName,
				userBName,
				geminiApiKey,
				chatMessages
			}),
			appliers: {
				setAccounts,
				setTransactions,
				setDebts,
				setPeriods,
				setUserAName,
				setUserBName,
				setGeminiApiKey,
				setChatMessages,
				setSelectedMonth
			}
		});

	useEffect(() => {
		let cancelled = false;

		const initAsync = async () => {
			if (!isLocked && !hasPasswordSet) {
				await executeSilentMigrationIfRequired();
				if (cancelled) return;

				const loadedUserNames = await readUserNames();
				const loadedProfileCount = await readProfileCount();
				const loadedTx = await readStoredTransactions();
				const loadedDebts = await readStoredDebts();
				const loadedPeriods = await readStoredPeriods(loadedTx, loadedDebts);
				let nextAccounts = await readStoredAccounts();

				if (nextAccounts.length === 0) {
					const sortedPeriods = [...loadedPeriods].sort((a, b) => a.month.localeCompare(b.month));
					const firstPeriod = sortedPeriods.length > 0 ? sortedPeriods[0] : null;
					const initialBalA = firstPeriod
						? firstPeriod.openingBalanceA !== undefined
							? firstPeriod.openingBalanceA
							: firstPeriod.openingBalance / 2
						: 0;
					const initialBalB = firstPeriod
						? firstPeriod.openingBalanceB !== undefined
							? firstPeriod.openingBalanceB
							: firstPeriod.openingBalance / 2
						: 0;
					if (loadedProfileCount === 1) {
						nextAccounts = [
							{
								id: 'default-a',
								name: `Efectivo ${loadedUserNames.userAName}`,
								owner: 'userA',
								initialBalance: initialBalA
							}
						];
					} else {
						nextAccounts = [
							{
								id: 'default-a',
								name: `Efectivo ${loadedUserNames.userAName}`,
								owner: 'userA',
								initialBalance: initialBalA
							},
							{
								id: 'default-b',
								name: `Efectivo ${loadedUserNames.userBName}`,
								owner: 'userB',
								initialBalance: initialBalB
							},
							{ id: 'default-joint', name: 'Cuenta Común', owner: 'joint', initialBalance: 0 }
						];
					}
					if (!cancelled) {
						await saveStoredAccounts(nextAccounts);
					}
				}

				const loadedKey = await readGeminiApiKey();
				const loadedChat = await readAiChat();
				if (cancelled) return;

				const generated = autoGenerateMissingPeriods(loadedPeriods, loadedTx);

				setTransactions(generated.transactions);
				setDebts(loadedDebts);
				setPeriods(generated.periods);
				setAccounts(nextAccounts);
				setGeminiApiKey(loadedKey);
				setChatMessages(loadedChat);
				setUserAName(loadedUserNames.userAName);
				setUserBName(loadedUserNames.userBName);
				setProfileCount(loadedProfileCount as 1 | 2);

				const finalPeriods = generated.periods;
				if (finalPeriods.length > 0) {
					const sortedP = [...finalPeriods].sort((a, b) => a.month.localeCompare(b.month));
					const currentMonth = new Date().toISOString().substring(0, 7);
					const exists = sortedP.some((p) => p.month === currentMonth);
					setSelectedMonth(exists ? currentMonth : sortedP[sortedP.length - 1].month);
				}

				setIsInitialized(true);
			} else if (isLocked) {
				if (!localStorage.getItem('finanzas_v3_password_salt')) {
					setIsLocked(false);
				}
			} else {
				setIsInitialized(true);
			}
		};
		initAsync();

		return () => {
			cancelled = true;
		};
	}, [
		isLocked,
		hasPasswordSet,
		setIsLocked,
		setDebts,
		setTransactions,
		setAccounts,
		setGeminiApiKey,
		setChatMessages
	]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveStoredTransactions(transactions);
	}, [transactions, isInitialized, isLocked]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveStoredDebts(debts);
	}, [debts, isInitialized, isLocked]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveStoredPeriods(periods);
	}, [periods, isInitialized, isLocked]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveUserNames({ userAName });
	}, [userAName, isInitialized, isLocked]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveUserNames({ userBName });
	}, [userBName, isInitialized, isLocked]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveProfileCount(profileCount);
	}, [profileCount, isInitialized, isLocked]);

	useEffect(() => {
		if (!isInitialized || isLocked) return;
		saveStoredAccounts(accounts);
	}, [accounts, isInitialized, isLocked]);

	// === PROPAGAR CÁLCULOS AL MOTOR FINANCIERO ===
	const timelineBalances = calculateTimelineBalances(periods, transactions, debts, accounts, viewMode, profileCount);

	const activePeriodData = timelineBalances[selectedMonth] ?? {
		month: selectedMonth,
		openingBalance: 0,
		incomes: 0,
		expenses: 0,
		debtPayments: 0,
		netBalance: 0,
		closingBalance: 0,
		accountBalances: {}
	};

	const totalIncomes = activePeriodData.incomes;
	const totalExpenses = activePeriodData.expenses;
	const totalMonthlyDebtPayments = activePeriodData.debtPayments;
	const netMonthlyBalance = activePeriodData.netBalance;
	const currentOpeningBalance = activePeriodData.openingBalance;
	const currentClosingBalance = activePeriodData.closingBalance;

	const filteredTransactions = transactions
		.filter((t) => t.date.substring(0, 7) === selectedMonth)
		.sort((a, b) => {
			const dateCompare = b.date.localeCompare(a.date);
			if (dateCompare !== 0) return dateCompare;
			return transactions.indexOf(a) - transactions.indexOf(b);
		});

	const getEffectiveAmountWrapper = (t: Transaction) => getEffectiveAmount(t, viewMode, accounts, profileCount);

	const recurringIncomes = filteredTransactions
		.filter((t) => t.type === 'income' && t.recurrence === 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);

	const oneOffIncomes = filteredTransactions
		.filter((t) => t.type === 'income' && t.recurrence !== 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);

	const recurringExpenses = filteredTransactions
		.filter((t) => t.type === 'expense' && t.recurrence === 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);

	const oneOffExpenses = filteredTransactions
		.filter((t) => t.type === 'expense' && t.recurrence !== 'recurring')
		.reduce((sum, t) => sum + getEffectiveAmountWrapper(t), 0);

	// Deudas activas en el mes seleccionado (excluyendo expiradas y futuras)
	const filteredDebts = debts.filter((d) => {
		const start = normalizeMonth(d.date);
		if (start > selectedMonth) return false;
		if (isClassicDebt(d)) {
			const end = addMonthsToMonth(start, d.termMonths - 1);
			return selectedMonth <= end;
		}
		return getPaymentPlanRemainingAmount(d) > 0 || getPaymentPlanOverdueAmount(d, selectedMonth) > 0;
	});

	// Gastos conjuntos pagados por cada uno (en el mes activo)
	const jointPaidByA = filteredTransactions
		.filter((t) => t.type === 'expense' && t.owner === 'joint' && t.paidBy === 'userA')
		.reduce((sum, t) => sum + toNumber(t.money?.amount ?? '0'), 0);

	const jointPaidByB = filteredTransactions
		.filter((t) => t.type === 'expense' && t.owner === 'joint' && t.paidBy === 'userB')
		.reduce((sum, t) => sum + toNumber(t.money?.amount ?? '0'), 0);

	const netOwed = (jointPaidByA - jointPaidByB) / 2;

	// Desglose de etiquetas para este mes
	const tagData = getTagBreakdown(filteredTransactions, filteredDebts, selectedMonth);
	const maxTagAmount = tagData.length > 0 ? Math.max(...tagData.map((d) => d.amount)) : 1;

	// === SIMULACIÓN DE CONSOLIDACIÓN (RESULTADOS) ===
	const consolidatedDebtsObjects = debts.filter(
		(d): d is ClassicDebt => isClassicDebt(d) && selectedDebtsForConsolidation.includes(d.id)
	);
	const consolidatedPrincipal = consolidatedDebtsObjects.reduce((sum, d) => sum + d.principal, 0);

	const additionalCapital = toNumber(consolidationForm.extraCapital);
	const totalNewPrincipal = consolidatedPrincipal + additionalCapital;

	const currentConsolidatedMonthlySum = consolidatedDebtsObjects.reduce((sum, d) => {
		return sum + calculateDebtMonthlyPayment(d, selectedMonth);
	}, 0);

	const currentTotalInterests = consolidatedDebtsObjects.reduce((sum, d) => {
		const cuota = calculateClassicDebtInstallment(d);
		return sum + (cuota * d.termMonths - d.principal);
	}, 0);

	const newConsolidatedCuota = calculateMonthlyPayment(
		totalNewPrincipal,
		toNumber(consolidationForm.tae),
		Math.trunc(toNumber(consolidationForm.termMonths || '1'))
	);

	const newTotalConsolidatedPayment =
		newConsolidatedCuota * Math.trunc(toNumber(consolidationForm.termMonths || '1'));
	const newConsolidatedInterests = Math.max(0, newTotalConsolidatedPayment - totalNewPrincipal);

	// Snapshot financiero para el prompt del asesor IA (consumido por useAiAdvisor al preguntar).
	// Se actualiza tras cada commit para que la pregunta use siempre los derivados más recientes.
	useEffect(() => {
		promptParamsRef.current = () => ({
			userAName,
			userBName,
			viewMode,
			selectedMonth,
			totalIncomes,
			recurringIncomes,
			oneOffIncomes,
			totalExpenses,
			recurringExpenses,
			oneOffExpenses,
			totalMonthlyDebtPayments,
			netMonthlyBalance,
			jointPaidByA,
			jointPaidByB,
			netOwed,
			tagData,
			filteredTransactions,
			debts,
			filteredDebts,
			consolidatedDebtsObjects,
			consolidatedPrincipal,
			additionalCapital,
			totalNewPrincipal,
			currentConsolidatedMonthlySum,
			currentTotalInterests,
			newConsolidatedCuota,
			newTotalConsolidatedPayment,
			newConsolidatedInterests,
			consolidationFormTae: consolidationForm.tae,
			consolidationFormTermMonths: consolidationForm.termMonths
		});
	});

	// === ACCIONES DE GESTIÓN (MANEJADORES) ===
	const handleSetProfileCount = (count: 1 | 2) => {
		setProfileCount(count);
		if (count === 2) {
			setAccounts((prev) => {
				const next = [...prev];
				if (!next.some((a) => a.id === 'default-b')) {
					next.push({
						id: 'default-b',
						name: `Efectivo ${userBName}`,
						owner: 'userB',
						initialBalance: 0
					});
				}
				if (!next.some((a) => a.id === 'default-joint')) {
					next.push({
						id: 'default-joint',
						name: 'Cuenta Común',
						owner: 'joint',
						initialBalance: 0
					});
				}
				return next;
			});
			if (isReconfiguring) {
				setReconfigAccounts((prev) => {
					const next = [...prev];
					if (!next.some((a) => a.id === 'default-b')) {
						next.push({
							id: 'default-b',
							name: `Efectivo ${userBName}`,
							owner: 'userB',
							initialBalance: 0
						});
					}
					if (!next.some((a) => a.id === 'default-joint')) {
						next.push({
							id: 'default-joint',
							name: 'Cuenta Común',
							owner: 'joint',
							initialBalance: 0
						});
					}
					return next;
				});
			}
		}
	};

	const handleInitAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		const sourceAccounts = isReconfiguring ? reconfigAccounts : accounts;
		const filteredAccounts = sourceAccounts.filter((acc) => profileCount === 2 || acc.owner === 'userA');
		const normalizedAccounts = filteredAccounts.map((account) => {
			const initialBalance = parseOpeningBalanceInput(account.initialBalance);
			return {
				...account,
				initialBalance: Number.isNaN(initialBalance) ? 0 : initialBalance
			};
		});

		setAccounts(normalizedAccounts);

		const totalBalance = normalizedAccounts.reduce((sum, account) => sum + account.initialBalance, 0);

		const targetMonth = initFlow === 'current' ? new Date().toISOString().substring(0, 7) : initMonth;
		const newPeriod: Period = {
			month: targetMonth,
			openingBalance: totalBalance,
			isManualInit: true
		};
		setPeriods([newPeriod]);
		setSelectedMonth(targetMonth);
		setIsReconfiguring(false);
	};

	const handleResetAccount = () => {
		if (
			window.confirm(
				'¿Estás seguro de que querés reiniciar toda la cuenta? Se borrarán todas las transacciones, deudas y períodos.'
			)
		) {
			setPeriods([]);
			setTransactions([]);
			setDebts([]);
			setChatMessages([]);
			setSelectedMonth(new Date().toISOString().substring(0, 7));
			setIsReconfiguring(false);
		}
	};

	const handleCreateNextMonth = () => {
		if (periods.length === 0) return;
		const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
		const latestMonth = sorted[sorted.length - 1].month;
		const nextMonth = addMonthsToMonth(latestMonth, 1);

		if (periods.some((p) => p.month === nextMonth)) {
			setSelectedMonth(nextMonth);
			return;
		}

		const newPeriod: Period = {
			month: nextMonth,
			openingBalance: 0
		};

		// Copiar movimientos recurrentes del último mes al nuevo
		const recurringTxsInLatest = transactions.filter(
			(t) => t.date.substring(0, 7) === latestMonth && t.recurrence === 'recurring'
		);
		const cloned = recurringTxsInLatest.map((t) => ({
			...t,
			id: `${t.id}-${nextMonth}`,
			date: getValidDateForMonth(nextMonth, t.date.substring(8, 10)),
			originId: t.originId || t.id
		}));

		setPeriods([...periods, newPeriod]);
		if (cloned.length > 0) {
			setTransactions((prev) => [...cloned, ...prev]);
		}
		setSelectedMonth(nextMonth);
	};

	const handleDeleteAccount = (id: string) => {
		if (accounts.length <= 1) {
			window.alert('Debe haber al menos una cuenta en el sistema.');
			return;
		}
		if (
			window.confirm(
				'¿Estás seguro de que quieres eliminar esta cuenta? Los movimientos y deudas vinculados a ella pasarán a estar sin cuenta asociada.'
			)
		) {
			setAccounts(accounts.filter((a) => a.id !== id));

			setTransactions((prev) =>
				prev.map((t) => {
					const updated = { ...t };
					if (t.accountId === id) updated.accountId = undefined;
					if (t.fromAccountId === id) updated.fromAccountId = undefined;
					if (t.toAccountId === id) updated.toAccountId = undefined;
					return updated;
				})
			);

			setDebts((prev) =>
				prev.map((d) => {
					if (d.paymentAccountId === id) {
						return { ...d, paymentAccountId: undefined };
					}
					return d;
				})
			);
		}
	};

	const toggleDebtSelection = (id: string) => {
		const debt = debts.find((item) => item.id === id);
		if (!debt || isPaymentPlanDebt(debt)) return;

		if (selectedDebtsForConsolidation.includes(id)) {
			setSelectedDebtsForConsolidation(selectedDebtsForConsolidation.filter((itemId) => itemId !== id));
		} else {
			setSelectedDebtsForConsolidation([...selectedDebtsForConsolidation, id]);
		}
	};

	const handleDownloadChatPDF = (options: ChatPdfOptions) => {
		const iframe = document.createElement('iframe');
		iframe.style.position = 'fixed';
		iframe.style.right = '0';
		iframe.style.bottom = '0';
		iframe.style.width = '0';
		iframe.style.height = '0';
		iframe.style.border = '0';
		document.body.appendChild(iframe);

		const doc = iframe.contentWindow?.document || iframe.contentDocument;
		if (!doc) return;

		const { html, pdfTitle } = buildChatPdfHtml(
			{
				viewMode,
				userAName,
				userBName,
				selectedMonth,
				netOwed,
				accounts,
				accountBalances: activePeriodData.accountBalances ?? {},
				debts,
				filteredDebts,
				filteredTransactions,
				chatMessages,
				tagData,
				totalIncomes,
				recurringIncomes,
				oneOffIncomes,
				totalExpenses,
				recurringExpenses,
				oneOffExpenses,
				totalMonthlyDebtPayments,
				netMonthlyBalance,
				currentOpeningBalance,
				currentClosingBalance
			},
			options
		);

		doc.open();
		doc.write(html);
		doc.close();

		const originalTitle = document.title;
		document.title = pdfTitle;

		setTimeout(() => {
			iframe.contentWindow?.focus();
			iframe.contentWindow?.print();
			setTimeout(() => {
				document.title = originalTitle;
				document.body.removeChild(iframe);
			}, 1000);
		}, 300);
	};

	return (
		<FinanzasContext.Provider
			value={{
				userAName,
				setUserAName,
				userBName,
				setUserBName,
				profileCount,
				setProfileCount: handleSetProfileCount,
				viewMode,
				setViewMode,
				activeTab,
				setActiveTab,
				accounts,
				setAccounts,
				transactions,
				setTransactions,
				periods,
				setPeriods,
				debts,
				setDebts,
				selectedMonth,
				setSelectedMonth,
				txForm,
				setTxForm,
				editingTx,
				setEditingTx,
				editForm,
				setEditForm,
				editScope,
				setEditScope,
				debtForm,
				setDebtForm,
				debtFormError,
				setDebtFormError,
				selectedDebtSchedule,
				setSelectedDebtSchedule,
				editingAccount,
				setEditingAccount,
				accountForm,
				setAccountForm,
				initFlow,
				setInitFlow,
				initMonth,
				setInitMonth,
				initBalance,
				setInitBalance,
				initBalanceA,
				setInitBalanceA,
				initBalanceB,
				setInitBalanceB,
				isReconfiguring,
				setIsReconfiguring,
				reconfigAccounts,
				setReconfigAccounts,
				isExportPdfModalOpen,
				setIsExportPdfModalOpen,
				pdfExportOptions,
				setPdfExportOptions,
				selectedDebtsForConsolidation,
				setSelectedDebtsForConsolidation,
				consolidationForm,
				setConsolidationForm,
				geminiApiKey,
				setGeminiApiKey,
				customQuestion,
				setCustomQuestion,
				chatMessages,
				setChatMessages,
				aiLoading,
				aiError,
				setAiError,
				copiedChat,
				importError,
				setImportError,
				importSuccess,
				setImportSuccess,

				// Seguridad y PIN (OWASP)
				isLocked,
				isInitialized,
				hasPasswordSet,
				passwordError,
				setPasswordError,
				handleSetupPassword,
				handleUnlock,
				handleLockApp,

				// Ocultar Datos Sensibles
				hideSensitiveData,
				toggleSensitiveData,
				formatAmount,

				// Tema (Modo Claro/Oscuro)
				theme,
				toggleTheme,

				// Valores calculados
				activePeriodData,
				totalIncomes,
				totalExpenses,
				totalMonthlyDebtPayments,
				netMonthlyBalance,
				currentOpeningBalance,
				currentClosingBalance,
				filteredTransactions,
				recurringIncomes,
				oneOffIncomes,
				recurringExpenses,
				oneOffExpenses,
				filteredDebts,
				jointPaidByA,
				jointPaidByB,
				netOwed,
				tagData,
				maxTagAmount,
				timelineBalances,
				consolidatedDebtsObjects,
				consolidatedPrincipal,
				additionalCapital,
				totalNewPrincipal,
				currentConsolidatedMonthlySum,
				currentTotalInterests,
				newConsolidatedCuota,
				newTotalConsolidatedPayment,
				newConsolidatedInterests,

				// Manejadores
				handleInitAccount,
				handleResetAccount,
				handleCreateNextMonth,
				handleAddTransaction,
				handleStartEditTransaction,
				handleSaveEditTransaction,
				handleDeleteTransaction,
				handleDeleteDebt,
				handleAddDebt,
				handleAddAccount,
				handleStartEditAccount,
				handleSaveEditAccount,
				handleDeleteAccount,
				toggleDebtSelection,
				updatePaymentPlanTranche,
				addPaymentPlanTranche,
				removePaymentPlanTranche,
				togglePaymentPlanInstallmentStatus,
				handleAskGemini,
				handleClearChat,
				handleCopyChatPlaintext,
				handleDownloadChatPDF,
				handleExportData,
				handleImportData
			}}
		>
			{children}
		</FinanzasContext.Provider>
	);
};
