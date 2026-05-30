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

/**
 * Contenido principal de la aplicación, consumiendo el contexto de finanzas.
 */
function MainAppContent() {
	const currentMonthString = new Date().toISOString().substring(0, 7); // "YYYY-MM"

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
		handleSaveEditTransaction
	} = useFinanzas();

	return (
		<div className={`min-h-screen ${activeTab === 'ai' ? 'h-screen overflow-hidden' : ''} flex flex-col bg-slate-950 text-slate-100 font-sans antialiased selection:bg-indigo-500 selection:text-white`}>
			{/* HEADER DE LA APP */}
			<header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-30">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
					<div className="flex items-center space-x-3">
						<div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
							<span className="font-black text-white text-lg">%</span>
						</div>
						<div>
							<h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
								FinanzasPro
							</h1>
							<p className="text-xs text-slate-500">Gestor de Flujo de Caja, Préstamos y Fraccionamientos</p>
						</div>
					</div>

					{/* Selector de Pestañas Principal */}
					<nav className="hidden md:flex bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
						<button
							onClick={() => {
								setActiveTab('overview');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'overview' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Resumen General
						</button>
						<button
							onClick={() => {
								setActiveTab('transactions');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'transactions' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Gastos y Cobros
						</button>
						<button
							onClick={() => {
								setActiveTab('debts');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'debts' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Deudas
						</button>
						<button
							onClick={() => {
								setActiveTab('accounts');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'accounts' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Cuentas
						</button>
						<button
							onClick={() => {
								setActiveTab('consolidation');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
								activeTab === 'consolidation' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							Reunificación
						</button>
						<button
							onClick={() => {
								setActiveTab('ai');
								setSelectedDebtSchedule(null);
							}}
							className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
								activeTab === 'ai' ? 'bg-slate-700 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-white'
							}`}
						>
							<Icons.Sparkles /> Asesor Gemini
						</button>
					</nav>
				</div>
			</header>

			{/* MENÚ MÓVIL RESPONSIVO */}
			<div className="md:hidden flex justify-around bg-slate-900 border-b border-slate-800 p-2 text-xs">
				<button
					onClick={() => setActiveTab('overview')}
					className={`p-2 rounded ${activeTab === 'overview' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Resumen
				</button>
				<button
					onClick={() => setActiveTab('transactions')}
					className={`p-2 rounded ${activeTab === 'transactions' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Movs
				</button>
				<button
					onClick={() => setActiveTab('debts')}
					className={`p-2 rounded ${activeTab === 'debts' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Deudas
				</button>
				<button
					onClick={() => setActiveTab('accounts')}
					className={`p-2 rounded ${activeTab === 'accounts' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Cuentas
				</button>
				<button
					onClick={() => setActiveTab('consolidation')}
					className={`p-2 rounded ${activeTab === 'consolidation' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					Reunificar
				</button>
				<button
					onClick={() => setActiveTab('ai')}
					className={`p-2 rounded flex items-center gap-1 ${activeTab === 'ai' ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}
				>
					<Icons.Sparkles /> IA
				</button>
			</div>

			{/* CUERPO PRINCIPAL */}
			<main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col ${activeTab === 'ai' ? 'min-h-0 overflow-hidden' : ''}`}>
				{periods.length === 0 ? (
					<div className="max-w-md mx-auto my-12 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-8 shadow-2xl">
						<div className="text-center mb-8">
							<div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
								<span className="font-black text-white text-2xl">%</span>
							</div>
							<h2 className="text-2xl font-black bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
								Bienvenido a FinanzasPro
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
					</div>
				) : (
					<>
						{/* BARRA DE CONTROL DE TIEMPO Y BALANCE */}
						<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
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
									className="bg-slate-950 text-slate-100 border border-slate-850 rounded-lg px-3 py-1.5 text-xs font-mono font-bold outline-none focus:border-indigo-500"
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
									className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center shadow-md shadow-indigo-600/10 active:scale-95"
									title="Crear mes siguiente bajo demanda"
								>
									<Icons.Plus /> <span>Siguiente Mes</span>
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
						<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
							{/* Tarjeta: Saldo de Apertura */}
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
								<div className="flex items-center justify-between mb-4">
									<span className="text-sm font-medium text-slate-400">Apertura ({selectedMonth})</span>
									<div className="p-2 bg-indigo-500/10 rounded-lg">
										<svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
										</svg>
									</div>
								</div>
								<div className="text-3xl font-bold text-slate-200">
									{currentOpeningBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-xs text-slate-500 mt-1">Saldo inicial del periodo</p>
							</div>

							{/* Tarjeta: Cobros / Ingresos */}
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
								<div className="flex items-center justify-between mb-4">
									<span className="text-sm font-medium text-slate-400">Ingresos ({selectedMonth})</span>
									<div className="p-2 bg-emerald-500/10 rounded-lg">
										<Icons.TrendingUp />
									</div>
								</div>
								<div className="text-3xl font-bold text-emerald-400">
									+{totalIncomes.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-xs text-slate-500 mt-1">
									{oneOffIncomes > 0 ? (
										`Recurrentes: +${recurringIncomes.toFixed(2)}€ | Puntuales: +${oneOffIncomes.toFixed(2)}€`
									) : (
										'Registrados para este mes'
									)}
								</p>
							</div>

							{/* Tarjeta: Gastos de Flujo Diario */}
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
								<div className="flex items-center justify-between mb-4">
									<span className="text-sm font-medium text-slate-400">Gastos del Mes ({selectedMonth})</span>
									<div className="p-2 bg-rose-500/10 rounded-lg">
										<Icons.TrendingDown />
									</div>
								</div>
								<div className="text-3xl font-bold text-rose-400">
									-{totalExpenses.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-xs text-slate-500 mt-1">
									{oneOffExpenses > 0 ? (
										`Recurrentes: -${recurringExpenses.toFixed(2)}€ | Puntuales: -${oneOffExpenses.toFixed(2)}€`
									) : (
										'Sin contar amortización de deudas'
									)}
								</p>
							</div>

							{/* Tarjeta: Amortización de Deudas (TIN / TAE) */}
							<div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all hover:border-slate-700">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center space-x-1">
										<span className="text-sm font-medium text-slate-400">Pagos de Deuda</span>
										<span title="Préstamos: cuota calculada con TIN/TAE. Fraccionamientos: cuotas pendientes vencidas o exigibles hasta el mes activo.">
											<Icons.Info />
										</span>
									</div>
									<div className="p-2 bg-amber-500/10 rounded-lg">
										<Icons.CreditCard />
									</div>
								</div>
								<div className="text-3xl font-bold text-amber-500">
									-{totalMonthlyDebtPayments.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-xs text-slate-500 mt-1">Incluye cuotas activas y vencidas</p>
							</div>

							{/* Tarjeta: Saldo al Cierre (Acumulado) */}
							<div className={`bg-slate-900 border rounded-2xl p-6 transition-all hover:border-indigo-500/30 shadow-md ${currentClosingBalance >= 0 ? 'border-slate-800 hover:border-indigo-500/50' : 'border-rose-900/50 hover:border-rose-800'}`}>
								<div className="flex items-center justify-between mb-4">
									<span className="text-sm font-medium text-slate-300">Cierre ({selectedMonth})</span>
									<div className="p-2 bg-indigo-500/10 rounded-lg">
										<Icons.Scale />
									</div>
								</div>
								<div className={`text-3xl font-black ${currentClosingBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'}`}>
									{currentClosingBalance.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€
								</div>
								<p className="text-xs text-slate-400 mt-1">
									{currentClosingBalance >= 0 ? 'Saldo neto acumulado positivo' : 'Déficit acumulado al cierre'}
								</p>
							</div>
						</section>

						{/* CONTENIDOS DE PESTAÑAS */}
						{activeTab === 'overview' && <OverviewTab />}
						{activeTab === 'transactions' && <TransactionsTab />}
						{activeTab === 'debts' && <DebtsTab />}
						{activeTab === 'accounts' && <AccountsTab />}
						{activeTab === 'consolidation' && <ConsolidationTab />}
						{activeTab === 'ai' && <AiTab />}
					</>
				)}
			</main>

			{/* FOOTER */}
			{activeTab !== 'ai' && (
				<footer className="border-t border-slate-900 bg-slate-950 py-8 mt-12 text-slate-600 text-center text-xs">
					<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2">
						<p>FinanzasPro © {new Date().getFullYear()} - Herramienta de Planificación Financiera Profesional.</p>
						<p className="text-[10px] text-slate-700">
							Construido bajo SOLID y buenas prácticas. Soporte para pnpm en entornos de desarrollo.
						</p>
					</div>
				</footer>
			)}

			{/* MODAL DE CONFIGURACIÓN DE EXPORTACIÓN PDF */}
			{isExportPdfModalOpen && (
				<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div 
						className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative"
						onClick={(e) => e.stopPropagation()}
					>
						<button 
							onClick={() => setIsExportPdfModalOpen(false)}
							className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
							aria-label="Cerrar modal"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>

						<div className="text-center">
							<div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
								<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
							</div>
							<h2 className="text-xl font-bold text-slate-100">Exportar PDF Personalizado</h2>
							<p className="text-xs text-slate-400 mt-1">
								Selecciona las secciones que deseas incluir en el documento PDF final.
							</p>
						</div>

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
					</div>
				</div>
			)}

			{/* MODAL DE RECONFIGURACIÓN DE CUENTA */}
			{isReconfiguring && (
				<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div 
						className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative"
						onClick={(e) => e.stopPropagation()}
					>
						<button 
							onClick={() => setIsReconfiguring(false)}
							className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
							aria-label="Cerrar modal"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>

						<div className="text-center">
							<div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
								<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</div>
							<h2 className="text-xl font-bold text-slate-100">Configurar Cuenta</h2>
							<p className="text-xs text-slate-400 mt-1">
								Modificá el saldo de apertura, cambiá el mes de inicio o reiniciá la cuenta.
							</p>
						</div>

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
					</div>
				</div>
			)}

			{/* MODAL DE EDICIÓN DE TRANSACCIÓN */}
			{editingTx && (
				<div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div 
						className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative"
						onClick={(e) => e.stopPropagation()}
					>
						<button 
							onClick={() => setEditingTx(null)}
							className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
							aria-label="Cerrar modal"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>

						<div className="text-center">
							<div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
								<Icons.Edit />
							</div>
							<h2 className="text-xl font-bold text-slate-100">Editar Transacción</h2>
							<p className="text-xs text-slate-400 mt-1">
								Modifica los valores del movimiento seleccionado.
							</p>
						</div>

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
					</div>
				</div>
			)}
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
