import React, { useState } from 'react';
import { useFinanzas } from '../hooks/useFinanzas';
import { FinanzasProvider } from '../context/FinanzasContext';
import { Icons } from './common/Icons';
import { OverviewTab } from './dashboard/OverviewTab';
import { TransactionsTab } from './transactions/TransactionsTab';
import { DebtsTab } from './debts/DebtsTab';
import { AccountsTab } from './accounts/AccountsTab';
import { ConsolidationTab } from './consolidation/ConsolidationTab';
import { AiTab } from './ai/AiTab';
import { DEFAULT_TAGS } from '../constants';
import { deduceTagFromConcept } from '../services/financeService';
import { SyncModal } from './sync/SyncModal';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription
} from '@/components/ui/dialog';

/**
 * Contenido principal de la aplicación, consumiendo el contexto de finanzas.
 */
function MainAppContent() {
	const currentMonthString = new Date().toISOString().substring(0, 7); // "YYYY-MM"
	const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

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
		netMonthlyBalance,
		debts,
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
		setEditForm,
		editScope,
		setEditScope,
		handleSaveEditTransaction,
		isLocked,
		hasPasswordSet,
		handleLockApp,
		handleImportData,
		importError,
		importSuccess
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

	if (isLocked) {
		return <LockScreen />;
	}

	return (
		<div className={`min-h-screen ${activeTab === 'ai' ? 'h-screen overflow-hidden' : ''} flex flex-col bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white relative overflow-hidden`}>
			{/* Ambient glows */}
			<div className="bg-glow-indigo top-0 left-1/4" />
			<div className="bg-glow-violet top-1/4 right-1/4" />

			{/* HEADER DE LA APP */}
			<header className="border-b border-slate-900/40 bg-slate-950/20 backdrop-blur-md sticky top-0 z-30">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
					<div className="flex items-center space-x-2.5">
						<svg className="w-5 h-5 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
							<path d="M 4 18 c 2 -4, 4 -7, 8 -7 s 4 5, 8 5 s 3 -10, 4 -12" />
							<path d="M 20 4 h 4 v 4" />
						</svg>
						<span className="font-heading font-light tracking-[0.25em] text-xs uppercase text-slate-100">
							Finanzas <span className="font-bold text-indigo-400">Snake</span>
						</span>
					</div>

					{/* Selector de Pestañas Principal */}
					<nav className="hidden md:flex bg-slate-900/50 backdrop-blur-md p-1 rounded-xl border border-white/5 shadow-inner">
						<button
							onClick={() => {
								setActiveTab('overview');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
								activeTab === 'overview'
									? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-500/10 border border-indigo-500/20'
									: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
							}`}
						>
							Resumen General
						</button>
						<button
							onClick={() => {
								setActiveTab('transactions');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
								activeTab === 'transactions'
									? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-500/10 border border-indigo-500/20'
									: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
							}`}
						>
							Gastos y Cobros
						</button>
						<button
							onClick={() => {
								setActiveTab('debts');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
								activeTab === 'debts'
									? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-500/10 border border-indigo-500/20'
									: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
							}`}
						>
							Deudas
						</button>
						<button
							onClick={() => {
								setActiveTab('accounts');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
								activeTab === 'accounts'
									? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-500/10 border border-indigo-500/20'
									: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
							}`}
						>
							Cuentas
						</button>
						<button
							onClick={() => {
								setActiveTab('consolidation');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
								activeTab === 'consolidation'
									? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-500/10 border border-indigo-500/20'
									: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
							}`}
						>
							Reunificación
						</button>
						<button
							onClick={() => {
								setActiveTab('ai');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-300 flex items-center gap-1 ${
								activeTab === 'ai'
									? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-md shadow-indigo-500/10 border border-indigo-500/20'
									: 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800/30'
							}`}
						>
							<Icons.Sparkles className="w-3.5 h-3.5" /> Asesor Gemini
						</button>
					</nav>
					{hasPasswordSet && (
						<button
							onClick={handleLockApp}
							className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all border border-slate-800 hover:border-rose-500/20 bg-slate-900/80 shadow-md ml-3"
							title="Bloquear Aplicación"
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
							</svg>
						</button>
					)}
				</div>
			</header>

			{/* MENÚ MÓVIL INFERIOR FIJO */}
			<div className="md:hidden fixed bottom-3 left-3 right-3 bg-slate-900/80 backdrop-blur-xl border border-white/10 py-2.5 px-1 flex justify-around items-center z-40 shadow-[0_10px_30px_rgba(0,0,0,0.5)] rounded-2xl">
				<button
					onClick={() => {
						setActiveTab('overview');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'overview' ? 'text-indigo-350 font-bold bg-indigo-500/10 shadow-inner' : 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					<span className="text-[10px]">Resumen</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('transactions');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'transactions' ? 'text-indigo-350 font-bold bg-indigo-500/10 shadow-inner' : 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<span className="text-[10px]">Movs</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('debts');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'debts' ? 'text-indigo-350 font-bold bg-indigo-500/10 shadow-inner' : 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
					</svg>
					<span className="text-[10px]">Deudas</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('accounts');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'accounts' ? 'text-indigo-350 font-bold bg-indigo-500/10 shadow-inner' : 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
					</svg>
					<span className="text-[10px]">Cuentas</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('consolidation');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'consolidation' ? 'text-indigo-350 font-bold bg-indigo-500/10 shadow-inner' : 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
					</svg>
					<span className="text-[10px]">Reunificar</span>
				</button>
				<button
					onClick={() => {
						setActiveTab('ai');
						setSelectedDebtSchedule(null);
					}}
					className={`flex-1 py-1.5 flex flex-col items-center gap-1 transition-all rounded-xl ${
						activeTab === 'ai' ? 'text-indigo-350 font-bold bg-indigo-500/10 shadow-inner' : 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<Icons.Sparkles className="w-5 h-5" />
					<span className="text-[10px]">Asesor</span>
				</button>
			</div>

			{/* CUERPO PRINCIPAL */}
			<main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:py-8 flex flex-col ${activeTab === 'ai' ? 'min-h-0 overflow-hidden' : ''}`}>
				{periods.length === 0 ? (
					<div className="max-w-md mx-auto my-12 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl">
						<div className="text-center mb-8">
							<div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center">
								<svg className="w-10 h-10 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
									<path d="M 4 18 c 2 -4, 4 -7, 8 -7 s 4 5, 8 5 s 3 -10, 4 -12" />
									<path d="M 20 4 h 4 v 4" />
								</svg>
							</div>
							<h2 className="text-xl font-bold text-slate-100 font-heading tracking-wide">
								Bienvenido a Finanzas Snake
							</h2>
							<p className="text-xs text-slate-400 mt-2 leading-relaxed">
								Establecé el inicio de tu cronología y balance para comenzar a planificar tus finanzas.
							</p>
						</div>

						<form onSubmit={handleInitAccount} className="space-y-6">
							<div>
								<label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Flujo de Inicio</label>
								<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
									<button
										type="button"
										onClick={() => {
											setInitFlow('current');
											setInitMonth(currentMonthString);
										}}
										className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
											initFlow === 'current'
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Mes en Curso
									</button>
									<button
										type="button"
										onClick={() => setInitFlow('past')}
										className={`py-2.5 rounded-lg text-xs font-bold transition-all ${
											initFlow === 'past'
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Registrar desde el Pasado
									</button>
								</div>
							</div>

							{initFlow === 'past' ? (
								<div>
									<label htmlFor="init-month-input" className="block text-xs font-medium text-slate-400 mb-1.5">
										Seleccionar Mes de Partida
									</label>
									<input
										id="init-month-input"
										type="month"
										required
										max={currentMonthString}
										value={initMonth}
										onChange={(e) => setInitMonth(e.target.value)}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
									/>
									<p className="text-[10px] text-slate-500 mt-1">
										Vas a poder ingresar transacciones históricas desde este mes seleccionado.
									</p>
								</div>
							) : (
								<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
									<span className="font-semibold text-slate-300">Mes Activo de Inicio:</span> {currentMonthString}
									<p className="text-[10px] text-slate-500 mt-1">
										La cronología arranca directamente en el mes actual del calendario.
									</p>
								</div>
							)}

							<div className="space-y-4 border-t border-slate-800/80 pt-4">
								<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfiles de Usuario</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label htmlFor="user-a-name-input" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userAName || 'Usuario A'}</label>
										<input
											id="user-a-name-input"
											type="text"
											required
											value={userAName}
											onChange={(e) => setUserAName(e.target.value)}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
										/>
									</div>
									<div>
										<label htmlFor="user-b-name-input" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userBName || 'Usuario B'}</label>
										<input
											id="user-b-name-input"
											type="text"
											required
											value={userBName}
											onChange={(e) => setUserBName(e.target.value)}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
										/>
									</div>
								</div>
							</div>

							<div className="space-y-4 border-t border-slate-800/80 pt-4">
								<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Balances de Apertura (€)</h3>
								<div className="space-y-3">
									{accounts.map((acc, index) => (
										<div key={acc.id} className="flex flex-col">
											<label htmlFor={`init-balance-welcome-${acc.id}`} className="block text-[11px] font-medium text-slate-500 mb-1">
												Saldo inicial: {acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
											</label>
											<input
												id={`init-balance-welcome-${acc.id}`}
												type="number"
												step="0.01"
												required
												min="0"
												placeholder="0.00"
												value={acc.initialBalance || ''}
												onChange={(e) => {
													const val = parseFloat(e.target.value) || 0;
													setAccounts((prev) =>
														prev.map((a, i) => (i === index ? { ...a, initialBalance: val } : a))
													);
												}}
												className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
											/>
										</div>
									))}
								</div>
								<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center text-slate-400">
									<span>Total Conjunto:</span>
									<span className="font-bold text-slate-200 text-sm">
										{accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
									</span>
								</div>
							</div>

							<button
								type="submit"
								className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg active:scale-95"
							>
								Inicializar Planificación
							</button>
						</form>

						<div className="relative flex py-4 items-center">
							<div className="flex-grow border-t border-slate-850"></div>
							<span className="flex-shrink mx-4 text-slate-500 text-[10px] uppercase font-bold tracking-wider">O bien</span>
							<div className="flex-grow border-t border-slate-850"></div>
						</div>

						<div className="grid grid-cols-1 gap-3 text-center">
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
									className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition-all active:scale-95 hover:border-indigo-500/30"
								>
									<svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
									</svg>
									Importar Archivo JSON
								</label>
							</div>

							<button
								type="button"
								onClick={() => setIsSyncModalOpen(true)}
								className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-800 bg-slate-950 text-slate-300 hover:text-white text-xs font-semibold transition-all active:scale-95 hover:border-indigo-500/30"
							>
								<svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
								</svg>
								Sincronizar desde Móvil/PC (P2P)
							</button>
						</div>

						{importError && (
							<div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
								<svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
								</svg>
								<span>{importError}</span>
							</div>
						)}
						{importSuccess && (
							<div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-pulse">
								<svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span>{importSuccess}</span>
							</div>
						)}
					</div>
				) : (
					<>
						{/* BARRA DE CONTROL DE TIEMPO Y BALANCE */}
						<div className={`flex-col md:flex-row md:items-center justify-between gap-4 mb-6 p-4 premium-card rounded-2xl ${activeTab === 'ai' ? 'hidden lg:flex' : 'flex'}`}>
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mes Activo:</span>
								<select
									id="global-month-selector"
									value={selectedMonth}
									onChange={(e) => {
										setSelectedMonth(e.target.value);
										setTxForm((prev) => ({ ...prev, date: `${e.target.value}-01` }));
										setDebtForm((prev) => ({ ...prev, date: e.target.value }));
									}}
									className="bg-slate-950/65 text-slate-100 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-bold outline-none focus:border-indigo-500"
								>
									{[...periods]
										.sort((a, b) => a.month.localeCompare(b.month))
										.map((p) => (
											<option key={p.month} value={p.month}>
												{p.month}
											</option>
										))}
								</select>
								<button
									onClick={handleCreateNextMonth}
									className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center shadow-md active:scale-95"
									title="Crear mes siguiente bajo demanda"
								>
									<Icons.Plus className="w-3.5 h-3.5 mr-1" /> <span>Siguiente Mes</span>
								</button>
							</div>

							<div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-center">
								<button
									onClick={() => setViewMode('all')}
									className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
										viewMode === 'all'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									Conjunto
								</button>
								<button
									onClick={() => setViewMode('userA')}
									className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
										viewMode === 'userA'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									{userAName}
								</button>
								<button
									onClick={() => setViewMode('userB')}
									className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
										viewMode === 'userB'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									{userBName}
								</button>
							</div>

							<div>
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
									className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-750 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
								>
									<svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
										<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
									<span>Reconfigurar Cuenta</span>
								</button>
							</div>
						</div>

						{/* INDICADORES FINANCIEROS MENSUALES */}
						<section className={`grid-cols-2 lg:grid-cols-5 gap-2 lg:gap-6 mb-4 lg:mb-8 ${activeTab === 'ai' ? 'hidden lg:grid' : 'grid'}`}>
							{/* Tarjeta: Saldo de Apertura */}
							<div className="premium-card rounded-xl lg:rounded-2xl p-3 lg:p-6">
								<div className="flex items-center justify-between mb-1 lg:mb-4">
									<span className="text-[10px] lg:text-sm font-semibold text-slate-400 truncate">Apertura</span>
									<div className="p-1 lg:p-2 bg-indigo-500/15 rounded-md lg:rounded-lg">
										<svg className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
										</svg>
									</div>
								</div>
								<div className="text-base lg:text-3xl font-extrabold text-slate-100 truncate">
									{currentOpeningBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-[9px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1 hidden lg:block">Saldo inicial del periodo</p>
							</div>

							{/* Tarjeta: Cobros / Ingresos */}
							<div className="premium-card rounded-xl lg:rounded-2xl p-3 lg:p-6">
								<div className="flex items-center justify-between mb-1 lg:mb-4">
									<span className="text-[10px] lg:text-sm font-semibold text-slate-400 truncate">Ingresos</span>
									<div className="p-1 lg:p-2 bg-emerald-500/15 rounded-md lg:rounded-lg">
										<Icons.TrendingUp className="text-emerald-450" />
									</div>
								</div>
								<div className="text-base lg:text-3xl font-extrabold text-emerald-400 truncate">
									+{totalIncomes.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-[9px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1 hidden lg:block">
									{oneOffIncomes > 0 ? (
										`Recurrentes: +${recurringIncomes.toFixed(2)}€ | Puntuales: +${oneOffIncomes.toFixed(2)}€`
									) : (
										'Registrados para este mes'
									)}
								</p>
							</div>

							{/* Tarjeta: Gastos de Flujo Diario */}
							<div className="premium-card rounded-xl lg:rounded-2xl p-3 lg:p-6">
								<div className="flex items-center justify-between mb-1 lg:mb-4">
									<span className="text-[10px] lg:text-sm font-semibold text-slate-400 truncate">Gastos</span>
									<div className="p-1 lg:p-2 bg-rose-500/15 rounded-md lg:rounded-lg">
										<Icons.TrendingDown className="text-rose-450" />
									</div>
								</div>
								<div className="text-base lg:text-3xl font-extrabold text-rose-400 truncate">
									-{totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-[9px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1 hidden lg:block">
									{oneOffExpenses > 0 ? (
										`Recurrentes: -${recurringExpenses.toFixed(2)}€ | Puntuales: -${oneOffExpenses.toFixed(2)}€`
									) : (
										'Sin contar amortización de deudas'
									)}
								</p>
							</div>

							{/* Tarjeta: Amortización de Deudas (TIN / TAE) */}
							<div className="premium-card rounded-xl lg:rounded-2xl p-3 lg:p-6">
								<div className="flex items-center justify-between mb-1 lg:mb-4">
									<div className="flex items-center space-x-1">
										<span className="text-[10px] lg:text-sm font-semibold text-slate-400 truncate">Deuda</span>
										<span className="hidden lg:inline" title="Préstamos: cuota calculada con TIN/TAE. Fraccionamientos: cuotas pendientes vencidas o exigibles hasta el mes activo.">
											<Icons.Info className="text-slate-400" />
										</span>
									</div>
									<div className="p-1 lg:p-2 bg-amber-500/15 rounded-md lg:rounded-lg">
										<Icons.CreditCard className="text-amber-450" />
									</div>
								</div>
								<div className="text-base lg:text-3xl font-extrabold text-amber-500 truncate">
									-{totalMonthlyDebtPayments.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-[9px] lg:text-xs text-slate-500 mt-0.5 lg:mt-1 hidden lg:block">Incluye cuotas activas y vencidas</p>
							</div>

							{/* Tarjeta: Saldo al Cierre (Acumulado) */}
							<div className={`premium-card rounded-xl lg:rounded-2xl p-3 lg:p-6 col-span-2 lg:col-span-1 border ${currentClosingBalance >= 0 ? 'border-indigo-500/10 hover:border-indigo-500/30 shadow-md' : 'border-rose-900/20 hover:border-rose-800/40 shadow-md'}`}>
								<div className="flex items-center justify-between mb-1 lg:mb-4">
									<span className="text-[10px] lg:text-sm font-semibold text-slate-300">Cierre ({selectedMonth})</span>
									<div className="p-1 lg:p-2 bg-indigo-500/15 rounded-md lg:rounded-lg">
										<Icons.Scale className="text-indigo-400" />
									</div>
								</div>
								<div className={`text-lg lg:text-3xl font-black ${currentClosingBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'}`}>
									{currentClosingBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-[9px] lg:text-xs text-slate-400 mt-0.5 lg:mt-1">
									{currentClosingBalance >= 0 ? 'Saldo neto acumulado positivo' : 'Déficit acumulado al cierre'}
								</p>
							</div>
						</section>

						{/* CONTENIDOS DE PESTAÑAS */}
						<div key={activeTab} className="tab-transition flex-1 flex flex-col min-h-0">
							{activeTab === 'overview' && <OverviewTab />}
							{activeTab === 'transactions' && <TransactionsTab />}
							{activeTab === 'debts' && <DebtsTab />}
							{activeTab === 'accounts' && <AccountsTab />}
							{activeTab === 'consolidation' && <ConsolidationTab />}
							{activeTab === 'ai' && <AiTab />}
						</div>
					</>
				)}
			</main>

			{/* FOOTER */}
			{activeTab !== 'ai' && (
				<footer className="border-t border-slate-900 bg-slate-950 py-8 mt-12 text-slate-600 text-center text-xs">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
						<p>Finanzas Snake © {new Date().getFullYear()} - Herramienta de Planificación Financiera Profesional.</p>
						<p className="text-[10px] text-slate-700">
							Construido bajo SOLID y buenas prácticas. Soporte para pnpm en entornos de desarrollo.
						</p>
					</div>
				</footer>
			)}

			{/* MODAL DE CONFIGURACIÓN DE EXPORTACIÓN PDF */}
			<Dialog open={isExportPdfModalOpen} onOpenChange={setIsExportPdfModalOpen}>
				<DialogContent className="max-w-md p-6 sm:p-8">
					<DialogHeader className="text-center">
						<div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
						</div>
						<DialogTitle>Exportar PDF Personalizado</DialogTitle>
						<DialogDescription>
							Selecciona las secciones que deseas incluir en el documento PDF final.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-3">
							{/* Opción 1: Contexto Financiero */}
							<label className="flex items-start gap-3 p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl cursor-pointer transition-all">
								<input 
									type="checkbox"
									checked={pdfExportOptions.showContext}
									onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showContext: e.target.checked })}
									className="mt-1 w-4 h-4 text-indigo-600 border-slate-700 bg-slate-950 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
								/>
								<div>
									<span className="text-sm font-semibold text-slate-200 block">Contexto Financiero de la Vista</span>
									<span className="text-[11px] text-slate-500 leading-relaxed block">
										Resumen de ingresos, gastos, balance y desglose por etiquetas.
									</span>
								</div>
							</label>

							{/* Opción 2: Registro de Deudas */}
							<label className="flex items-start gap-3 p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl cursor-pointer transition-all">
								<input 
									type="checkbox"
									checked={pdfExportOptions.showDebts}
									onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showDebts: e.target.checked })}
									className="mt-1 w-4 h-4 text-indigo-600 border-slate-700 bg-slate-950 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
								/>
								<div>
									<span className="text-sm font-semibold text-slate-200 block">Registro de Deudas del Mes</span>
									<span className="text-[11px] text-slate-500 leading-relaxed block">
										Listado detallado de deudas y cuotas del mes analizado.
									</span>
								</div>
							</label>

							{/* Opción 3: Movimientos Detallados */}
							<label className="flex items-start gap-3 p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl cursor-pointer transition-all">
								<input 
									type="checkbox"
									checked={pdfExportOptions.showTransactions}
									onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showTransactions: e.target.checked })}
									className="mt-1 w-4 h-4 text-indigo-600 border-slate-700 bg-slate-950 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
								/>
								<div>
									<span className="text-sm font-semibold text-slate-200 block">Movimientos Detallados del Mes</span>
									<span className="text-[11px] text-slate-500 leading-relaxed block">
										Historial de ingresos, gastos y transferencias ejecutadas.
									</span>
								</div>
							</label>

							{/* Opción 4: Historial de Chat */}
							<label className="flex items-start gap-3 p-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-xl cursor-pointer transition-all">
								<input 
									type="checkbox"
									checked={pdfExportOptions.showChat}
									onChange={(e) => setPdfExportOptions({ ...pdfExportOptions, showChat: e.target.checked })}
									className="mt-1 w-4 h-4 text-indigo-600 border-slate-700 bg-slate-950 rounded focus:ring-indigo-500 focus:ring-offset-slate-900"
								/>
								<div>
									<span className="text-sm font-semibold text-slate-200 block">Historial de Conversación con el Asesor</span>
									<span className="text-[11px] text-slate-500 leading-relaxed block">
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
								disabled={!pdfExportOptions.showContext && !pdfExportOptions.showDebts && !pdfExportOptions.showTransactions && !pdfExportOptions.showChat}
								className="w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:hover:from-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
							>
								Descargar
							</button>
							<button
								type="button"
								onClick={() => setIsExportPdfModalOpen(false)}
								className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
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
						<div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
								<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
						</div>
						<DialogTitle>Configurar Cuenta</DialogTitle>
						<DialogDescription>
							Modificá el saldo de apertura, cambiá el mes de inicio o reiniciá la cuenta.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleInitAccount} className="space-y-4">
						<div>
							<label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Flujo de Inicio</label>
							<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
								<button
									type="button"
									onClick={() => {
										setInitFlow('current');
										setInitMonth(currentMonthString);
									}}
									className={`py-2 rounded-lg text-xs font-bold transition-all ${
										initFlow === 'current'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									Mes en Curso
								</button>
								<button
									type="button"
									onClick={() => setInitFlow('past')}
									className={`py-2 rounded-lg text-xs font-bold transition-all ${
										initFlow === 'past'
											? 'bg-indigo-600 text-white shadow-md'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									Desde el Pasado
								</button>
							</div>
						</div>

						{initFlow === 'past' ? (
							<div>
								<label htmlFor="modal-init-month" className="block text-xs font-medium text-slate-400 mb-1">
									Mes de Partida
								</label>
								<input
									id="modal-init-month"
									type="month"
									required
									max={currentMonthString}
									value={initMonth}
									onChange={(e) => setInitMonth(e.target.value)}
									className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-slate-100 font-mono outline-none"
								/>
							</div>
						) : (
							<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
								<span className="font-semibold text-slate-300">Mes Activo de Inicio:</span> {currentMonthString}
							</div>
						)}

						<div className="space-y-4 border-t border-slate-800/80 pt-4">
							<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Perfiles de Usuario</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label htmlFor="modal-user-a-name" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userAName || 'Usuario A'}</label>
									<input
										id="modal-user-a-name"
										type="text"
										required
										value={userAName}
										onChange={(e) => setUserAName(e.target.value)}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
									/>
								</div>
								<div>
									<label htmlFor="modal-user-b-name" className="block text-[11px] font-medium text-slate-500 mb-1">Nombre {userBName || 'Usuario B'}</label>
									<input
										id="modal-user-b-name"
										type="text"
										required
										value={userBName}
										onChange={(e) => setUserBName(e.target.value)}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none"
									/>
								</div>
							</div>
						</div>

						<div className="space-y-4 border-t border-slate-800/80 pt-4">
							<h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Balances de Apertura (€)</h3>
							<div className="space-y-3">
								{reconfigAccounts.map((acc, index) => (
									<div key={acc.id} className="flex flex-col">
										<label htmlFor={`init-balance-modal-${acc.id}`} className="block text-[11px] font-medium text-slate-500 mb-1">
											Saldo inicial: {acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
										</label>
										<input
											id={`init-balance-modal-${acc.id}`}
											type="number"
											step="0.01"
											required
											min="0"
											value={acc.initialBalance}
											onChange={(e) => {
												const val = parseFloat(e.target.value) || 0;
												setReconfigAccounts((prev) =>
													prev.map((a, i) => (i === index ? { ...a, initialBalance: val } : a))
												);
											}}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs text-slate-100 outline-none"
										/>
									</div>
								))}
							</div>
							<div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs flex justify-between items-center text-slate-400">
								<span>Total Conjunto:</span>
								<span className="font-bold text-slate-200 text-sm">
									{reconfigAccounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</span>
							</div>
						</div>

						<div className="flex gap-2 pt-2">
							<button
								type="submit"
								className="w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
							>
								Guardar
							</button>
							<button
								type="button"
								onClick={() => setIsReconfiguring(false)}
								className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
							>
								Cancelar
							</button>
						</div>

						<div className="border-t border-slate-800/80 pt-4 mt-2">
							<button
								type="button"
								onClick={handleResetAccount}
								className="w-full bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 hover:text-rose-350 font-bold py-2 rounded-xl text-xs transition-all active:scale-95"
							>
								Reiniciar Base de Datos
							</button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* MODAL DE EDICIÓN DE TRANSACCIÓN */}
			<Dialog open={!!editingTx} onOpenChange={(open) => !open && setEditingTx(null)}>
				<DialogContent className="max-w-md p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
					<DialogHeader className="text-center">
						<div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<Icons.Edit />
						</div>
						<DialogTitle>Editar Transacción</DialogTitle>
						<DialogDescription>
							Modifica los valores del movimiento seleccionado.
						</DialogDescription>
					</DialogHeader>

					{editingTx && (
						<form onSubmit={handleSaveEditTransaction} className="space-y-4">
							<div>
								<label className="block text-xs font-medium text-slate-400 mb-1.5">Tipo de Movimiento</label>
								<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
									<button
										type="button"
										onClick={() => setEditForm({ ...editForm, type: 'expense', tag: DEFAULT_TAGS.expense[0] })}
										className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
											editForm.type === 'expense'
												? 'bg-rose-500 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Gasto
									</button>
									<button
										type="button"
										onClick={() => setEditForm({ ...editForm, type: 'income', tag: DEFAULT_TAGS.income[0] })}
										className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
											editForm.type === 'income'
												? 'bg-emerald-500 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Cobro
									</button>
									<button
										type="button"
										onClick={() => setEditForm({ ...editForm, type: 'transfer', tag: DEFAULT_TAGS.transfer[0] })}
										className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
											editForm.type === 'transfer'
												? 'bg-sky-500 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Traspaso
									</button>
								</div>
							</div>

							<div>
								<label className="block text-xs font-medium text-slate-400 mb-1.5">Recurrencia</label>
								<div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
									<button
										type="button"
										onClick={() => setEditForm({ ...editForm, recurrence: 'one-off' })}
										className={`py-2 rounded-lg text-xs font-semibold transition-all ${
											editForm.recurrence === 'one-off' || !editForm.recurrence
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Puntual
									</button>
									<button
										type="button"
										onClick={() => setEditForm({ ...editForm, recurrence: 'recurring' })}
										className={`py-2 rounded-lg text-xs font-semibold transition-all ${
											editForm.recurrence === 'recurring'
												? 'bg-indigo-600 text-white shadow-md'
												: 'text-slate-400 hover:text-slate-200'
										}`}
									>
										Recurrente
									</button>
								</div>
							</div>

							<div>
								<label htmlFor="edit-desc" className="block text-xs font-medium text-slate-400 mb-1.5">
									Concepto
								</label>
								<input
									id="edit-desc"
									type="text"
									required
									value={editForm.desc}
									onChange={(e) => {
										const desc = e.target.value;
										const deduced = deduceTagFromConcept(desc, editForm.type);
										setEditForm((prev) => ({
											...prev,
											desc,
											tag: deduced || prev.tag
										}));
									}}
									className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600"
								/>
							</div>

							<div>
								<label htmlFor="edit-amount" className="block text-xs font-medium text-slate-400 mb-1.5">
									Importe (€)
								</label>
								<input
									id="edit-amount"
									type="number"
									step="0.01"
									required
									min="0.01"
									value={editForm.amount}
									onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
									className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
								/>
							</div>

							<div>
								<label htmlFor="edit-date" className="block text-xs font-medium text-slate-400 mb-1.5">
									Fecha
								</label>
								<input
									id="edit-date"
									type="date"
									required
									value={editForm.date}
									onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
									className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 font-mono outline-none"
								/>
							</div>

							{editForm.type === 'transfer' ? (
								<>
									<div>
										<label htmlFor="edit-from-account" className="block text-xs font-medium text-slate-400 mb-1.5">
											Cuenta de Origen
										</label>
										<select
											id="edit-from-account"
											value={editForm.fromAccountId}
											onChange={(e) => setEditForm({ ...editForm, fromAccountId: e.target.value })}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
										>
											{accounts.map((acc) => (
												<option key={acc.id} value={acc.id}>
													{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
												</option>
											))}
										</select>
									</div>

									<div>
										<label htmlFor="edit-to-account" className="block text-xs font-medium text-slate-400 mb-1.5">
											Cuenta de Destino
										</label>
										<select
											id="edit-to-account"
											value={editForm.toAccountId}
											onChange={(e) => setEditForm({ ...editForm, toAccountId: e.target.value })}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
										>
											{accounts.filter((acc) => acc.id !== editForm.fromAccountId).map((acc) => (
												<option key={acc.id} value={acc.id}>
													{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
												</option>
											))}
										</select>
									</div>
								</>
							) : (
								<>
									<div>
										<label htmlFor="edit-account" className="block text-xs font-medium text-slate-400 mb-1.5">
											Cuenta Asociada
										</label>
										<select
											id="edit-account"
											value={editForm.accountId}
											onChange={(e) => {
												const accId = e.target.value;
												const acc = accounts.find((a) => a.id === accId);
												setEditForm({
													...editForm,
													accountId: accId,
													owner: acc ? acc.owner : editForm.owner
												});
											}}
											className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none transition-all"
										>
											<option value="">Sin Cuenta (Manual)</option>
											{accounts.map((acc) => (
												<option key={acc.id} value={acc.id}>
													{acc.name} ({acc.owner === 'userA' ? userAName : acc.owner === 'userB' ? userBName : 'Compartida'})
												</option>
											))}
										</select>
									</div>

									<div>
										<label className="block text-xs font-medium text-slate-400 mb-1.5">¿De quién es?</label>
										<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
											<button
												type="button"
												onClick={() => setEditForm({ ...editForm, owner: 'userA' })}
												className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
													editForm.owner === 'userA'
														? 'bg-indigo-600 text-white shadow-md'
														: 'text-slate-400 hover:text-slate-200'
												}`}
											>
												{userAName}
											</button>
											<button
												type="button"
												onClick={() => setEditForm({ ...editForm, owner: 'userB' })}
												className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
													editForm.owner === 'userB'
														? 'bg-indigo-600 text-white shadow-md'
														: 'text-slate-400 hover:text-slate-200'
												}`}
											>
												{userBName}
											</button>
											<button
												type="button"
												onClick={() => setEditForm({ ...editForm, owner: 'joint' })}
												className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
													editForm.owner === 'joint'
														? 'bg-indigo-600 text-white shadow-md'
														: 'text-slate-400 hover:text-slate-200'
												}`}
											>
												Conjunto
											</button>
										</div>
									</div>

									{!editForm.accountId && editForm.owner === 'joint' && editForm.type === 'expense' && (
										<div>
											<label className="block text-xs font-medium text-slate-400 mb-1.5">Pagado por</label>
											<div className="grid grid-cols-3 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
												<button
													type="button"
													onClick={() => setEditForm({ ...editForm, paidBy: 'userA' })}
													className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
														editForm.paidBy === 'userA'
															? 'bg-slate-750 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													{userAName}
												</button>
												<button
													type="button"
													onClick={() => setEditForm({ ...editForm, paidBy: 'userB' })}
													className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
														editForm.paidBy === 'userB'
															? 'bg-slate-750 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													{userBName}
												</button>
												<button
													type="button"
													onClick={() => setEditForm({ ...editForm, paidBy: 'shared' })}
													className={`py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all ${
														editForm.paidBy === 'shared'
															? 'bg-slate-750 text-white shadow-md'
															: 'text-slate-400 hover:text-slate-200'
													}`}
												>
													Común
												</button>
											</div>
										</div>
									)}
								</>
							)}

							<div>
								<label htmlFor="edit-tag" className="block text-xs font-medium text-slate-400 mb-1.5">
									Etiqueta
								</label>
								<input
									id="edit-tag"
									list="edit-tags-list"
									value={editForm.tag}
									onChange={(e) => setEditForm({ ...editForm, tag: e.target.value })}
									placeholder="Elige o escribe una etiqueta"
									className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none"
								/>
								<datalist id="edit-tags-list">
									{DEFAULT_TAGS[editForm.type].map((tag) => (
										<option key={tag} value={tag} />
									))}
								</datalist>
							</div>

							{/* Rango de Edición para recurrentes */}
							{editingTx.recurrence === 'recurring' && (
								<div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
									<label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
										Alcance del cambio recurrente
									</label>
									<div className="space-y-2">
										<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
											<input
												type="radio"
												name="editScope"
												value="only-this"
												checked={editScope === 'only-this'}
												onChange={() => setEditScope('only-this')}
												className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
											/>
											<span>Solo este mes ({selectedMonth})</span>
										</label>
										<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
											<input
												type="radio"
												name="editScope"
												value="future"
												checked={editScope === 'future'}
												onChange={() => setEditScope('future')}
												className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
											/>
											<span>Este y todos los meses futuros</span>
										</label>
										<label className="flex items-center space-x-3 text-xs text-slate-300 cursor-pointer">
											<input
												type="radio"
												name="editScope"
												value="all"
												checked={editScope === 'all'}
												onChange={() => setEditScope('all')}
												className="w-4 h-4 rounded-full border-slate-850 text-indigo-600 focus:ring-0 bg-slate-900"
											/>
											<span>Toda la serie (pasado y futuro)</span>
										</label>
									</div>
								</div>
							)}

							<div className="flex gap-2 pt-2">
								<button
									type="submit"
									className="w-1/2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
								>
									Guardar
								</button>
								<button
									type="button"
									onClick={() => setEditingTx(null)}
									className="w-1/2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
								>
									Cancelar
								</button>
							</div>
						</form>
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
	const {
		hasPasswordSet,
		passwordError,
		setPasswordError,
		handleSetupPassword,
		handleUnlock
	} = useFinanzas();

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
		<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-4 font-sans selection:bg-indigo-500 selection:text-white">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#1e1b4b,transparent_45%)] z-0" />
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,#0f172a,transparent_50%)] z-0" />
			
			<div className="relative z-10 max-w-md w-full bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-indigo-950/20">
				<div className="text-center mb-8">
					<div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
						<svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
					</div>
					<h2 className="text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
						{!hasPasswordSet ? 'Configurar PIN de Acceso' : 'Aplicación Bloqueada'}
					</h2>
					<p className="text-xs text-slate-400 mt-2 leading-relaxed">
						{!hasPasswordSet
							? 'Crea un PIN para cifrar tus datos financieros en este dispositivo. Toda la información se almacenará cifrada localmente con AES-GCM.'
							: 'Introduce tu PIN de seguridad para descifrar y acceder a tus finanzas locales.'}
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-5">
					<div>
						<label htmlFor="pin-input" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
							{!hasPasswordSet ? 'Nuevo PIN (mínimo 4 caracteres)' : 'Introduce tu PIN'}
						</label>
						<input
							id="pin-input"
							type="password"
							required
							autoFocus
							value={pin}
							onChange={(e) => setPin(e.target.value)}
							placeholder="••••"
							className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-white outline-none transition-all placeholder:text-slate-700"
						/>
					</div>

					{!hasPasswordSet && (
						<div>
							<label htmlFor="confirm-pin-input" className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
								Confirmar PIN
							</label>
							<input
								id="confirm-pin-input"
								type="password"
								required
								value={confirmPin}
								onChange={(e) => setConfirmPin(e.target.value)}
								placeholder="••••"
								className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-center text-lg tracking-widest text-white outline-none transition-all placeholder:text-slate-700"
							/>
						</div>
					)}

					{passwordError && (
						<div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs rounded-xl flex items-center gap-2">
							<svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<span>{passwordError}</span>
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50"
					>
						{loading ? 'Procesando...' : !hasPasswordSet ? 'Activar Seguridad Local' : 'Desbloquear'}
					</button>
				</form>
				
				{hasPasswordSet && (
					<p className="text-[10px] text-slate-500 text-center mt-6">
						¿Olvidaste tu PIN? Tus datos están cifrados localmente de forma segura. Si no puedes recordar tu PIN, tendrás que borrar los datos del navegador y restaurar desde una copia de seguridad JSON.
					</p>
				)}
			</div>
		</div>
	);
}
