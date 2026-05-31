import { createContext, useState, useEffect, type ReactNode, type SyntheticEvent } from 'react';
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
	TransactionType,
	PaymentPlanInstallment,
	InstallmentStatus,
	ClassicDebt,
	PaymentPlanDebt,
	TagBreakdown,
	TransactionRecurrence
} from '../types';
import { DEFAULT_TAGS, STORAGE_KEYS, LEGACY_DATA_KEYS } from '../constants';
import { 
	getInitialData, 
	readStoredDebts, 
	saveStoredTransactions, 
	saveStoredDebts, 
	saveStoredPeriods, 
	saveStoredAccounts, 
	saveGeminiApiKey, 
	saveAiChat,
	readGeminiApiKey,
	readAiChat,
	setCryptoKey,
	readStoredTransactions,
	readStoredAccounts,
	readStoredPeriods,
	readStoredDebtsSync,
	readGeminiApiKeySync,
	readAiChatSync
} from '../services/storageService';
import {
	deriveKeyFromPassword,
	encryptWithKey,
	decryptWithKey,
	generateSalt
} from '../services/cryptoService';
import { validateAndSanitizeBackup } from '../utils/backupValidator';
import { 
	addMonthsToMonth, 
	getValidDateForMonth, 
	normalizeMonth 
} from '../utils/dateUtils';
import { 
	toNumber,
	decodeHtmlEntities
} from '../utils/formatters';
import { 
	calculateDebtMonthlyPayment, 
	calculateMonthlyPayment, 
	getPaymentPlanRemainingAmount, 
	getPaymentPlanOverdueAmount,
	generatePaymentPlanInstallments,
	calculateTimelineBalances,
	getTagBreakdown,
	isPaymentPlanDebt,
	isClassicDebt,
	getEffectiveAmount,
	getDebtRateLabel
} from '../services/financeService';
import { 
	buildFinanceDataPrompt, 
	askGemini 
} from '../services/geminiService';

/**
 * Interfaz que define el valor del contexto de finanzas globales.
 */
export interface FinanzasContextType {
	// Nombres de usuarios
	userAName: string;
	setUserAName: (name: string) => void;
	userBName: string;
	setUserBName: (name: string) => void;
	
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
	setAccountForm: React.Dispatch<React.SetStateAction<{ name: string; owner: 'userA' | 'userB' | 'joint'; initialBalance: string }>>;
	
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
	setPdfExportOptions: React.Dispatch<React.SetStateAction<{ showContext: boolean; showDebts: boolean; showTransactions: boolean; showChat: boolean }>>;
	
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
	handleAddTransaction: (e: SyntheticEvent<HTMLFormElement>) => void;
	handleStartEditTransaction: (tx: Transaction) => void;
	handleSaveEditTransaction: (e: SyntheticEvent<HTMLFormElement>) => void;
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
	handleDownloadChatPDF: (options: { showContext: boolean; showDebts: boolean; showTransactions: boolean; showChat: boolean }) => void;
	handleExportData: () => void;
	handleImportData: (e: SyntheticEvent<HTMLFormElement>, jsonString: string) => void;
}

export const FinanzasContext = createContext<FinanzasContextType | undefined>(undefined);

export const FinanzasProvider = ({ children }: { children: ReactNode }) => {
	const currentMonthString = new Date().toISOString().substring(0, 7);

	// === ESTADOS GLOBALES ===
	const [userAName, setUserAName] = useState(() => localStorage.getItem(STORAGE_KEYS.userAName) || 'Usuario A');
	const [userBName, setUserBName] = useState(() => localStorage.getItem(STORAGE_KEYS.userBName) || 'Usuario B');
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
			const sign = amount < 0 ? '-' : (options?.showSign && amount > 0 ? '+' : '');
			return `${sign}***€`;
		}
		const decimals = options?.decimals !== undefined ? options.decimals : 2;
		const absoluteAmount = Math.abs(amount);
		const formatted = absoluteAmount.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
		const sign = amount < 0 ? '-' : (options?.showSign && amount > 0 ? '+' : '');
		return `${sign}${formatted}€`;
	};

	// Estados de Seguridad y PIN (OWASP)
	const [isLocked, setIsLocked] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('finanzas_v3_password_salt') !== null;
		}
		return false;
	});
	const [hasPasswordSet, setHasPasswordSet] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem('finanzas_v3_password_salt') !== null;
		}
		return false;
	});
	const [passwordError, setPasswordError] = useState('');

	const [accounts, setAccounts] = useState<Account[]>(() => getInitialData().accounts);

	// Estados de Edición de Transacción
	const [editingTx, setEditingTx] = useState<Transaction | null>(null);
	const [editForm, setEditForm] = useState<TxForm>({
		desc: '',
		amount: '',
		type: 'expense',
		tag: DEFAULT_TAGS.expense[0],
		date: `${currentMonthString}-01`,
		recurrence: 'one-off',
		owner: 'joint',
		paidBy: 'shared',
		accountId: '',
		fromAccountId: '',
		toAccountId: ''
	});
	const [editScope, setEditScope] = useState<'only-this' | 'future' | 'all'>('only-this');

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

	const [transactions, setTransactions] = useState<Transaction[]>(() => getInitialData().transactions);
	const [debts, setDebts] = useState<Debt[]>(() => readStoredDebtsSync());
	const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
	const [selectedDebtSchedule, setSelectedDebtSchedule] = useState<Debt | null>(null);

	// Formularios
	const [txForm, setTxForm] = useState<TxForm>({
		desc: '',
		amount: '',
		type: 'expense',
		tag: DEFAULT_TAGS.expense[0],
		date: `${selectedMonth}-01`,
		recurrence: 'one-off',
		owner: 'joint',
		paidBy: 'shared',
		accountId: '',
		fromAccountId: '',
		toAccountId: ''
	});
	
	const [debtForm, setDebtForm] = useState<DebtForm>({
		kind: 'classic',
		desc: '',
		principal: '',
		financedAmount: '',
		fees: '',
		tin: '',
		tae: '',
		termMonths: '',
		tranches: [{ id: 'initial-tranche', months: '', amount: '' }],
		tag: DEFAULT_TAGS.debt[0],
		date: selectedMonth,
		owner: 'joint',
		paymentAccountId: ''
	});
	const [debtFormError, setDebtFormError] = useState('');

	// Estados de gestión de Cuentas
	const [editingAccount, setEditingAccount] = useState<Account | null>(null);
	const [accountForm, setAccountForm] = useState({
		name: '',
		owner: 'joint' as 'userA' | 'userB' | 'joint',
		initialBalance: ''
	});

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

	// === INTEGRACIÓN GEMINI AI ===
	const [geminiApiKey, setGeminiApiKey] = useState(() => readGeminiApiKeySync());
	const [customQuestion, setCustomQuestion] = useState('');
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => readAiChatSync());
	const [aiLoading, setAiLoading] = useState(false);
	const [aiError, setAiError] = useState('');
	const [copiedChat, setCopiedChat] = useState(false);
	const [importError, setImportError] = useState('');
	const [importSuccess, setImportSuccess] = useState('');

	// Sincronización con LocalStorage vía StorageService
	useEffect(() => {
		LEGACY_DATA_KEYS.forEach((key) => localStorage.removeItem(key));
	}, []);

	useEffect(() => {
		saveStoredTransactions(transactions);
	}, [transactions]);

	useEffect(() => {
		saveStoredDebts(debts);
	}, [debts]);

	useEffect(() => {
		saveStoredPeriods(periods);
	}, [periods]);

	useEffect(() => {
		saveGeminiApiKey(geminiApiKey);
	}, [geminiApiKey]);

	useEffect(() => {
		saveAiChat(chatMessages);
	}, [chatMessages]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.userAName, userAName);
	}, [userAName]);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEYS.userBName, userBName);
	}, [userBName]);

	useEffect(() => {
		saveStoredAccounts(accounts);
	}, [accounts]);

	useEffect(() => {
		if (accounts.length > 0) {
			const firstJoint = accounts.find((a) => a.owner === 'joint')?.id || accounts[0].id;
			setTxForm((prev) => ({
				...prev,
				accountId: prev.accountId && accounts.some((a) => a.id === prev.accountId) ? prev.accountId : firstJoint,
				fromAccountId: prev.fromAccountId && accounts.some((a) => a.id === prev.fromAccountId) ? prev.fromAccountId : accounts[0].id,
				toAccountId: prev.toAccountId && accounts.some((a) => a.id === prev.toAccountId) ? prev.toAccountId : (accounts[1]?.id || accounts[0].id)
			}));
		}
	}, [accounts]);

	// Auto-generación de periodos faltantes si el mes actual es posterior al último registrado
	useEffect(() => {
		if (periods.length === 0) return;
		const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
		const latestMonth = sorted[sorted.length - 1].month;
		const currentMonth = new Date().toISOString().substring(0, 7);

		if (currentMonth > latestMonth) {
			const updatedPeriods = [...periods];
			let newTransactions = [...transactions];
			let iter = latestMonth;
			while (iter < currentMonth) {
				const prevMonth = iter;
				iter = addMonthsToMonth(iter, 1);
				updatedPeriods.push({
					month: iter,
					openingBalance: 0
				});

				// Copiar movimientos recurrentes del mes previo al nuevo mes iterado
				const recurringTxsInPrev = newTransactions.filter(
					(t) => t.date.substring(0, 7) === prevMonth && t.recurrence === 'recurring'
				);
				const cloned = recurringTxsInPrev.map((t) => ({
					...t,
					id: `${t.id}-${iter}`,
					date: getValidDateForMonth(iter, t.date.substring(8, 10)),
					originId: t.originId || t.id
				}));
				newTransactions = [...cloned, ...newTransactions];
			}
			setPeriods(updatedPeriods);
			setTransactions(newTransactions);
		}
	}, [periods, transactions]);

	// === PROPAGAR CÁLCULOS AL MOTOR FINANCIERO ===
	const timelineBalances = calculateTimelineBalances(periods, transactions, debts, accounts, viewMode);
	
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

	const filteredTransactions = transactions.filter((t) => t.date.substring(0, 7) === selectedMonth);

	const getEffectiveAmountWrapper = (t: Transaction) => getEffectiveAmount(t, viewMode, accounts);

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
		.reduce((sum, t) => sum + toNumber(t.amount), 0);

	const jointPaidByB = filteredTransactions
		.filter((t) => t.type === 'expense' && t.owner === 'joint' && t.paidBy === 'userB')
		.reduce((sum, t) => sum + toNumber(t.amount), 0);

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
		const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
		return sum + (cuota * d.termMonths - d.principal);
	}, 0);

	const newConsolidatedCuota = calculateMonthlyPayment(
		totalNewPrincipal,
		toNumber(consolidationForm.tae),
		Math.trunc(toNumber(consolidationForm.termMonths || '1'))
	);

	const newTotalConsolidatedPayment = newConsolidatedCuota * Math.trunc(toNumber(consolidationForm.termMonths || '1'));
	const newConsolidatedInterests = Math.max(0, newTotalConsolidatedPayment - totalNewPrincipal);

	// === ACCIONES DE GESTIÓN (MANEJADORES) ===
	const handleInitAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (isReconfiguring) {
			setAccounts(reconfigAccounts);
		}
		
		const totalBalance = (isReconfiguring ? reconfigAccounts : accounts).reduce((sum, a) => sum + (a.initialBalance || 0), 0);

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
		if (window.confirm('¿Estás seguro de que querés reiniciar toda la cuenta? Se borrarán todas las transacciones, deudas y períodos.')) {
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

	const handleAddTransaction = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!txForm.desc || !txForm.amount) return;

		const getTransferOwner = (fromId?: string, toId?: string) => {
			const fromAcc = accounts.find((a) => a.id === fromId);
			const toAcc = accounts.find((a) => a.id === toId);
			if (fromAcc && toAcc) {
				if (fromAcc.owner === toAcc.owner) return fromAcc.owner;
			}
			return 'joint';
		};

		const getEffectiveOwner = () => {
			if (txForm.type === 'transfer') {
				return getTransferOwner(txForm.fromAccountId, txForm.toAccountId);
			}
			return txForm.owner;
		};

		const getEffectivePaidBy = (effectiveOwner: 'userA' | 'userB' | 'joint') => {
			if (effectiveOwner !== 'joint') {
				return 'shared';
			}
			if (txForm.type !== 'transfer' && txForm.accountId) {
				const acc = accounts.find((a) => a.id === txForm.accountId);
				if (acc) {
					if (acc.owner === 'userA') return 'userA';
					if (acc.owner === 'userB') return 'userB';
					return 'shared';
				}
			}
			return txForm.paidBy;
		};

		const newTxId = Date.now().toString();
		const effectiveOwner = getEffectiveOwner();
		const effectivePaidBy = getEffectivePaidBy(effectiveOwner);
		const newTx: Transaction = {
			id: newTxId,
			desc: txForm.desc,
			amount: Math.abs(parseFloat(txForm.amount)),
			type: txForm.type,
			tag: txForm.tag,
			date: txForm.date,
			recurrence: txForm.recurrence || 'one-off',
			owner: effectiveOwner,
			paidBy: effectivePaidBy,
			accountId: txForm.type !== 'transfer' && txForm.accountId ? txForm.accountId : undefined,
			fromAccountId: txForm.type === 'transfer' ? txForm.fromAccountId : undefined,
			toAccountId: txForm.type === 'transfer' ? txForm.toAccountId : undefined
		};

		let newTransactions = [newTx, ...transactions];

		// Si es recurrente, propagar a todos los meses futuros que ya existan en periods
		if (newTx.recurrence === 'recurring') {
			const currentMonth = newTx.date.substring(0, 7);
			const dayPart = newTx.date.substring(8, 10);
			const futureMonths = periods
				.map((p) => p.month)
				.filter((m) => m > currentMonth)
				.sort();

			const propagatedClones: Transaction[] = [];
			futureMonths.forEach((m) => {
				const cloneId = `${newTxId}-${m}`;
				propagatedClones.push({
					...newTx,
					id: cloneId,
					date: getValidDateForMonth(m, dayPart),
					originId: newTxId
				});
			});
			newTransactions = [...propagatedClones, ...newTransactions];
		}

		setTransactions(newTransactions);
		setTxForm({
			...txForm,
			desc: '',
			amount: '',
			recurrence: 'one-off'
		});
	};

	const handleStartEditTransaction = (tx: Transaction) => {
		setEditingTx(tx);
		setEditForm({
			desc: tx.desc,
			amount: String(tx.amount),
			type: tx.type,
			tag: tx.tag,
			date: tx.date,
			recurrence: tx.recurrence || 'one-off',
			owner: tx.owner || 'joint',
			paidBy: tx.paidBy || 'shared',
			accountId: tx.accountId || '',
			fromAccountId: tx.fromAccountId || (accounts[0]?.id || ''),
			toAccountId: tx.toAccountId || (accounts[1]?.id || accounts[0]?.id || '')
		});
		setEditScope('only-this');
	};

	const handleSaveEditTransaction = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingTx || !editForm.desc || !editForm.amount) return;

		const updatedAmount = Math.abs(parseFloat(editForm.amount));
		const rootId = editingTx.originId || editingTx.id;
		const currentMonth = editingTx.date.substring(0, 7);

		const getTransferOwner = (fromId?: string, toId?: string) => {
			const fromAcc = accounts.find((a) => a.id === fromId);
			const toAcc = accounts.find((a) => a.id === toId);
			if (fromAcc && toAcc) {
				if (fromAcc.owner === toAcc.owner) return fromAcc.owner;
			}
			return 'joint';
		};

		const getEffectiveOwner = () => {
			if (editForm.type === 'transfer') {
				return getTransferOwner(editForm.fromAccountId, editForm.toAccountId);
			}
			return editForm.owner;
		};

		const getEffectivePaidBy = (effectiveOwner: 'userA' | 'userB' | 'joint') => {
			if (effectiveOwner !== 'joint') {
				return 'shared';
			}
			if (editForm.type !== 'transfer' && editForm.accountId) {
				const acc = accounts.find((a) => a.id === editForm.accountId);
				if (acc) {
					if (acc.owner === 'userA') return 'userA';
					if (acc.owner === 'userB') return 'userB';
					return 'shared';
				}
			}
			return editForm.paidBy;
		};

		const effectiveOwner = getEffectiveOwner();
		const effectivePaidBy = getEffectivePaidBy(effectiveOwner);
		const updatedFields = {
			desc: editForm.desc,
			type: editForm.type,
			tag: editForm.tag,
			owner: effectiveOwner,
			paidBy: effectivePaidBy,
			accountId: editForm.type !== 'transfer' && editForm.accountId ? editForm.accountId : undefined,
			fromAccountId: editForm.type === 'transfer' ? editForm.fromAccountId : undefined,
			toAccountId: editForm.type === 'transfer' ? editForm.toAccountId : undefined
		};

		const wasOneOff = editingTx.recurrence !== 'recurring';
		const isNowRecurring = editForm.recurrence === 'recurring';

		setTransactions((prev) => {
			let updatedTxs = prev.map((t): Transaction => {
				const isTarget = t.id === editingTx.id;
				
				if (editingTx.recurrence === 'recurring') {
					if (editScope === 'only-this') {
						if (isTarget) {
							return {
								...t,
								...updatedFields,
								amount: updatedAmount,
								date: editForm.date,
								recurrence: 'one-off',
								originId: undefined
							};
						}
					} else if (editScope === 'future') {
						const isFutureOccurrence =
							t.id === editingTx.id ||
							(t.originId === rootId && t.date.substring(0, 7) >= currentMonth);
						if (isFutureOccurrence) {
							const targetRecurrence: TransactionRecurrence = editForm.recurrence || 'one-off';
							return {
								...t,
								...updatedFields,
								amount: updatedAmount,
								date: t.id === editingTx.id ? editForm.date : t.date,
								recurrence: targetRecurrence,
								originId: targetRecurrence === 'recurring' ? t.originId : undefined
							};
						}
					} else if (editScope === 'all') {
						const isAnyOccurrence = t.id === rootId || t.originId === rootId;
						if (isAnyOccurrence) {
							const targetRecurrence: TransactionRecurrence = editForm.recurrence || 'one-off';
							return {
								...t,
								...updatedFields,
								amount: updatedAmount,
								date: t.id === editingTx.id ? editForm.date : t.date,
								recurrence: targetRecurrence,
								originId: targetRecurrence === 'recurring' ? t.originId : undefined
							};
						}
					}
				} else {
					if (isTarget) {
						return {
							...t,
							...updatedFields,
							amount: updatedAmount,
							date: editForm.date,
							recurrence: (editForm.recurrence || 'one-off') as TransactionRecurrence
						};
					}
				}
				return t;
			});

			if (wasOneOff && isNowRecurring) {
				const currentMonth = editForm.date.substring(0, 7);
				const dayPart = editForm.date.substring(8, 10);
				const futureMonths = periods
					.map((p) => p.month)
					.filter((m) => m > currentMonth)
					.sort();

				const propagatedClones: Transaction[] = [];
				futureMonths.forEach((m) => {
					const cloneId = `${editingTx.id}-${m}`;
					if (!updatedTxs.some((t) => t.id === cloneId)) {
						propagatedClones.push({
							...editingTx,
							...updatedFields,
							amount: updatedAmount,
							id: cloneId,
							date: getValidDateForMonth(m, dayPart),
							recurrence: 'recurring',
							originId: editingTx.id
						});
					}
				});
				updatedTxs = [...propagatedClones, ...updatedTxs];
			}

			return updatedTxs;
		});

		setEditingTx(null);
	};

	const handleDeleteTransaction = (id: string) => {
		const targetTx = transactions.find((t) => t.id === id);
		if (!targetTx) return;

		if (targetTx.recurrence === 'recurring') {
			const deleteFuture = window.confirm(
				'Este es un movimiento recurrente. ¿Querés eliminarlo también de los meses futuros?'
			);
			if (deleteFuture) {
				const rootId = targetTx.originId || targetTx.id;
				const currentMonth = targetTx.date.substring(0, 7);
				setTransactions(
					transactions.filter(
						(t) =>
							t.id !== id &&
							!(t.date.substring(0, 7) >= currentMonth && (t.id === rootId || t.originId === rootId))
					)
				);
				return;
			}
		}

		setTransactions(transactions.filter((t) => t.id !== id));
	};

	const handleDeleteDebt = (id: string) => {
		setDebts(debts.filter((d) => d.id !== id));
		setSelectedDebtsForConsolidation(selectedDebtsForConsolidation.filter((itemId) => itemId !== id));
		if (selectedDebtSchedule?.id === id) {
			setSelectedDebtSchedule(null);
		}
	};

	const handleAddDebt = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		setDebtFormError('');

		if (!debtForm.desc) return;

		if (debtForm.kind === 'classic') {
			if (!debtForm.principal || !debtForm.tae || !debtForm.termMonths) return;

			const tin = debtForm.tin ? Math.abs(parseFloat(debtForm.tin)) : undefined;
			const newDebt: Debt = {
				id: Date.now().toString(),
				kind: 'classic',
				desc: debtForm.desc,
				principal: Math.abs(parseFloat(debtForm.principal)),
				tin,
				tae: Math.abs(parseFloat(debtForm.tae)),
				termMonths: Math.abs(parseInt(debtForm.termMonths)),
				tag: debtForm.tag,
				date: normalizeMonth(debtForm.date),
				owner: debtForm.owner,
				paymentAccountId: debtForm.paymentAccountId || undefined
			};

			setDebts([newDebt, ...debts]);
			setDebtForm({ ...debtForm, desc: '', principal: '', tin: '', tae: '', termMonths: '', owner: 'joint', paymentAccountId: '' });
			return;
		}

		if (!debtForm.financedAmount) return;

		const validTranches = debtForm.tranches.filter(
			(tranche) => toNumber(tranche.months) > 0 && toNumber(tranche.amount) > 0
		);
		if (validTranches.length === 0) {
			setDebtFormError('Agregá al menos un tramo con meses e importe mensual.');
			return;
		}

		const financedAmount = Math.abs(toNumber(debtForm.financedAmount));
		const fees = Math.abs(toNumber(debtForm.fees));
		const totalToPay = financedAmount + fees;
		const scheduleTotal = validTranches.reduce(
			(sum, tranche) => sum + Math.trunc(toNumber(tranche.months)) * Math.abs(toNumber(tranche.amount)),
			0
		);

		if (Math.abs(scheduleTotal - totalToPay) > 0.01) {
			setDebtFormError(
				`La suma de cuotas (${scheduleTotal.toFixed(2)}€) debe coincidir con el total a pagar (${totalToPay.toFixed(2)}€).`
			);
			return;
		}

		const id = Date.now().toString();
		const newDebt: Debt = {
			id,
			kind: 'paymentPlan',
			desc: debtForm.desc,
			financedAmount,
			fees,
			totalToPay,
			installments: generatePaymentPlanInstallments(id, normalizeMonth(debtForm.date), validTranches),
			tag: debtForm.tag,
			date: normalizeMonth(debtForm.date),
			owner: debtForm.owner,
			paymentAccountId: debtForm.paymentAccountId || undefined
		};

		setDebts([newDebt, ...debts]);
		setDebtForm({
			...debtForm,
			desc: '',
			financedAmount: '',
			fees: '',
			tranches: [{ id: `tranche-${Date.now()}`, months: '', amount: '' }],
			owner: 'joint',
			paymentAccountId: ''
		});
	};

	const handleAddAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!accountForm.name) return;

		const newAcc: Account = {
			id: Date.now().toString(),
			name: accountForm.name,
			owner: accountForm.owner,
			initialBalance: Math.abs(parseFloat(accountForm.initialBalance) || 0)
		};

		setAccounts([...accounts, newAcc]);
		setAccountForm({ name: '', owner: 'joint', initialBalance: '' });
	};

	const handleSaveEditAccount = (e: SyntheticEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingAccount || !accountForm.name) return;

		const updatedBalance = Math.abs(parseFloat(accountForm.initialBalance) || 0);
		setAccounts(accounts.map((acc) => {
			if (acc.id === editingAccount.id) {
				return {
					...acc,
					name: accountForm.name,
					owner: accountForm.owner,
					initialBalance: updatedBalance
				};
			}
			return acc;
		}));

		setEditingAccount(null);
		setAccountForm({ name: '', owner: 'joint', initialBalance: '' });
	};

	const handleStartEditAccount = (acc: Account) => {
		setEditingAccount(acc);
		setAccountForm({
			name: acc.name,
			owner: acc.owner,
			initialBalance: String(acc.initialBalance)
		});
	};

	const handleDeleteAccount = (id: string) => {
		if (accounts.length <= 1) {
			window.alert('Debe haber al menos una cuenta en el sistema.');
			return;
		}
		if (window.confirm('¿Estás seguro de que quieres eliminar esta cuenta? Los movimientos y deudas vinculados a ella pasarán a estar sin cuenta asociada.')) {
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

	const updatePaymentPlanTranche = (id: string, patch: Partial<{ id: string; months: string; amount: string }>) => {
		setDebtForm((prev) => ({
			...prev,
			tranches: prev.tranches.map((tranche) => (tranche.id === id ? { ...tranche, ...patch } : tranche))
		}));
	};

	const addPaymentPlanTranche = () => {
		setDebtForm((prev) => ({
			...prev,
			tranches: [...prev.tranches, { id: `tranche-${Date.now()}`, months: '', amount: '' }]
		}));
	};

	const removePaymentPlanTranche = (id: string) => {
		setDebtForm((prev) => ({
			...prev,
			tranches: prev.tranches.length > 1 ? prev.tranches.filter((tranche) => tranche.id !== id) : prev.tranches
		}));
	};

	const togglePaymentPlanInstallmentStatus = (debtId: string, installmentId: string) => {
		const updatedDebts: Debt[] = debts.map((debt) => {
			if (!isPaymentPlanDebt(debt) || debt.id !== debtId) return debt;
			return {
				...debt,
				installments: debt.installments.map((installment) =>
					installment.id === installmentId
						? { ...installment, status: (installment.status === 'paid' ? 'pending' : 'paid') as InstallmentStatus }
						: installment
				)
			};
		});
		setDebts(updatedDebts);
		setSelectedDebtSchedule(updatedDebts.find((debt) => debt.id === debtId) ?? null);
	};

	// === LÓGICA DE GEMINI ===
	const handleAskGemini = async (questionText: string) => {
		if (!geminiApiKey) {
			setAiError('Por favor, introduce tu API Key de Gemini en el apartado correspondiente.');
			return;
		}
		if (!questionText.trim()) return;

		setAiLoading(true);
		setAiError('');

		const userMsg: ChatMessage = {
			role: 'user',
			content: questionText,
			timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		};
		const updatedMessages = [...chatMessages, userMsg];
		setChatMessages(updatedMessages);
		setCustomQuestion('');

		try {
			const promptParams = {
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
			};

			const systemPrompt = buildFinanceDataPrompt(promptParams);
			const responseText = await askGemini(geminiApiKey, updatedMessages, systemPrompt);
			const cleanedResponse = decodeHtmlEntities(responseText);

			const aiMsg: ChatMessage = {
				role: 'model',
				content: cleanedResponse,
				timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			};
			setChatMessages((prev) => [...prev, aiMsg]);
		} catch (err: any) {
			setAiError(err.message || 'Error de comunicación con Gemini.');
		} finally {
			setAiLoading(false);
		}
	};

	const handleClearChat = () => {
		if (window.confirm('¿Seguro que quieres borrar el historial de la conversación?')) {
			setChatMessages([]);
			localStorage.removeItem(STORAGE_KEYS.aiChat);
		}
	};

	const stripMarkdown = (text: string): string => {
		let output = text;
		output = output.replace(/```[a-zA-Z]*\n([\s\S]*?)\n```/g, '$1');
		output = output.replace(/```([\s\S]*?)```/g, '$1');
		output = output.replace(/`([^`\n]+)`/g, '$1');
		output = output.replace(/\*\*([^*]+)\*\*/g, '$1');
		output = output.replace(/\*([^*]+)\*/g, '$1');
		output = output.replace(/__([^_]+)__/g, '$1');
		output = output.replace(/_([^_]+)_/g, '$1');
		output = output.replace(/^#{1,6}\s+(.*)$/gm, '$1');
		output = output.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
		output = output.replace(/^\|?\s*:?-+\s*:?\s*(?:\|\s*:?-+\s*:?\s*)*\|?$/gm, '');
		output = output.replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, content) => {
			return content.split('|').map((cell) => cell.trim()).filter(c => c !== '').join('\t');
		});
		output = output.replace(/[ \t]+$/gm, '');
		output = output.replace(/\n{3,}/g, '\n\n');
		return output.trim();
	};

	const handleCopyChatPlaintext = () => {
		const text = chatMessages
			.map((msg) => {
				const roleName = msg.role === 'user' ? 'Tú' : 'Asesor Gemini';
				const plainContent = msg.role === 'user' ? msg.content : stripMarkdown(msg.content);
				return `[${msg.timestamp}] ${roleName}:\n${plainContent}`;
			})
			.join('\n\n');

		navigator.clipboard.writeText(text).then(() => {
			// Copied successfully. We can manage a temporary visual feedback if needed.
		}).catch((err) => {
			console.error('Failed to copy text: ', err);
		});
	};

	const convertMarkdownToHtml = (text: string): string => {
		const parts = text.split(/(```[\s\S]*?```)/g);

		const renderInlineMarkdownHtml = (inlineText: string): string => {
			let escaped = inlineText
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');

			escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
			escaped = escaped.replace(/`(.*?)`/g, '<code style="background-color: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #4f46e5;">$1</code>');
			return escaped;
		};

		const htmlParts = parts.map((part) => {
			if (part.startsWith('```')) {
				const lines = part.split('\n');
				let language = 'text';
				let code = part;
				if (lines[0].startsWith('```')) {
					language = lines[0].replace('```', '').trim() || 'text';
					code = lines.slice(1, -1).join('\n');
				}
				const escapedCode = code
					.replace(/&/g, '&amp;')
					.replace(/</g, '&lt;')
					.replace(/>/g, '&gt;');
				return `<pre style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 12px; overflow-x: auto; color: #334155; margin: 8px 0;">` +
					(language !== 'text' ? `<span style="display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 6px; font-family: sans-serif;">${language}</span>` : '') +
					`<code>${escapedCode}</code></pre>`;
			} else {
				const lines = part.split('\n');
				const renderedHtml: string[] = [];
				let listItems: string[] = [];
				let listType: 'ol' | 'ul' | null = null;

				const flushListHtml = () => {
					if (listItems.length > 0) {
						if (listType === 'ul') {
							renderedHtml.push(`<ul style="list-style-type: disc; padding-left: 20px; margin: 8px 0; color: #334155;">${listItems.map(item => `<li style="margin-bottom: 4px;">${renderInlineMarkdownHtml(item)}</li>`).join('')}</ul>`);
						} else if (listType === 'ol') {
							renderedHtml.push(`<ol style="list-style-type: decimal; padding-left: 20px; margin: 8px 0; color: #334155;">${listItems.map(item => `<li style="margin-bottom: 4px;">${renderInlineMarkdownHtml(item)}</li>`).join('')}</ol>`);
						}
						listItems = [];
						listType = null;
					}
				};

				const parseTableHtml = (tableLines: string[]): string => {
					if (tableLines.length < 2) return '';
					
					const splitRow = (l: string) => {
						const parts = l.trim().split('|');
						if (l.trim().startsWith('|')) parts.shift();
						if (l.trim().endsWith('|')) parts.pop();
						return parts.map(p => p.trim());
					};

					const headers = splitRow(tableLines[0]);
					const sepLine = tableLines[1].trim();
					const isSeparator = /^\|?(\s*:?-+\s*:?\s*\|)+\s*:?-+\s*:?\|?$/.test(sepLine);
					
					let rowsStartIndex = 1;
					let alignStyles: string[] = [];
					
					if (isSeparator) {
						rowsStartIndex = 2;
						const sepCells = splitRow(tableLines[1]);
						alignStyles = sepCells.map(cell => {
							const trimmed = cell.trim();
							const left = trimmed.startsWith(':');
							const right = trimmed.endsWith(':');
							if (left && right) return 'text-align: center;';
							if (right) return 'text-align: right;';
							if (left) return 'text-align: left;';
							return '';
						});
					}

					const rows = tableLines.slice(rowsStartIndex).map(rowLine => splitRow(rowLine));

					let tableHtml = `<div style="overflow-x: auto; margin: 12px 0; border: 1px solid #e2e8f0; border-radius: 8px;"><table style="min-width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">`;
					tableHtml += `<thead style="background-color: #f1f5f9; color: #475569; font-weight: bold; border-bottom: 1px solid #e2e8f0;"><tr>`;
					headers.forEach((h, idx) => {
						const align = alignStyles[idx] || '';
						tableHtml += `<th style="padding: 8px 12px; border-right: 1px solid #e2e8f0; ${align}">${renderInlineMarkdownHtml(h)}</th>`;
					});
					tableHtml += `</tr></thead>`;

					tableHtml += `<tbody style="color: #334155;">`;
					rows.forEach((row, rIdx) => {
						const bg = rIdx % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;';
						tableHtml += `<tr style="${bg} border-bottom: 1px solid #f1f5f9;">`;
						headers.forEach((_, cIdx) => {
							const cellValue = row[cIdx] || '';
							const align = alignStyles[cIdx] || '';
							tableHtml += `<td style="padding: 6px 12px; border-right: 1px solid #f1f5f9; ${align}">${renderInlineMarkdownHtml(cellValue)}</td>`;
						});
						tableHtml += `</tr>`;
					});
					tableHtml += `</tbody></table></div>`;
					return tableHtml;
				};

				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];
					const trimmedLine = line.trim();

					if (trimmedLine === '') {
						flushListHtml();
						continue;
					}

					if (trimmedLine.startsWith('|')) {
						flushListHtml();
						const tableLines = [line];
						while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
							i++;
							tableLines.push(lines[i]);
						}
						const tableHtml = parseTableHtml(tableLines);
						if (tableHtml) {
							renderedHtml.push(tableHtml);
						} else {
							tableLines.forEach((tLine) => {
								renderedHtml.push(`<p style="margin: 6px 0; color: #334155; line-height: 1.5; font-size: 13px;">${renderInlineMarkdownHtml(tLine)}</p>`);
							});
						}
						continue;
					}

					const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
					if (headerMatch) {
						flushListHtml();
						const level = headerMatch[1].length;
						const content = headerMatch[2];
						const fontSize = level === 1 ? '18px' : level === 2 ? '16px' : level === 3 ? '14px' : '12px';
						const margin = '12px 0 6px 0';
						renderedHtml.push(`<h${level + 2} style="font-size: ${fontSize}; font-weight: bold; color: #1e293b; margin: ${margin}; font-family: sans-serif;">${renderInlineMarkdownHtml(content)}</h${level + 2}>`);
						continue;
					}

					const ulMatch = line.match(/^[\*\-\+]\s+(.*)$/);
					if (ulMatch) {
						if (listType !== 'ul') {
							flushListHtml();
							listType = 'ul';
						}
						listItems.push(ulMatch[1]);
						continue;
					}

					const olMatch = line.match(/^\d+\.\s+(.*)$/);
					if (olMatch) {
						if (listType !== 'ol') {
							flushListHtml();
							listType = 'ol';
						}
						listItems.push(olMatch[1]);
						continue;
					}

					flushListHtml();
					renderedHtml.push(`<p style="margin: 6px 0; color: #334155; line-height: 1.5; font-size: 13px;">${renderInlineMarkdownHtml(line)}</p>`);
				}
				flushListHtml();
				return renderedHtml.join('');
			}
		});

		return htmlParts.join('');
	};

	const handleDownloadChatPDF = (options: {
		showContext: boolean;
		showDebts: boolean;
		showTransactions: boolean;
		showChat: boolean;
	}) => {
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

		const today = new Date();
		const yyyy = today.getFullYear();
		const mm = String(today.getMonth() + 1).padStart(2, '0');
		const dd = String(today.getDate()).padStart(2, '0');
		const hh = String(today.getHours()).padStart(2, '0');
		const min = String(today.getMinutes()).padStart(2, '0');
		const ss = String(today.getSeconds()).padStart(2, '0');
		const pdfTitle = `${yyyy}${mm}${dd}-${hh}${min}${ss}-finanzaspro`;

		const dateStr = today.toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});

		const escapeHtml = (str: string): string => {
			if (!str) return '';
			return str
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
		};

		const vistaActiva = viewMode === 'all' 
			? 'Conjunta' 
			: viewMode === 'userA' 
				? `Individual de ${escapeHtml(userAName)}` 
				: `Individual de ${escapeHtml(userBName)}`;

		const liquidacionText = netOwed === 0 
			? 'Cuentas al día' 
			: netOwed > 0 
				? `${escapeHtml(userBName)} debe a ${escapeHtml(userAName)} ${netOwed.toFixed(2)}€` 
				: `${escapeHtml(userAName)} debe a ${escapeHtml(userBName)} ${Math.abs(netOwed).toFixed(2)}€`;

		const accountsListHtml = accounts.map(acc => {
			const bal = activePeriodData.accountBalances?.[acc.id] ?? acc.initialBalance;
			const ownerLabel = acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Conjunta';
			return `
				<tr>
					<td>${escapeHtml(acc.name)}</td>
					<td>${escapeHtml(ownerLabel)}</td>
					<td style="text-align: right; font-weight: bold; color: ${bal >= 0 ? '#10b981' : '#ef4444'}">${bal.toFixed(2)}€</td>
				</tr>
			`;
		}).join('');

		const debtsListHtml = debts.length > 0 ? debts.map(d => {
			const ownerLabel = d.owner === 'userA' ? userAName : d.owner === 'userB' ? userBName : 'Conjunta';
			const cuota = calculateDebtMonthlyPayment(d, selectedMonth);
			const isActive = filteredDebts.some((fd) => fd.id === d.id);
			const isFuture = d.date > selectedMonth;
			const statusLabel = isActive ? 'Activa este mes' : isFuture ? `Futura (empieza en ${d.date})` : 'Inactiva';
			
			let details = '';
			if (isClassicDebt(d)) {
				details = `Capital: ${d.principal}€, ${getDebtRateLabel(d)}, Plazo: ${d.termMonths} meses`;
			} else {
				details = `Financiado: ${d.financedAmount}€, Comisiones: ${d.fees}€, Total: ${d.totalToPay}€`;
			}

			return `
				<tr>
					<td><strong>${escapeHtml(d.desc)}</strong><br/><small style="color: #64748b;">${escapeHtml(details)}</small></td>
					<td>${escapeHtml(ownerLabel)}</td>
					<td>${escapeHtml(statusLabel)}</td>
					<td style="text-align: right; font-weight: bold; color: #f59e0b;">${cuota.toFixed(2)}€</td>
				</tr>
			`;
		}).join('') : '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No hay deudas registradas</td></tr>';

		const transactionsListHtml = filteredTransactions.length > 0 ? filteredTransactions.map(t => {
			const ownerLabel = t.owner === 'userA' ? userAName : t.owner === 'userB' ? userBName : 'Conjunta';
			return `
				<tr>
					<td>${escapeHtml(t.desc)}</td>
					<td><span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 10px;">${escapeHtml(t.tag)}</span></td>
					<td>${t.recurrence === 'recurring' ? 'Recurrente' : 'Puntual'}</td>
					<td>${escapeHtml(ownerLabel)}</td>
					<td style="text-align: right; font-weight: bold; color: ${t.type === 'income' ? '#10b981' : '#ef4444'}">
						${t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}€
					</td>
				</tr>
			`;
		}).join('') : '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No hay movimientos este mes</td></tr>';

		const messagesHtml = chatMessages.map(msg => {
			const isUser = msg.role === 'user';
			const sender = isUser ? 'Tú' : 'Asesor Gemini';
			const bubbleClass = isUser ? 'message-user' : 'message-model';
			const contentHtml = isUser 
				? `<div style="white-space: pre-wrap;">${escapeHtml(msg.content)}</div>` 
				: convertMarkdownToHtml(msg.content);

			return `
				<div class="message-bubble ${bubbleClass}">
					<div class="message-meta">${escapeHtml(sender)} (${escapeHtml(msg.timestamp)})</div>
					<div>${contentHtml}</div>
				</div>
			`;
		}).join('');

		const tagBreakdownHtml = tagData.map(t => `
			<tr>
				<td>${escapeHtml(t.tag)}</td>
				<td style="text-align: right; font-weight: bold;">${t.amount.toFixed(2)}€</td>
			</tr>
		`).join('');

		const htmlSections: string[] = [];

		if (options.showContext) {
			htmlSections.push(`
				<div class="section-title">Contexto Financiero de la Vista</div>
				<div class="metrics-grid">
					<div class="metric-card">
						<div class="metric-label">Ingresos Totales</div>
						<div class="metric-value" style="color: #10b981;">+${totalIncomes.toFixed(2)}€</div>
						<div class="metric-sub">
							Recurrentes: +${recurringIncomes.toFixed(2)}€<br/>
							Puntuales: +${oneOffIncomes.toFixed(2)}€
						</div>
					</div>
					<div class="metric-card">
						<div class="metric-label">Gastos Totales</div>
						<div class="metric-value" style="color: #ef4444;">-${totalExpenses.toFixed(2)}€</div>
						<div class="metric-sub">
							Recurrentes: -${recurringExpenses.toFixed(2)}€<br/>
							Puntuales: -${oneOffExpenses.toFixed(2)}€
						</div>
					</div>
					<div class="metric-card">
						<div class="metric-label">Cuota Deudas</div>
						<div class="metric-value" style="color: #f59e0b;">-${totalMonthlyDebtPayments.toFixed(2)}€</div>
						<div class="metric-sub">
							Deudas activas: ${filteredDebts.length} de ${debts.length}
						</div>
					</div>
					<div class="metric-card" style="border-color: #4f46e5;">
						<div class="metric-label">Balance Neto Disponible</div>
						<div class="metric-value" style="color: ${netMonthlyBalance >= 0 ? '#4f46e5' : '#ef4444'};">
							${netMonthlyBalance.toFixed(2)}€
						</div>
						<div class="metric-sub">
							Apertura: ${currentOpeningBalance.toFixed(2)}€<br/>
							Cierre: ${currentClosingBalance.toFixed(2)}€
						</div>
					</div>
				</div>

				<div class="split-grid">
					<div>
						<div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
							Saldos de Cuentas (Cierre de Mes)
						</div>
						<div class="table-container">
							<table class="table">
								<thead>
									<tr>
										<th>Cuenta</th>
										<th>Propietario</th>
										<th style="text-align: right;">Saldo</th>
									</tr>
								</thead>
								<tbody>
									${accountsListHtml}
								</tbody>
							</table>
						</div>
					</div>
					<div>
						<div style="font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
							Distribución de Gastos por Etiqueta
						</div>
						<div class="table-container">
							<table class="table">
								<thead>
									<tr>
										<th>Categoría / Etiqueta</th>
										<th style="text-align: right;">Importe</th>
									</tr>
								</thead>
								<tbody>
									${tagBreakdownHtml.length > 0 ? tagBreakdownHtml : '<tr><td colspan="2" style="text-align: center; color: #94a3b8;">Sin gastos registrados</td></tr>'}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			`);
		}

		if (options.showDebts) {
			htmlSections.push(`
				<div class="section-title">Registro de Deudas del Mes</div>
				<div class="table-container" style="margin-bottom: 24px;">
					<table class="table">
						<thead>
							<tr>
								<th>Descripción</th>
								<th>Propietario</th>
								<th>Estado</th>
								<th style="text-align: right;">Cuota este Mes</th>
							</tr>
						</thead>
						<tbody>
							${debtsListHtml}
						</tbody>
					</table>
				</div>
			`);
		}

		if (options.showTransactions) {
			htmlSections.push(`
				<div class="section-title">Movimientos Detallados del Mes</div>
				<div class="table-container" style="margin-bottom: 24px;">
					<table class="table">
						<thead>
							<tr>
								<th>Concepto</th>
								<th>Categoría</th>
								<th>Frecuencia</th>
								<th>Propietario</th>
								<th style="text-align: right;">Importe</th>
							</tr>
						</thead>
						<tbody>
							${transactionsListHtml}
						</tbody>
					</table>
				</div>
			`);
		}

		if (options.showChat) {
			htmlSections.push(`
				<div class="section-title">Historial de Conversación con el Asesor</div>
				<div class="chat-history">
					${messagesHtml}
				</div>
			`);
		}

		const bodyContent = htmlSections.join('\n<div class="page-break"></div>\n');

		const html = `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<title>${pdfTitle}</title>
				<style>
					body {
						font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
						color: #334155;
						background-color: #ffffff;
						margin: 0;
						padding: 40px;
						line-height: 1.5;
					}
					.header {
						border-bottom: 2px solid #e2e8f0;
						padding-bottom: 16px;
						margin-bottom: 24px;
					}
					.header-top {
						display: flex;
						justify-content: space-between;
						align-items: flex-start;
					}
					.header h1 {
						margin: 0;
						font-size: 26px;
						color: #4f46e5;
						font-weight: 800;
						letter-spacing: -0.5px;
					}
					.header p {
						margin: 4px 0 0 0;
						font-size: 12px;
						color: #64748b;
					}
					.report-info {
						display: flex;
						justify-content: space-between;
						margin-top: 16px;
						font-size: 11px;
						color: #475569;
						background-color: #f8fafc;
						padding: 10px 16px;
						border-radius: 8px;
						border: 1px solid #e2e8f0;
					}
					.section-title {
						font-size: 11px;
						font-weight: 800;
						color: #0f172a;
						border-bottom: 2px solid #f1f5f9;
						padding-bottom: 6px;
						margin-top: 28px;
						margin-bottom: 16px;
						text-transform: uppercase;
						letter-spacing: 0.75px;
					}
					.metrics-grid {
						display: grid;
						grid-template-columns: repeat(4, 1fr);
						gap: 16px;
						margin-bottom: 24px;
					}
					.metric-card {
						border: 1px solid #e2e8f0;
						border-radius: 12px;
						padding: 16px;
						background-color: #f8fafc;
						box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
					}
					.metric-label {
						font-size: 10px;
						font-weight: 700;
						color: #64748b;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					.metric-value {
						font-size: 18px;
						font-weight: 800;
						margin-top: 6px;
					}
					.metric-sub {
						font-size: 9px;
						color: #94a3b8;
						margin-top: 4px;
						line-height: 1.4;
					}
					.split-grid {
						display: grid;
						grid-template-columns: 1fr 1fr;
						gap: 24px;
						margin-bottom: 24px;
					}
					.table-container {
						border: 1px solid #e2e8f0;
						border-radius: 12px;
						overflow: hidden;
						box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);
					}
					.table {
						width: 100%;
						border-collapse: collapse;
						font-size: 11px;
						text-align: left;
					}
					.table th {
						background-color: #f8fafc;
						color: #475569;
						font-weight: 700;
						padding: 8px 12px;
						border-bottom: 1px solid #e2e8f0;
						text-transform: uppercase;
						font-size: 9px;
						letter-spacing: 0.5px;
					}
					.table td {
						padding: 8px 12px;
						border-bottom: 1px solid #f1f5f9;
						color: #334155;
					}
					.table tr:last-child td {
						border-bottom: none;
					}
					.table tr:nth-child(even) td {
						background-color: #fdfdfd;
					}
					.message-bubble {
						margin-bottom: 20px;
						padding: 16px 20px;
						border-radius: 16px;
						font-size: 13px;
						line-height: 1.6;
						box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.02);
					}
					.message-user {
						background-color: #e0e7ff;
						border-left: 5px solid #4f46e5;
						color: #1e1b4b;
					}
					.message-model {
						background-color: #f8fafc;
						border: 1px solid #e2e8f0;
						border-left: 5px solid #64748b;
						color: #334155;
					}
					.message-meta {
						font-size: 10px;
						color: #64748b;
						margin-bottom: 8px;
						font-weight: 700;
						text-transform: uppercase;
						letter-spacing: 0.5px;
					}
					.page-break {
						page-break-before: always;
					}
					
					@media print {
						body {
							padding: 20px;
						}
						.metric-card {
							background-color: #f8fafc !important;
							-webkit-print-color-adjust: exact;
							print-color-adjust: exact;
							box-shadow: none !important;
							border: 1px solid #cbd5e1 !important;
						}
						.message-bubble {
							-webkit-print-color-adjust: exact;
							print-color-adjust: exact;
							box-shadow: none !important;
							border: 1px solid #e2e8f0 !important;
						}
						.message-user {
							background-color: #e0e7ff !important;
							border-left: 5px solid #4f46e5 !important;
						}
						.message-model {
							background-color: #f8fafc !important;
							border-left: 5px solid #64748b !important;
						}
					}
				</style>
			</head>
			<body>
				<div class="header">
					<div class="header-top">
						<div>
							<h1>FinanzasPro</h1>
							<p>Reporte de Análisis y Asesoría Financiera IA</p>
						</div>
						<div style="text-align: right;">
							<span style="background-color: #4f46e5; color: white; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
								Asesor Gemini
							</span>
						</div>
					</div>
					<div class="report-info">
						<div><strong>Mes analizado:</strong> ${selectedMonth}</div>
						<div><strong>Vista activa:</strong> ${vistaActiva}</div>
						<div><strong>Liquidación:</strong> ${liquidacionText}</div>
						<div><strong>Generado el:</strong> ${dateStr}</div>
					</div>
				</div>

				${bodyContent || '<p style="text-align: center; color: #64748b; margin-top: 40px; font-style: italic;">Ninguna sección seleccionada para exportar.</p>'}

				<div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 10px; color: #94a3b8;">
					Generado automáticamente por FinanzasPro con tecnología Gemini 3.5.
				</div>
			</body>
			</html>
		`;

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

	const handleExportData = () => {
		try {
			const backupKeys = [
				STORAGE_KEYS.transactions,
				STORAGE_KEYS.debts,
				STORAGE_KEYS.periods,
				STORAGE_KEYS.accounts,
				STORAGE_KEYS.userAName,
				STORAGE_KEYS.userBName,
				STORAGE_KEYS.aiChat,
				STORAGE_KEYS.geminiKey
			] as const;

			const backupData: Record<string, string | null> = {};
			backupKeys.forEach(key => {
				backupData[key] = localStorage.getItem(key);
			});

			const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
			const downloadAnchor = document.createElement('a');
			downloadAnchor.setAttribute('href', jsonString);
			
			const today = new Date();
			const yyyy = today.getFullYear();
			const mm = String(today.getMonth() + 1).padStart(2, '0');
			const dd = String(today.getDate()).padStart(2, '0');
			downloadAnchor.setAttribute('download', `${yyyy}${mm}${dd}-backup-finanzaspro.json`);
			
			document.body.appendChild(downloadAnchor);
			downloadAnchor.click();
			document.body.removeChild(downloadAnchor);
		} catch (err: any) {
			window.alert(`Error al exportar datos: ${err.message}`);
		}
	};

	const handleSetupPassword = async (password: string): Promise<boolean> => {
		setPasswordError('');
		if (password.length < 4) {
			setPasswordError('El PIN debe tener al menos 4 caracteres.');
			return false;
		}
		try {
			const salt = generateSalt();
			const key = await deriveKeyFromPassword(password, salt);
			
			// Cifrar el vector de prueba "valid"
			const checkCiphertext = await encryptWithKey('valid', key);
			
			// Guardar el salt y el vector de prueba en LocalStorage
			const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
			localStorage.setItem('finanzas_v3_password_salt', saltHex);
			localStorage.setItem('finanzas_v3_password_check', checkCiphertext);
			
			// Establecer clave activa en storage
			setCryptoKey(key);
			
			// Cifrar y guardar el estado actual (si existía previamente en texto plano)
			await saveStoredAccounts(accounts);
			await saveStoredTransactions(transactions);
			await saveStoredDebts(debts);
			await saveStoredPeriods(periods);
			await saveGeminiApiKey(geminiApiKey);
			await saveAiChat(chatMessages);
			
			setHasPasswordSet(true);
			setIsLocked(false);
			return true;
		} catch (err: any) {
			setPasswordError(`Error al configurar PIN: ${err.message}`);
			return false;
		}
	};

	const handleUnlock = async (password: string): Promise<boolean> => {
		setPasswordError('');
		const saltHex = localStorage.getItem('finanzas_v3_password_salt');
		const checkCiphertext = localStorage.getItem('finanzas_v3_password_check');
		if (!saltHex || !checkCiphertext) {
			setPasswordError('No se ha configurado un PIN.');
			return false;
		}
		try {
			const bytes = new Uint8Array(saltHex.length / 2);
			for (let i = 0; i < bytes.length; i++) {
				bytes[i] = parseInt(saltHex.substring(i * 2, i * 2 + 2), 16);
			}
			
			const key = await deriveKeyFromPassword(password, bytes);
			const checkText = await decryptWithKey(checkCiphertext, key);
			
			if (checkText === 'valid') {
				setCryptoKey(key);
				
				// Cargar datos cifrados asíncronamente
				const loadedAccounts = await readStoredAccounts();
				const loadedTx = await readStoredTransactions();
				const loadedDebts = await readStoredDebts();
				const loadedPeriods = await readStoredPeriods(loadedTx, loadedDebts);
				const loadedKey = await readGeminiApiKey();
				const loadedChat = await readAiChat();
				
				if (loadedAccounts.length === 0 && (loadedTx.length > 0 || loadedDebts.length > 0)) {
					const userANameVal = localStorage.getItem(STORAGE_KEYS.userAName) || 'Usuario A';
					const userBNameVal = localStorage.getItem(STORAGE_KEYS.userBName) || 'Usuario B';
					const sortedPeriods = [...loadedPeriods].sort((a, b) => a.month.localeCompare(b.month));
					const firstPeriod = sortedPeriods.length > 0 ? sortedPeriods[0] : null;
					const initialBalA = firstPeriod ? (firstPeriod.openingBalanceA !== undefined ? firstPeriod.openingBalanceA : firstPeriod.openingBalance / 2) : 0;
					const initialBalB = firstPeriod ? (firstPeriod.openingBalanceB !== undefined ? firstPeriod.openingBalanceB : firstPeriod.openingBalance / 2) : 0;
					const defaultAccs = [
						{ id: 'default-a', name: `Efectivo ${userANameVal}`, owner: 'userA', initialBalance: initialBalA },
						{ id: 'default-b', name: `Efectivo ${userBNameVal}`, owner: 'userB', initialBalance: initialBalB },
						{ id: 'default-joint', name: 'Cuenta Común', owner: 'joint', initialBalance: 0 }
					];
					setAccounts(defaultAccs);
					await saveStoredAccounts(defaultAccs);
				} else {
					setAccounts(loadedAccounts);
				}
				
				setTransactions(loadedTx);
				setDebts(loadedDebts);
				setPeriods(loadedPeriods);
				setGeminiApiKey(loadedKey);
				setChatMessages(loadedChat);
				
				if (loadedPeriods.length > 0) {
					const sortedP = [...loadedPeriods].sort((a, b) => a.month.localeCompare(b.month));
					const currentMonth = new Date().toISOString().substring(0, 7);
					const exists = sortedP.some((p) => p.month === currentMonth);
					if (exists) {
						setSelectedMonth(currentMonth);
					} else {
						setSelectedMonth(sortedP[sortedP.length - 1].month);
					}
				}
				
				setIsLocked(false);
				return true;
			} else {
				setPasswordError('PIN incorrecto. Vuelve a intentarlo.');
				return false;
			}
		} catch (err) {
			setPasswordError('PIN incorrecto o error al descifrar.');
			return false;
		}
	};

	const handleLockApp = () => {
		setCryptoKey(null);
		setAccounts([]);
		setTransactions([]);
		setDebts([]);
		setPeriods([]);
		setGeminiApiKey('');
		setChatMessages([]);
		setIsLocked(true);
	};

	const handleImportData = async (e: SyntheticEvent<HTMLFormElement>, jsonString: string) => {
		e.preventDefault();
		setImportError('');
		setImportSuccess('');

		if (!jsonString.trim()) {
			setImportError('Introduce un JSON de backup válido.');
			return;
		}

		try {
			const parsed = JSON.parse(jsonString);
			const validated = validateAndSanitizeBackup(parsed);

			if (validated[STORAGE_KEYS.userAName] !== undefined) {
				localStorage.setItem(STORAGE_KEYS.userAName, validated[STORAGE_KEYS.userAName]);
				setUserAName(validated[STORAGE_KEYS.userAName]);
			}
			if (validated[STORAGE_KEYS.userBName] !== undefined) {
				localStorage.setItem(STORAGE_KEYS.userBName, validated[STORAGE_KEYS.userBName]);
				setUserBName(validated[STORAGE_KEYS.userBName]);
			}
			if (validated[STORAGE_KEYS.accounts] !== undefined) {
				await saveStoredAccounts(validated[STORAGE_KEYS.accounts]);
				setAccounts(validated[STORAGE_KEYS.accounts]);
			}
			if (validated[STORAGE_KEYS.transactions] !== undefined) {
				await saveStoredTransactions(validated[STORAGE_KEYS.transactions]);
				setTransactions(validated[STORAGE_KEYS.transactions]);
			}
			if (validated[STORAGE_KEYS.debts] !== undefined) {
				await saveStoredDebts(validated[STORAGE_KEYS.debts]);
				setDebts(validated[STORAGE_KEYS.debts]);
			}
			if (validated[STORAGE_KEYS.periods] !== undefined) {
				await saveStoredPeriods(validated[STORAGE_KEYS.periods]);
				setPeriods(validated[STORAGE_KEYS.periods]);
			} else if (validated[STORAGE_KEYS.transactions] !== undefined && validated[STORAGE_KEYS.debts] !== undefined) {
				const generated = await readStoredPeriods(validated[STORAGE_KEYS.transactions], validated[STORAGE_KEYS.debts]);
				await saveStoredPeriods(generated);
				setPeriods(generated);
			}
			if (validated[STORAGE_KEYS.geminiKey] !== undefined) {
				await saveGeminiApiKey(validated[STORAGE_KEYS.geminiKey]);
				setGeminiApiKey(validated[STORAGE_KEYS.geminiKey]);
			}
			if (validated[STORAGE_KEYS.aiChat] !== undefined) {
				await saveAiChat(validated[STORAGE_KEYS.aiChat]);
				setChatMessages(validated[STORAGE_KEYS.aiChat]);
			}

			const activePeriods = validated[STORAGE_KEYS.periods] || [];
			if (activePeriods.length > 0) {
				const sortedP = [...activePeriods].sort((a, b) => a.month.localeCompare(b.month));
				setSelectedMonth(sortedP[sortedP.length - 1].month);
			}

			setImportSuccess('Datos importados y validados con éxito.');
		} catch (err: any) {
			setImportError(`Error al procesar el backup: ${err.message}`);
		}
	};

	return (
		<FinanzasContext.Provider value={{
			userAName,
			setUserAName,
			userBName,
			setUserBName,
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
		}}>
			{children}
		</FinanzasContext.Provider>
	);
};
