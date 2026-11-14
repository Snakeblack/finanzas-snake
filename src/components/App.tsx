import type React from 'react';
import { useCallback, useState } from 'react';
import { useFinanzas } from '../hooks/useFinanzas';
import { FinanzasProvider } from '../context/FinanzasContext';
import { Icons } from './common/Icons';
import { OverviewTab } from './dashboard/OverviewTab';
import { TransactionsTab } from './transactions/TransactionsTab';
import { DebtsTab } from './debts/DebtsTab';
import { AccountsTab } from './accounts/AccountsTab';
import { ConsolidationTab } from './consolidation/ConsolidationTab';
import { AiTab } from './ai/AiTab';
import { SyncModal } from './sync/SyncModal';
import { EditTransactionForm } from './transactions/EditTransactionForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { parseOpeningBalanceInput } from '../utils/openingBalance';

/**
 * Contenido principal de la aplicación, consumiendo el contexto de finanzas.
 */
function MainAppContent() {
	const currentMonthString = new Date().toISOString().substring(0, 7); // "YYYY-MM"
	const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
	const [openStatementImportSignal, setOpenStatementImportSignal] = useState(0);

	// La señal se resetea en cuanto TransactionsTab la consume: el subtree de pestañas se
	// remonta con key={activeTab}, por lo que sin este reset el modal volvería a abrirse solo
	// en cada visita posterior a la pestaña de Transacciones.
	const handleImportModalConsumed = useCallback(() => setOpenStatementImportSignal(0), []);

	const {
		activeTab,
		setActiveTab,
		selectedMonth,
		setSelectedMonth,
		viewMode,
		setViewMode,
		userAName,
		setUserAName,
		userBName,
		setUserBName,
		accounts,
		setAccounts,
		periods,
		currentOpeningBalance,
		totalIncomes,
		oneOffIncomes,
		recurringIncomes,
		totalExpenses,
		oneOffExpenses,
		recurringExpenses,
		totalMonthlyDebtPayments,
		currentClosingBalance,
		setSelectedDebtSchedule,
		setTxForm,
		setDebtForm,
		handleCreateNextMonth,
		handleInitAccount,
		handleResetAccount,
		isReconfiguring,
		setIsReconfiguring,
		reconfigAccounts,
		setReconfigAccounts,
		initFlow,
		setInitFlow,
		initMonth,
		setInitMonth,
		isExportPdfModalOpen,
		setIsExportPdfModalOpen,
		pdfExportOptions,
		setPdfExportOptions,
		handleDownloadChatPDF,
		editingTx,
		setEditingTx,
		editForm,
		editScope,
		setEditScope,
		handleSaveEditTransaction,
		isLocked,
		isInitialized,
		hasPasswordSet,
		handleLockApp,
		handleImportData,
		importError,
		importSuccess,
		hideSensitiveData,
		toggleSensitiveData,
		formatAmount,
		theme,
		toggleTheme,
		profileCount,
		setProfileCount
	} = useFinanzas();

	// Adaptador para el input del archivo JSON de copia de seguridad
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const jsonString = event.target?.result as string;
			const fakeEvent = {
				preventDefault: () => {}
			} as React.SyntheticEvent<HTMLFormElement>;
			handleImportData(fakeEvent, jsonString);
		};
		reader.readAsText(file);
	};

	const handleOnboardingSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
		const nextAction = submitter?.value;

		handleInitAccount(e);

		if (nextAction === 'accounts') {
			setActiveTab('accounts');
			return;
		}

		if (nextAction === 'statement-import') {
			setActiveTab('transactions');
			setOpenStatementImportSignal((signal) => signal + 1);
		}
	};

	if (isLocked) {
		return <LockScreen />;
	}

	if (!isInitialized) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 font-sans">
				<div className="relative z-10 max-w-md w-full flex flex-col items-center text-center">
					<div className="w-12 h-12 mb-4 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
						<svg className="w-6 h-6 text-foreground animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								className="opacity-20"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="3"
							/>
							<path
								className="opacity-80"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
					</div>
					<h3 className="text-lg font-semibold text-foreground">
						Cargando Finanzas Snake
					</h3>
					<p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
						Cargando tus datos financieros locales...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className={`min-h-screen ${activeTab === 'ai' ? 'h-screen overflow-hidden' : activeTab === 'transactions' ? 'lg:h-screen lg:overflow-hidden' : ''} flex flex-col bg-background text-foreground font-sans antialiased relative`}
		>
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-foreground focus:text-xs focus:font-semibold focus:shadow-lg"
			>
				Saltar al contenido
			</a>

			{/* HEADER DE LA APP */}
			<header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-30">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
					<div className="flex items-center gap-3 shrink-0">
						<div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center shadow-sm">
							<svg
								className="w-4 h-4 text-foreground shrink-0"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth={2}
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M 4 18 c 2 -4, 4 -7, 8 -7 s 4 5, 8 5 s 3 -10, 4 -12" />
								<path d="M 20 4 h 4 v 4" />
							</svg>
						</div>
						<div className="flex flex-col">
							<span className="font-heading font-semibold text-sm tracking-tight text-foreground leading-none">
								Finanzas <span className="font-bold">Snake</span>
							</span>
							<span className="text-[10px] text-muted-foreground hidden sm:inline mt-0.5">
								Planificación local-first
							</span>
						</div>
					</div>

					{/* Selector de Pestañas Principal */}
					<nav
						aria-label="Navegación principal"
						className="hidden md:flex items-center bg-muted/70 p-1 rounded-xl border border-border gap-0.5"
					>
						<button
							onClick={() => {
								setActiveTab('overview');
								setSelectedDebtSchedule(null);
							}}
							aria-current={activeTab === 'overview' ? 'page' : undefined}
							className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
								activeTab === 'overview'
									? 'bg-card text-foreground shadow-sm border border-border/80 font-semibold'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/40'
							}`}
						>
							Resumen General
						</button>
						<button
							onClick={() => {
								setActiveTab('transactions');
								setSelectedDebtSchedule(null);
							}}
							aria-current={activeTab === 'transactions' ? 'page' : undefined}
							className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
								activeTab === 'transactions'
									? 'bg-card text-foreground shadow-sm border border-border/80 font-semibold'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/40'
							}`}
						>
							Gastos e Ingresos
						</button>
						<button
							onClick={() => {
								setActiveTab('debts');
								setSelectedDebtSchedule(null);
							}}
							aria-current={activeTab === 'debts' ? 'page' : undefined}
							className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
								activeTab === 'debts'
									? 'bg-card text-foreground shadow-sm border border-border/80 font-semibold'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/40'
							}`}
						>
							Deudas
						</button>
						<button
							onClick={() => {
								setActiveTab('accounts');
								setSelectedDebtSchedule(null);
							}}
							aria-current={activeTab === 'accounts' ? 'page' : undefined}
							className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
								activeTab === 'accounts'
									? 'bg-card text-foreground shadow-sm border border-border/80 font-semibold'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/40'
							}`}
						>
							Cuentas
						</button>
						<button
							onClick={() => {
								setActiveTab('consolidation');
								setSelectedDebtSchedule(null);
							}}
							aria-current={activeTab === 'consolidation' ? 'page' : undefined}
							className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
								activeTab === 'consolidation'
									? 'bg-card text-foreground shadow-sm border border-border/80 font-semibold'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/40'
							}`}
						>
							Reunificación
						</button>
						<button
							onClick={() => {
								setActiveTab('ai');
								setSelectedDebtSchedule(null);
							}}
							aria-current={activeTab === 'ai' ? 'page' : undefined}
							className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
								activeTab === 'ai'
									? 'bg-card text-foreground shadow-sm border border-border/80 font-semibold'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/40'
							}`}
						>
							<Icons.Sparkles className="w-3.5 h-3.5 text-foreground" /> Asesor Gemini
						</button>
					</nav>

					<div className="flex items-center gap-2 ml-auto md:ml-0 shrink-0">
						<button
							onClick={toggleTheme}
							aria-label={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
							className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
							title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
						>
							{theme === 'light' ? (
								<svg
									className="w-4 h-4 text-foreground"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<circle cx="12" cy="12" r="4" />
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.31 11.31l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41m14.14-14.14l-1.41 1.41"
									/>
								</svg>
							) : (
								<svg
									className="w-4 h-4 text-foreground"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
									/>
								</svg>
							)}
						</button>

						<button
							onClick={toggleSensitiveData}
							aria-label={hideSensitiveData ? 'Mostrar datos sensibles' : 'Ocultar datos sensibles'}
							className={`h-9 w-9 rounded-lg border border-border transition-colors flex items-center justify-center ${
								hideSensitiveData
									? 'bg-primary text-primary-foreground border-primary'
									: 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground'
							}`}
							title={hideSensitiveData ? 'Mostrar datos sensibles' : 'Ocultar datos sensibles'}
						>
							{hideSensitiveData ? (
								<Icons.EyeOff className="w-4 h-4" />
							) : (
								<Icons.Eye className="w-4 h-4" />
							)}
						</button>
						<button
							onClick={handleLockApp}
							aria-label={hasPasswordSet ? 'Bloquear Aplicación' : 'Configurar PIN de Seguridad'}
							className="h-9 w-9 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
							title={hasPasswordSet ? 'Bloquear Aplicación' : 'Configurar PIN de Seguridad'}
						>
							{hasPasswordSet ? (
								<svg
									className="w-4 h-4 text-foreground"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
									/>
								</svg>
							) : (
								<svg
									className="w-4 h-4 text-muted-foreground hover:text-foreground"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
									/>
								</svg>
							)}
						</button>
					</div>
				</div>
			</header>

			{/* MENÚ MÓVIL INFERIOR FIJO */}
			<nav
				aria-label="Navegación móvil"
				className="md:hidden fixed bottom-3 left-3 right-3 bg-card/95 backdrop-blur-md border border-border py-1.5 px-1.5 flex justify-around items-center z-40 shadow-lg rounded-2xl"
			>
				<button
					onClick={() => {
						setActiveTab('overview');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'overview'
							? 'text-foreground font-semibold bg-muted shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
						/>
					</svg>
					<span className="text-[10px] leading-none">Resumen</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('transactions');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'transactions'
							? 'text-foreground font-semibold bg-muted shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span className="text-[10px] leading-none">Movs</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('debts');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'debts'
							? 'text-foreground font-semibold bg-muted shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
						/>
					</svg>
					<span className="text-[10px] leading-none">Deudas</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('accounts');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'accounts'
							? 'text-foreground font-semibold bg-muted shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
					<span className="text-[10px] leading-none">Cuentas</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('consolidation');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'consolidation'
							? 'text-foreground font-semibold bg-muted shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
						/>
					</svg>
					<span className="text-[10px] leading-none">Reunificar</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('ai');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-2 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'ai'
							? 'text-foreground font-semibold bg-muted shadow-sm'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					<Icons.Sparkles className="w-4 h-4" />
					<span className="text-[10px] leading-none">Asesor</span>
				</button>
			</nav>

			{/* CUERPO PRINCIPAL */}
			<main
				id="main-content"
				className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 md:py-6 flex flex-col ${activeTab === 'ai' ? 'min-h-0 overflow-hidden' : activeTab === 'transactions' ? 'lg:min-h-0 lg:overflow-hidden' : ''}`}
			>
				{periods.length === 0 ? (
					<div className="max-w-3xl w-full mx-auto my-6 lg:my-10 premium-card rounded-2xl p-6 sm:p-8 lg:p-10">
						<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-border">
							<div className="flex items-center gap-3.5">
								<div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
									<svg
										className="w-6 h-6 text-foreground"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth={1.75}
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M 4 18 c 2 -4, 4 -7, 8 -7 s 4 5, 8 5 s 3 -10, 4 -12" />
										<path d="M 20 4 h 4 v 4" />
									</svg>
								</div>
								<div>
									<h2 className="text-xl font-bold text-foreground font-heading tracking-tight">
										Bienvenido a Finanzas Snake
									</h2>
									<p className="text-xs text-muted-foreground mt-1 leading-relaxed">
										Establecé el inicio de tu cronología y balance para comenzar a planificar tus finanzas.
									</p>
								</div>
							</div>
						</div>

						<form onSubmit={handleOnboardingSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
							{/* Columna Izquierda: Cronología y Perfiles */}
							<div className="lg:col-span-7 space-y-6">
								<div>
									<label className="block text-xs font-medium text-muted-foreground mb-2">
										Flujo de Inicio
									</label>
									<div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border border-border">
										<button
											type="button"
											onClick={() => {
												setInitFlow('current');
												setInitMonth(currentMonthString);
											}}
											className={`py-2.5 rounded-lg text-xs font-medium transition-all ${
												initFlow === 'current'
													? 'bg-card text-foreground shadow-sm font-semibold'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											Mes en Curso
										</button>
										<button
											type="button"
											onClick={() => setInitFlow('past')}
											className={`py-2.5 rounded-lg text-xs font-medium transition-all ${
												initFlow === 'past'
													? 'bg-card text-foreground shadow-sm font-semibold'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											Registrar desde el Pasado
										</button>
									</div>
								</div>

								{initFlow === 'past' ? (
									<div>
										<label
											htmlFor="init-month-input"
											className="block text-xs font-medium text-muted-foreground mb-1.5"
										>
											Seleccionar Mes de Partida
										</label>
										<Input
											id="init-month-input"
											type="month"
											required
											max={currentMonthString}
											value={initMonth}
											onChange={(e) => setInitMonth(e.target.value)}
											className="font-mono"
										/>
										<p className="text-[11px] text-muted-foreground mt-1.5">
											Vas a poder ingresar transacciones históricas desde este mes seleccionado.
										</p>
									</div>
								) : (
									<div className="p-3.5 bg-muted/50 border border-border rounded-xl text-xs text-foreground">
										<div className="flex items-center justify-between">
											<span className="font-medium text-muted-foreground">Mes Activo de Inicio:</span>
											<span className="font-mono font-semibold text-foreground">{currentMonthString}</span>
										</div>
										<p className="text-[11px] text-muted-foreground mt-1">
											La cronología arranca directamente en el mes actual del calendario.
										</p>
									</div>
								)}

								<div className="space-y-3 border-t border-border pt-5">
									<label className="block text-xs font-medium text-muted-foreground">
										Número de Perfiles
									</label>
									<div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl border border-border">
										<button
											type="button"
											onClick={() => setProfileCount(1)}
											className={`py-2.5 rounded-lg text-xs font-medium transition-all ${
												profileCount === 1
													? 'bg-card text-foreground shadow-sm font-semibold'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											1 Perfil (Individual)
										</button>
										<button
											type="button"
											onClick={() => setProfileCount(2)}
											className={`py-2.5 rounded-lg text-xs font-medium transition-all ${
												profileCount === 2
													? 'bg-card text-foreground shadow-sm font-semibold'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											2 Perfiles (Pareja/Conjunto)
										</button>
									</div>
								</div>

								<div className="space-y-3 border-t border-border pt-5">
									<h3 className="text-xs font-semibold text-foreground">
										Perfiles de Usuario
									</h3>
									<div className={`grid ${profileCount === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'} gap-3`}>
										<div>
											<label
												htmlFor="user-a-name-input"
												className="block text-[11px] font-medium text-muted-foreground mb-1.5"
											>
												Nombre {userAName || 'Usuario A'}
											</label>
											<Input
												id="user-a-name-input"
												type="text"
												required
												value={userAName}
												onChange={(e) => setUserAName(e.target.value)}
											/>
										</div>
										{profileCount === 2 && (
											<div>
												<label
													htmlFor="user-b-name-input"
													className="block text-[11px] font-medium text-muted-foreground mb-1.5"
												>
													Nombre {userBName || 'Usuario B'}
												</label>
												<Input
													id="user-b-name-input"
													type="text"
													required
													value={userBName}
													onChange={(e) => setUserBName(e.target.value)}
												/>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Columna Derecha: Saldos Iniciales y Acciones */}
							<div className="lg:col-span-5 flex flex-col justify-between space-y-6 lg:border-l lg:border-border lg:pl-8">
								<div className="space-y-3">
									<h3 className="text-xs font-semibold text-foreground">
										Balances de Apertura (€)
									</h3>
									<div className="space-y-3">
										{accounts
											.filter((acc) => profileCount === 2 || acc.owner === 'userA')
											.map((acc) => (
												<div key={acc.id} className="flex flex-col">
													<label
														htmlFor={`init-balance-welcome-${acc.id}`}
														className="block text-[11px] font-medium text-muted-foreground mb-1.5"
													>
														Saldo inicial: {acc.name} (
														{acc.owner === 'userA'
															? userAName
															: acc.owner === 'userB'
																? userBName
																: 'Compartida'}
														)
													</label>
													<Input
														id={`init-balance-welcome-${acc.id}`}
														type="number"
														step="0.01"
														min="0"
														placeholder="0.00"
														value={acc.initialBalance || ''}
														onChange={(e) => {
															const val = parseOpeningBalanceInput(e.target.value);
															if (Number.isNaN(val)) return;
															setAccounts((prev) =>
																prev.map((a) =>
																	a.id === acc.id ? { ...a, initialBalance: val } : a
																)
															);
														}}
														className="font-mono"
													/>
												</div>
											))}
									</div>
									<div className="p-3.5 bg-muted/50 border border-border rounded-xl text-xs flex justify-between items-center text-foreground">
										<span className="text-muted-foreground font-medium">
											Total {profileCount === 1 ? 'Individual' : 'Conjunto'}:
										</span>
										<span className="font-semibold text-foreground text-sm font-mono">
											{accounts
												.filter((acc) => profileCount === 2 || acc.owner === 'userA')
												.reduce((sum, a) => sum + (a.initialBalance || 0), 0)
												.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
											€
										</span>
									</div>
								</div>

								<div className="space-y-2.5 pt-2">
									<button
										type="submit"
										name="onboarding-action"
										value="overview"
										className="w-full bg-primary text-primary-foreground hover:opacity-90 font-semibold py-2.5 px-4 rounded-xl text-sm transition-all shadow-sm"
									>
										Inicializar Planificación
									</button>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
										<button
											type="submit"
											name="onboarding-action"
											value="accounts"
											className="w-full border border-border bg-background hover:bg-muted text-foreground font-medium py-2.5 px-3 rounded-xl text-xs transition-all"
										>
											Configurar cuentas
										</button>
										<button
											type="submit"
											name="onboarding-action"
											value="statement-import"
											className="w-full border border-border bg-secondary hover:opacity-90 text-secondary-foreground font-medium py-2.5 px-3 rounded-xl text-xs transition-all"
										>
											Importar PDF/CSV por cuenta
										</button>
									</div>
								</div>
							</div>
						</form>

						<div className="relative flex py-5 items-center">
							<div className="flex-grow border-t border-border"></div>
							<span className="flex-shrink mx-4 text-muted-foreground text-xs font-medium">
								O restaurar desde respaldo existente
							</span>
							<div className="flex-grow border-t border-border"></div>
						</div>

						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
							<div>
								<input
									id="welcome-import-backup-file"
									type="file"
									accept=".json"
									onChange={handleFileChange}
									className="hidden"
								/>
								<label
									htmlFor="welcome-import-backup-file"
									className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-xs font-medium cursor-pointer transition-colors"
								>
									<svg
										className="w-4 h-4 text-muted-foreground"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12"
										/>
									</svg>
									Importar Archivo JSON
								</label>
							</div>

							<button
								type="button"
								onClick={() => setIsSyncModalOpen(true)}
								className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground hover:bg-muted text-xs font-medium transition-colors"
							>
								<svg
									className="w-4 h-4 text-muted-foreground"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
									/>
								</svg>
								Sincronizar desde Móvil/PC (P2P)
							</button>
						</div>

						{importError && (
							<div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center gap-2">
								<svg
									className="w-4 h-4 shrink-0"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
								<span>{importError}</span>
							</div>
						)}
						{importSuccess && (
							<div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2">
								<svg
									className="w-4 h-4 shrink-0"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
									strokeWidth={2}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								<span>{importSuccess}</span>
							</div>
						)}
					</div>
				) : (
					<>
						{/* BARRA DE CONTROL DE TIEMPO Y CONTEXTO */}
						<div className="flex flex-wrap items-center justify-between gap-2.5 mb-4 p-2.5 sm:px-4 bg-card border border-border rounded-xl shadow-sm shrink-0">
							<div className="flex items-center gap-2 shrink-0">
								<span className="text-xs font-medium text-muted-foreground hidden sm:inline">
									Periodo:
								</span>
								<Select
									value={selectedMonth}
									onValueChange={(val) => {
										setSelectedMonth(val);
										setTxForm((prev) => ({ ...prev, date: `${val}-01` }));
										setDebtForm((prev) => ({ ...prev, date: val }));
									}}
								>
									<SelectTrigger
										id="global-month-selector"
										className="bg-input text-foreground border border-border rounded-lg px-3 py-1.5 text-xs font-mono font-semibold outline-none focus:ring-2 focus:ring-ring/20 cursor-pointer w-auto h-9 min-w-[110px]"
										aria-label="Seleccionar mes"
									>
										<SelectValue placeholder="Mes" />
									</SelectTrigger>
									<SelectContent>
										{[...periods]
											.sort((a, b) => a.month.localeCompare(b.month))
											.map((p) => (
												<SelectItem key={p.month} value={p.month} className="font-mono">
													{p.month}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
								<button
									onClick={handleCreateNextMonth}
									className="h-9 px-2.5 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs font-medium"
									title="Crear mes siguiente bajo demanda"
								>
									<svg
										className="w-3.5 h-3.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
									</svg>
									<span className="hidden md:inline">Siguiente mes</span>
								</button>
							</div>

							<div className="flex items-center gap-2.5 ml-auto">
								{profileCount === 2 && (
									<div className="flex bg-muted/70 p-1 rounded-lg border border-border">
										<button
											onClick={() => setViewMode('all')}
											className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
												viewMode === 'all'
													? 'bg-card text-foreground shadow-sm font-semibold'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											<span className="hidden sm:inline">Conjunto</span>
											<span className="sm:hidden">Conj.</span>
										</button>
										<button
											onClick={() => setViewMode('userA')}
											className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
												viewMode === 'userA'
													? 'bg-card text-foreground shadow-sm font-semibold'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											<span className="hidden sm:inline">{userAName}</span>
											<span className="sm:hidden">{userAName ? userAName.substring(0, 3) : 'A'}</span>
										</button>
										<button
											onClick={() => setViewMode('userB')}
											className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
												viewMode === 'userB'
													? 'bg-card text-foreground shadow-sm font-semibold'
													: 'text-muted-foreground hover:text-foreground'
											}`}
										>
											<span className="hidden sm:inline">{userBName}</span>
											<span className="sm:hidden">{userBName ? userBName.substring(0, 3) : 'B'}</span>
										</button>
									</div>
								)}

								<button
									onClick={() => {
										const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
										if (sorted.length > 0) {
											setInitMonth(sorted[0].month);
											setInitFlow(sorted[0].month === currentMonthString ? 'current' : 'past');
										}
										setReconfigAccounts(accounts.map((acc) => ({ ...acc })));
										setIsReconfiguring(true);
									}}
									className="h-9 px-3 bg-background hover:bg-muted text-foreground border border-border rounded-lg transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0"
									title="Reconfigurar Cuenta"
								>
									<svg
										className="w-3.5 h-3.5 text-muted-foreground shrink-0"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										strokeWidth={2}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
										/>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
									</svg>
									<span className="hidden sm:inline">Configurar</span>
								</button>
							</div>
						</div>

						{/* INDICADORES FINANCIEROS MENSUALES: Tarjetas completas en Resumen General, cinta compacta en pestañas operativas */}
						{activeTab === 'overview' ? (
							<section className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-6 shrink-0">
								{/* Tarjeta: Saldo de Apertura */}
								<div className="premium-card rounded-xl p-4 lg:p-5 flex flex-col justify-between">
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs font-medium text-muted-foreground truncate">
											Apertura
										</span>
										<div className="p-1.5 bg-muted rounded-md text-foreground">
											<svg
												className="w-3.5 h-3.5 text-muted-foreground"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth={2}
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20"
												/>
											</svg>
										</div>
									</div>
									<div>
										<div className="text-lg lg:text-2xl font-semibold text-foreground font-mono tracking-tight truncate">
											{formatAmount(currentOpeningBalance)}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1 hidden lg:block">
											Saldo inicial del periodo
										</p>
									</div>
								</div>

								{/* Tarjeta: Ingresos */}
								<div className="premium-card rounded-xl p-4 lg:p-5 flex flex-col justify-between">
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs font-medium text-muted-foreground truncate">
											Ingresos
										</span>
										<div className="p-1.5 bg-emerald-500/10 rounded-md text-emerald-600 dark:text-emerald-400">
											<Icons.TrendingUp className="w-3.5 h-3.5" />
										</div>
									</div>
									<div>
										<div className="text-lg lg:text-2xl font-semibold text-emerald-600 dark:text-emerald-400 font-mono tracking-tight truncate">
											{formatAmount(totalIncomes, { showSign: true })}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1 hidden lg:block truncate">
											{oneOffIncomes > 0
												? `Fijos: ${formatAmount(recurringIncomes, { showSign: true })} · Puntuales: ${formatAmount(oneOffIncomes, { showSign: true })}`
												: 'Registrados para este mes'}
										</p>
									</div>
								</div>

								{/* Tarjeta: Gastos de Flujo Diario */}
								<div className="premium-card rounded-xl p-4 lg:p-5 flex flex-col justify-between">
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs font-medium text-muted-foreground truncate">
											Gastos
										</span>
										<div className="p-1.5 bg-rose-500/10 rounded-md text-rose-600 dark:text-rose-400">
											<Icons.TrendingDown className="w-3.5 h-3.5" />
										</div>
									</div>
									<div>
										<div className="text-lg lg:text-2xl font-semibold text-rose-600 dark:text-rose-400 font-mono tracking-tight truncate">
											{formatAmount(-totalExpenses)}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1 hidden lg:block truncate">
											{oneOffExpenses > 0
												? `Fijos: ${formatAmount(-recurringExpenses)} · Puntuales: ${formatAmount(-oneOffExpenses)}`
												: 'Sin contar amortización de deudas'}
										</p>
									</div>
								</div>

								{/* Tarjeta: Amortización de Deudas */}
								<div className="premium-card rounded-xl p-4 lg:p-5 flex flex-col justify-between">
									<div className="flex items-center justify-between mb-2">
										<div className="flex items-center space-x-1">
											<span className="text-xs font-medium text-muted-foreground truncate">
												Deuda
											</span>
											<span
												className="hidden lg:inline"
												title="Préstamos: cuota calculada con TIN/TAE/CER más costes recurrentes/seguros. Fraccionamientos: cuotas pendientes vencidas o exigibles hasta el mes activo."
											>
												<Icons.Info className="text-muted-foreground" />
											</span>
										</div>
										<div className="p-1.5 bg-amber-500/10 rounded-md text-amber-600 dark:text-amber-400">
											<Icons.CreditCard className="w-3.5 h-3.5" />
										</div>
									</div>
									<div>
										<div className="text-lg lg:text-2xl font-semibold text-amber-600 dark:text-amber-400 font-mono tracking-tight truncate">
											{formatAmount(-totalMonthlyDebtPayments)}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1 hidden lg:block">
											Incluye cuotas activas y vencidas
										</p>
									</div>
								</div>

								{/* Tarjeta: Saldo al Cierre (Acumulado) */}
								<div
									className={`premium-card rounded-xl p-4 lg:p-5 col-span-2 lg:col-span-1 flex flex-col justify-between ${
										currentClosingBalance >= 0
											? 'bg-muted/30 border-foreground/20'
											: 'border-rose-500/40 bg-rose-500/5'
									}`}
								>
									<div className="flex items-center justify-between mb-2">
										<span className="text-xs font-semibold text-foreground">
											Cierre ({selectedMonth})
										</span>
										<div className="p-1.5 bg-muted rounded-md text-foreground">
											<Icons.Scale className="w-3.5 h-3.5 text-foreground" />
										</div>
									</div>
									<div>
										<div
											className={`text-xl lg:text-2xl font-bold font-mono tracking-tight truncate ${
												currentClosingBalance >= 0
													? 'text-foreground'
													: 'text-rose-600 dark:text-rose-400'
											}`}
										>
											{formatAmount(currentClosingBalance)}
										</div>
										<p className="text-[11px] text-muted-foreground mt-1">
											{currentClosingBalance >= 0
												? 'Saldo neto acumulado positivo'
												: 'Déficit acumulado al cierre'}
										</p>
									</div>
								</div>
							</section>
						) : (
							<section
								aria-label="Resumen financiero del mes"
								className="hidden lg:grid lg:grid-cols-5 gap-3 mb-4 p-3 bg-card/70 border border-border rounded-xl shrink-0"
							>
								<div className="flex items-center justify-between px-3 py-1 border-r border-border last:border-r-0">
									<span className="text-xs text-muted-foreground font-medium">Apertura</span>
									<span className="text-xs font-semibold font-mono text-foreground">
										{formatAmount(currentOpeningBalance)}
									</span>
								</div>
								<div className="flex items-center justify-between px-3 py-1 border-r border-border last:border-r-0">
									<span className="text-xs text-muted-foreground font-medium">Ingresos</span>
									<span className="text-xs font-semibold font-mono text-emerald-600 dark:text-emerald-400">
										{formatAmount(totalIncomes, { showSign: true })}
									</span>
								</div>
								<div className="flex items-center justify-between px-3 py-1 border-r border-border last:border-r-0">
									<span className="text-xs text-muted-foreground font-medium">Gastos</span>
									<span className="text-xs font-semibold font-mono text-rose-600 dark:text-rose-400">
										{formatAmount(-totalExpenses)}
									</span>
								</div>
								<div className="flex items-center justify-between px-3 py-1 border-r border-border last:border-r-0">
									<span className="text-xs text-muted-foreground font-medium">Deuda</span>
									<span className="text-xs font-semibold font-mono text-amber-600 dark:text-amber-400">
										{formatAmount(-totalMonthlyDebtPayments)}
									</span>
								</div>
								<div className="flex items-center justify-between px-3 py-1">
									<span className="text-xs text-foreground font-semibold">
										Cierre ({selectedMonth})
									</span>
									<span
										className={`text-sm font-bold font-mono ${
											currentClosingBalance >= 0
												? 'text-foreground'
												: 'text-rose-600 dark:text-rose-400'
										}`}
									>
										{formatAmount(currentClosingBalance)}
									</span>
								</div>
							</section>
						)}

						{/* CONTENIDOS DE PESTAÑAS */}
						<div key={activeTab} className="tab-transition flex-1 flex flex-col min-h-0">
							{activeTab === 'overview' && <OverviewTab />}
							{activeTab === 'transactions' && (
								<TransactionsTab
									openImportModalSignal={openStatementImportSignal}
									onImportModalConsumed={handleImportModalConsumed}
								/>
							)}
							{activeTab === 'debts' && <DebtsTab />}
							{activeTab === 'accounts' && <AccountsTab />}
							{activeTab === 'consolidation' && <ConsolidationTab />}
							{activeTab === 'ai' && <AiTab />}
						</div>
					</>
				)}
			</main>

			{/* FOOTER */}
			{activeTab !== 'ai' && activeTab !== 'transactions' && (
				<footer className="border-t border-border bg-background py-4 mt-8 text-center text-xs text-muted-foreground">
					<div className="max-w-7xl mx-auto px-4">Finanzas Snake © {new Date().getFullYear()}</div>
				</footer>
			)}

			{/* MODAL DE CONFIGURACIÓN DE EXPORTACIÓN PDF */}
			<Dialog open={isExportPdfModalOpen} onOpenChange={setIsExportPdfModalOpen}>
				<DialogContent className="max-w-md p-6 sm:p-8">
					<DialogHeader className="text-center">
						<div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-muted text-foreground flex items-center justify-center border border-border">
							<svg
								className="w-6 h-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
						<DialogTitle>Exportar PDF personalizado</DialogTitle>
						<DialogDescription>
							Selecciona las secciones que deseas incluir en el documento PDF final.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-3">
							{/* Opción 1: Contexto Financiero */}
							<label className="flex items-start gap-3 p-3 bg-card hover:bg-muted/40 border border-border rounded-lg cursor-pointer transition-all">
								<input
									type="checkbox"
									checked={pdfExportOptions.showContext}
									onChange={(e) =>
										setPdfExportOptions({ ...pdfExportOptions, showContext: e.target.checked })
									}
									className="mt-1 w-4 h-4 text-primary border-border bg-background rounded focus:ring-ring"
								/>
								<div>
									<span className="text-sm font-medium text-foreground block">
										Contexto financiero de la vista
									</span>
									<span className="text-[11px] text-muted-foreground leading-relaxed block">
										Resumen de ingresos, gastos, balance y desglose por categorías.
									</span>
								</div>
							</label>

							{/* Opción 2: Registro de Deudas */}
							<label className="flex items-start gap-3 p-3 bg-card hover:bg-muted/40 border border-border rounded-lg cursor-pointer transition-all">
								<input
									type="checkbox"
									checked={pdfExportOptions.showDebts}
									onChange={(e) =>
										setPdfExportOptions({ ...pdfExportOptions, showDebts: e.target.checked })
									}
									className="mt-1 w-4 h-4 text-primary border-border bg-background rounded focus:ring-ring"
								/>
								<div>
									<span className="text-sm font-medium text-foreground block">
										Registro de deudas del mes
									</span>
									<span className="text-[11px] text-muted-foreground leading-relaxed block">
										Listado detallado de deudas y cuotas del mes analizado.
									</span>
								</div>
							</label>

							{/* Opción 3: Movimientos Detallados */}
							<label className="flex items-start gap-3 p-3 bg-card hover:bg-muted/40 border border-border rounded-lg cursor-pointer transition-all">
								<input
									type="checkbox"
									checked={pdfExportOptions.showTransactions}
									onChange={(e) =>
										setPdfExportOptions({ ...pdfExportOptions, showTransactions: e.target.checked })
									}
									className="mt-1 w-4 h-4 text-primary border-border bg-background rounded focus:ring-ring"
								/>
								<div>
									<span className="text-sm font-medium text-foreground block">
										Movimientos detallados del mes
									</span>
									<span className="text-[11px] text-muted-foreground leading-relaxed block">
										Historial de ingresos, gastos y transferencias ejecutadas.
									</span>
								</div>
							</label>

							{/* Opción 4: Historial de Chat */}
							<label className="flex items-start gap-3 p-3 bg-card hover:bg-muted/40 border border-border rounded-lg cursor-pointer transition-all">
								<input
									type="checkbox"
									checked={pdfExportOptions.showChat}
									onChange={(e) =>
										setPdfExportOptions({ ...pdfExportOptions, showChat: e.target.checked })
									}
									className="mt-1 w-4 h-4 text-primary border-border bg-background rounded focus:ring-ring"
								/>
								<div>
									<span className="text-sm font-medium text-foreground block">
										Historial de conversación con el asesor
									</span>
									<span className="text-[11px] text-muted-foreground leading-relaxed block">
										Mensajes del chat interactivo formateados.
									</span>
								</div>
							</label>
						</div>

						{/* Botones de Acción */}
						<div className="flex gap-2 pt-2">
							<button
								type="button"
								onClick={() => {
									handleDownloadChatPDF(pdfExportOptions);
									setIsExportPdfModalOpen(false);
								}}
								disabled={
									!pdfExportOptions.showContext &&
									!pdfExportOptions.showDebts &&
									!pdfExportOptions.showTransactions &&
									!pdfExportOptions.showChat
								}
								className="w-1/2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 font-medium py-2.5 rounded-lg text-xs transition-all active:scale-[0.98]"
							>
								Descargar
							</button>
							<button
								type="button"
								onClick={() => setIsExportPdfModalOpen(false)}
								className="w-1/2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2.5 rounded-lg text-xs transition-all"
							>
								Cancelar
							</button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* MODAL DE RECONFIGURACIÓN DE CUENTA */}
			<Dialog open={isReconfiguring} onOpenChange={setIsReconfiguring}>
				<DialogContent className="max-w-md p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
					<DialogHeader className="text-center">
						<div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-muted text-foreground flex items-center justify-center border border-border">
							<svg
								className="w-6 h-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
								/>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
						</div>
						<DialogTitle>Configurar cuenta</DialogTitle>
						<DialogDescription>
							Modifica el saldo de apertura, cambia el mes de inicio o reinicia la cuenta.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleInitAccount} className="space-y-4">
						<div>
							<label className="block text-xs font-medium text-muted-foreground mb-1.5">
								Flujo de inicio
							</label>
							<div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/40 rounded-lg border border-border">
								<button
									type="button"
									onClick={() => {
										setInitFlow('current');
										setInitMonth(currentMonthString);
									}}
									className={`py-2 rounded-md text-xs font-medium transition-all ${
										initFlow === 'current'
											? 'bg-background text-foreground shadow-sm font-semibold'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									Mes en curso
								</button>
								<button
									type="button"
									onClick={() => setInitFlow('past')}
									className={`py-2 rounded-md text-xs font-medium transition-all ${
										initFlow === 'past'
											? 'bg-background text-foreground shadow-sm font-semibold'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									Desde el pasado
								</button>
							</div>
						</div>

						{initFlow === 'past' ? (
							<div>
								<label
									htmlFor="modal-init-month"
									className="block text-xs font-medium text-muted-foreground mb-1"
								>
									Mes de partida
								</label>
								<Input
									id="modal-init-month"
									type="month"
									required
									max={currentMonthString}
									value={initMonth}
									onChange={(e) => setInitMonth(e.target.value)}
									className="px-3 py-2 text-sm font-mono"
								/>
							</div>
						) : (
							<div className="p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
								<span className="font-medium text-foreground">Mes activo de inicio:</span>{' '}
								{currentMonthString}
							</div>
						)}

						<div className="space-y-4 border-t border-border pt-4">
							<label className="block text-xs font-medium text-muted-foreground mb-1.5">
								Número de perfiles
							</label>
							<div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/40 rounded-lg border border-border">
								<button
									type="button"
									onClick={() => setProfileCount(1)}
									className={`py-2 rounded-md text-xs font-medium transition-all ${
										profileCount === 1
											? 'bg-background text-foreground shadow-sm font-semibold'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									1 Perfil (Individual)
								</button>
								<button
									type="button"
									onClick={() => setProfileCount(2)}
									className={`py-2 rounded-md text-xs font-medium transition-all ${
										profileCount === 2
											? 'bg-background text-foreground shadow-sm font-semibold'
											: 'text-muted-foreground hover:text-foreground'
									}`}
								>
									2 Perfiles (Pareja/Conjunto)
								</button>
							</div>
						</div>

						<div className="space-y-4 border-t border-border pt-4">
							<h3 className="text-xs font-medium text-muted-foreground">
								Perfiles de usuario
							</h3>
							<div className={`grid ${profileCount === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
								<div>
									<label
										htmlFor="modal-user-a-name"
										className="block text-[11px] font-medium text-muted-foreground mb-1"
									>
										Nombre {userAName || 'Usuario A'}
									</label>
									<Input
										id="modal-user-a-name"
										type="text"
										required
										value={userAName}
										onChange={(e) => setUserAName(e.target.value)}
										className="px-3 py-2 text-xs"
									/>
								</div>
								{profileCount === 2 && (
									<div>
										<label
											htmlFor="modal-user-b-name"
											className="block text-[11px] font-medium text-muted-foreground mb-1"
										>
											Nombre {userBName || 'Usuario B'}
										</label>
										<Input
											id="modal-user-b-name"
											type="text"
											required
											value={userBName}
											onChange={(e) => setUserBName(e.target.value)}
											className="px-3 py-2 text-xs"
										/>
									</div>
								)}
							</div>
						</div>

						<div className="space-y-4 border-t border-border pt-4">
							<h3 className="text-xs font-medium text-muted-foreground">
								Balances de apertura (€)
							</h3>
							<div className="space-y-3">
								{reconfigAccounts
									.filter((acc) => profileCount === 2 || acc.owner === 'userA')
									.map((acc) => (
										<div key={acc.id} className="flex flex-col">
											<label
												htmlFor={`init-balance-modal-${acc.id}`}
												className="block text-[11px] font-medium text-muted-foreground mb-1"
											>
												Saldo inicial: {acc.name} (
												{acc.owner === 'userA'
													? userAName
													: acc.owner === 'userB'
														? userBName
														: 'Compartida'}
												)
											</label>
											<Input
												id={`init-balance-modal-${acc.id}`}
												type="number"
												step="0.01"
												min="0"
												value={acc.initialBalance}
												onChange={(e) => {
													const val = parseOpeningBalanceInput(e.target.value);
													if (Number.isNaN(val)) return;
													setReconfigAccounts((prev) =>
														prev.map((a) =>
															a.id === acc.id ? { ...a, initialBalance: val } : a
														)
													);
												}}
												className="px-3 py-2.5 text-xs"
											/>
										</div>
									))}
							</div>
							<div className="p-3 bg-muted/40 border border-border rounded-lg text-xs flex justify-between items-center text-muted-foreground">
								<span>Total {profileCount === 1 ? 'individual' : 'conjunto'}:</span>
								<span className="font-semibold text-foreground text-sm">
									{reconfigAccounts
										.filter((acc) => profileCount === 2 || acc.owner === 'userA')
										.reduce((sum, a) => sum + (a.initialBalance || 0), 0)
										.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
									€
								</span>
							</div>
						</div>

						<div className="flex gap-2 pt-2">
							<button
								type="submit"
								className="w-1/2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-lg text-xs transition-all active:scale-[0.98]"
							>
								Guardar
							</button>
							<button
								type="button"
								onClick={() => setIsReconfiguring(false)}
								className="w-1/2 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-medium py-2.5 rounded-lg text-xs transition-all"
							>
								Cancelar
							</button>
						</div>

						<div className="border-t border-border pt-4 mt-2">
							<button
								type="button"
								onClick={handleResetAccount}
								className="w-full bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive font-medium py-2 rounded-lg text-xs transition-all active:scale-[0.98]"
							>
								Reiniciar base de datos
							</button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* MODAL DE EDICIÓN DE TRANSACCIÓN */}
			<Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
				<DialogContent className="max-w-md p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
					<DialogHeader className="text-center">
						<div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-muted text-foreground flex items-center justify-center border border-border">
							<Icons.Edit />
						</div>
						<DialogTitle>Editar transacción</DialogTitle>
						<DialogDescription>Modifica los valores del movimiento seleccionado.</DialogDescription>
					</DialogHeader>

					{editingTx && (
						<EditTransactionForm
							editingTx={editingTx}
							accounts={accounts}
							userAName={userAName}
							userBName={userBName}
							initialEditForm={editForm}
							editScope={editScope}
							setEditScope={setEditScope}
							onSave={handleSaveEditTransaction}
							onCancel={() => setEditingTx(null)}
						/>
					)}
				</DialogContent>
			</Dialog>

			<SyncModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} />
		</div>
	);
}

export default function App() {
	return (
		<FinanzasProvider>
			<MainAppContent />
		</FinanzasProvider>
	);
}

/**
 * Pantalla de bloqueo / Registro de PIN
 */
function LockScreen() {
	const { hasPasswordSet, passwordError, setPasswordError, handleSetupPassword, handleUnlock } = useFinanzas();

	const [pin, setPin] = useState('');
	const [confirmPin, setConfirmPin] = useState('');
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setPasswordError('');
		setLoading(true);

		if (!hasPasswordSet) {
			if (pin !== confirmPin) {
				setPasswordError('Los PINs no coinciden.');
				setLoading(false);
				return;
			}
			const success = await handleSetupPassword(pin);
			if (success) {
				setPin('');
				setConfirmPin('');
			}
		} else {
			const success = await handleUnlock(pin);
			if (success) {
				setPin('');
			}
		}
		setLoading(false);
	};

	return (
		<div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4 font-sans">
			<div className="relative z-10 max-w-md w-full bg-card border border-border rounded-xl p-8 shadow-sm">
				<div className="text-center mb-8">
					<div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-muted text-foreground flex items-center justify-center border border-border">
						<svg
							className="w-7 h-7"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
							/>
						</svg>
					</div>
					<h2 className="text-xl font-bold tracking-tight text-foreground">
						{!hasPasswordSet ? 'Configurar PIN de acceso' : 'Aplicación bloqueada'}
					</h2>
					<p className="text-xs text-muted-foreground mt-2 leading-relaxed">
						{!hasPasswordSet
							? 'Crea un PIN para cifrar tus datos financieros en este dispositivo. Toda la información se almacenará cifrada localmente con AES-GCM.'
							: 'Introduce tu PIN de seguridad para descifrar y acceder a tus finanzas locales.'}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						<label
							htmlFor="pin-input"
							className="block text-xs font-medium text-muted-foreground mb-1.5"
						>
							{!hasPasswordSet ? 'Nuevo PIN (mínimo 4 caracteres)' : 'Introduce tu PIN'}
						</label>
						<Input
							id="pin-input"
							type="password"
							required
							autoFocus
							value={pin}
							onChange={(e) => setPin(e.target.value)}
							placeholder="••••"
							className="py-3 text-center text-lg tracking-widest text-foreground placeholder:text-muted-foreground"
						/>
					</div>

					{!hasPasswordSet && (
						<div>
							<label
								htmlFor="confirm-pin-input"
								className="block text-xs font-medium text-muted-foreground mb-1.5"
							>
								Confirmar PIN
							</label>
							<Input
								id="confirm-pin-input"
								type="password"
								required
								value={confirmPin}
								onChange={(e) => setConfirmPin(e.target.value)}
								placeholder="••••"
								className="py-3 text-center text-lg tracking-widest text-foreground placeholder:text-muted-foreground"
							/>
						</div>
					)}

					{passwordError && (
						<div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg flex items-center gap-2">
							<svg
								className="w-4 h-4 shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							<span>{passwordError}</span>
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3 rounded-lg text-sm transition-all active:scale-[0.98] disabled:opacity-50"
					>
						{loading ? 'Procesando...' : !hasPasswordSet ? 'Activar seguridad local' : 'Desbloquear'}
					</button>
				</form>

				{hasPasswordSet && (
					<p className="text-[11px] text-muted-foreground text-center mt-6 leading-relaxed">
						¿Olvidaste tu PIN? Tus datos están cifrados localmente de forma segura. Si no puedes recordar tu
						PIN, tendrás que borrar los datos del navegador y restaurar desde una copia de seguridad JSON.
					</p>
				)}
			</div>
		</div>
	);
}
