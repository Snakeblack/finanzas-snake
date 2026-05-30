import { useState, useRef, useEffect, useCallback } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import { Icons } from '../common/Icons';
import { MarkdownRenderer } from '../common/MarkdownRenderer';

/**
 * Componente que renderiza la pestaña del Asesor de Inteligencia Artificial (Gemini AI).
 * Permite configurar la clave API, visualizar estadísticas rápidas incluidas en el contexto
 * y chatear con la IA para obtener recomendaciones financieras.
 */
export function AiTab() {
	const {
		geminiApiKey,
		setGeminiApiKey,
		selectedMonth,
		totalIncomes,
		oneOffIncomes,
		totalExpenses,
		oneOffExpenses,
		totalMonthlyDebtPayments,
		netMonthlyBalance,
		debts,
		chatMessages,
		handleClearChat,
		handleCopyChatPlaintext,
		copiedChat,
		setIsExportPdfModalOpen,
		customQuestion,
		setCustomQuestion,
		handleAskGemini,
		aiLoading,
		aiError
	} = useFinanzas();

	const [activeMobileView, setActiveMobileView] = useState<'chat' | 'config'>('chat');
	const [isAtBottom, setIsAtBottom] = useState(true);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const chatEndRef = useRef<HTMLDivElement>(null);
	const chatContainerRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
		chatEndRef.current?.scrollIntoView({ behavior });
	}, []);

	// Auto-scroll to bottom only when user is near bottom or AI starts/finishes
	useEffect(() => {
		if (isAtBottom) {
			scrollToBottom();
		}
	}, [chatMessages, aiLoading, isAtBottom, scrollToBottom]);

	const handleChatScroll = useCallback(() => {
		const el = chatContainerRef.current;
		if (!el) return;
		const threshold = 80;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
		setIsAtBottom(atBottom);
	}, []);

	const handleTextareaInput = () => {
		const el = textareaRef.current;
		if (el) {
			el.style.height = 'auto';
			el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
		}
	};

	return (
		<div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8 min-h-0 overflow-hidden tab-transition">
			{/* Selector de Vista en Móvil (solo visible si lg:hidden) */}
			<div className="lg:hidden flex bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 mb-2 w-full shrink-0">
				<button
					type="button"
					onClick={() => setActiveMobileView('chat')}
					className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
						activeMobileView === 'chat'
							? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
							: 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<Icons.Sparkles className="w-3.5 h-3.5" />
					<span>Asesor AI</span>
				</button>
				<button
					type="button"
					onClick={() => setActiveMobileView('config')}
					className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
						activeMobileView === 'config'
							? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md'
							: 'text-slate-400 hover:text-slate-200'
					}`}
				>
					<Icons.Lock className="w-3.5 h-3.5" />
					<span>Config / Contexto</span>
				</button>
			</div>

			{/* Panel de Configuración e Información Lateral */}
			<div className={`lg:col-span-4 space-y-6 overflow-y-auto lg:h-full pr-1 flex-1 min-h-0 ${activeMobileView === 'config' ? 'block' : 'hidden lg:block'}`}>
				{/* Configuración de API Key */}
				<div className="premium-card rounded-2xl p-6">
					<h3 className="text-base font-bold text-slate-200 mb-2 flex items-center">
						<span className="p-1 bg-slate-800/60 rounded mr-2">
							<Icons.Lock />
						</span>
						Credenciales de Gemini
					</h3>
					<p className="text-xs text-slate-400 mb-4 font-normal">
						Introduce tu API Key de Google Gemini para habilitar el motor de análisis y recibir consejos
						estructurados en tiempo real.
					</p>

					<div className="space-y-3">
						<input
							type="password"
							placeholder="Al pegar tu AI_KEY se guardará localmente"
							value={geminiApiKey}
							onChange={(e) => setGeminiApiKey(e.target.value)}
							className="w-full premium-input focus:border-indigo-500 rounded-xl px-4 py-2 text-sm text-slate-100 font-mono outline-none"
						/>
						{geminiApiKey ? (
							<span className="text-[10px] text-emerald-400 font-semibold block">
								✓ API Key configurada localmente.
							</span>
						) : (
							<span className="text-[10px] text-amber-500 font-semibold block">
								⚠ Falta la API Key para procesar consultas.
							</span>
						)}
					</div>
				</div>

				{/* Resumen del Contexto Financiero del Mes */}
				<div className="premium-card rounded-2xl p-6 space-y-4">
					<h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
						<svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
						Contexto del Mes ({selectedMonth})
					</h3>
					<p className="text-xs text-slate-400 leading-relaxed font-normal">
						Los siguientes datos son incluidos automáticamente en la consulta de fondo para contextualizar la conversación:
					</p>
					<div className="space-y-2 text-xs border-t border-slate-800/40 pt-3">
						<div className="flex justify-between">
							<span className="text-slate-500">Ingresos Totales:</span>
							<span className="font-semibold text-emerald-400 font-mono">
								{totalIncomes.toFixed(2)}€
								{oneOffIncomes > 0 && ` (Puntual: ${oneOffIncomes.toFixed(2)}€)`}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-slate-500">Gastos Totales:</span>
							<span className="font-semibold text-rose-450 font-mono">
								-{totalExpenses.toFixed(2)}€
								{oneOffExpenses > 0 && ` (Puntual: -${oneOffExpenses.toFixed(2)}€)`}
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-slate-500">Pagos de Deudas:</span>
							<span className="font-semibold text-amber-500 font-mono">-{totalMonthlyDebtPayments.toFixed(2)}€</span>
						</div>
						<div className="flex justify-between border-t border-slate-800/40 pt-2 font-semibold">
							<span className="text-slate-400">Balance Neto:</span>
							<span className={`font-mono ${netMonthlyBalance >= 0 ? 'text-indigo-400' : 'text-rose-500'}`}>
								{netMonthlyBalance.toFixed(2)}€
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-slate-500">Deudas Registradas:</span>
							<span className="font-semibold text-slate-300">{debts.length}</span>
						</div>
					</div>
				</div>

				{/* Acciones Adicionales */}
				{chatMessages.length > 0 && (
					<div className="premium-card rounded-2xl p-6">
						<h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">Opciones de Conversación</h3>
						<button
							onClick={handleClearChat}
							className="w-full py-2 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 hover:border-rose-900/50 text-rose-400 hover:text-rose-350 font-semibold rounded-xl text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
						>
							<Icons.Trash />
							<span>Borrar Historial</span>
						</button>
					</div>
				)}
			</div>

			{/* Ventana de Chat */}
			<div className={`lg:col-span-8 premium-card rounded-2xl flex flex-col overflow-hidden lg:h-full flex-1 min-h-0 ${activeMobileView === 'chat' ? 'flex' : 'hidden lg:flex'}`}>
				{/* Cabecera del Chat */}
				<div className="p-4 bg-slate-950/40 border-b border-slate-800/40 flex justify-between items-center shrink-0">
					<div>
						<h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
							<Icons.Sparkles />
							Asesor Gemini
						</h3>
						<p className="text-[10px] text-slate-500">
							Análisis financiero avanzado en base a tus movimientos y deudas
						</p>
					</div>
					<div className="flex items-center gap-2">
						{chatMessages.length > 0 && (
							<>
								<button
									onClick={handleCopyChatPlaintext}
									className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
									title="Copiar chat como texto plano"
								>
									<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
									</svg>
									<span>{copiedChat ? '¡Copiado!' : 'Copiar'}</span>
								</button>
								<button
									onClick={() => setIsExportPdfModalOpen(true)}
									className="px-2.5 py-1 text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg border border-indigo-500 transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
									title="Descargar conversación como PDF"
								>
									<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
									</svg>
									<span>PDF</span>
								</button>
							</>
						)}
						<span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
							Contexto Activo
						</span>
					</div>
				</div>

				{/* Barra rápida de Contexto en Móvil (solo visible en móvil/tablet si el chat está activo) */}
				<div className="lg:hidden flex flex-wrap gap-2 px-4 py-2 bg-slate-950/20 border-b border-slate-800/30 shrink-0">
					<button
						type="button"
						onClick={() => setActiveMobileView('config')}
						className={`px-3 py-1 rounded-full text-[10px] font-semibold border flex items-center gap-1.5 transition-all ${
							geminiApiKey
								? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
								: 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
						}`}
						title="Ver configuración de API Key"
					>
						<span className={`w-1.5 h-1.5 rounded-full ${geminiApiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
						<span>API Key</span>
					</button>
					<div className="px-3 py-1 rounded-full text-[10px] font-semibold bg-slate-900/60 border border-slate-850 text-slate-300 flex items-center gap-1.5">
						<span className="text-slate-500">Balance:</span>
						<span className={netMonthlyBalance >= 0 ? 'text-indigo-400 font-mono' : 'text-rose-450 font-mono'}>
							{netMonthlyBalance.toFixed(2)}€
						</span>
					</div>
					<div className="px-3 py-1 rounded-full text-[10px] font-semibold bg-slate-900/60 border border-slate-850 text-slate-300 flex items-center gap-1.5">
						<span className="text-slate-500">Deudas:</span>
						<span className="font-semibold font-mono">{debts.length}</span>
					</div>
				</div>

				{/* Cuerpo del Chat */}
				{chatMessages.length === 0 ? (
					<div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 space-y-4 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
						<div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-md">
							<Icons.Sparkles />
						</div>
						<div>
							<p className="text-sm font-bold text-slate-300">Comienza a planificar tu mes</p>
							<p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
								Pregúntame sobre tu balance del mes, recomendaciones de ahorro, o el impacto de tus deudas y simulaciones.
							</p>
						</div>
						<div className="flex flex-wrap gap-2 justify-center max-w-md pt-2">
							{[
								'¿Cómo está mi salud financiera este mes?',
								'¿Tengo deudas con alto coste de intereses?',
								'¿Cómo puedo recortar gastos comunes?',
								'Analiza la reunificación de deudas propuesta.'
							].map((q) => (
								<button
									key={q}
									onClick={() => {
										setCustomQuestion(q);
										handleAskGemini(q);
									}}
									disabled={aiLoading}
									className="px-3 py-1.5 glass-panel hover:border-indigo-500/30 text-slate-350 hover:text-white rounded-lg text-[11px] font-medium transition-all text-left shadow-sm active:scale-95"
								>
									{q}
								</button>
							))}
						</div>
					</div>
				) : (
					<div className="flex-1 relative min-h-0">
						<div
							ref={chatContainerRef}
							onScroll={handleChatScroll}
							className="absolute inset-0 overflow-y-auto p-4 space-y-4 bg-slate-950/20"
							style={{ WebkitOverflowScrolling: 'touch' }}
						>
							{chatMessages.map((msg, idx) => (
								<div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
									<div className="flex items-center space-x-1.5 mb-1.5">
										<span className="text-[10px] text-slate-400 font-bold font-heading">
											{msg.role === 'user' ? 'Tú' : 'Asesor Gemini'}
										</span>
										<span className="text-[9px] text-slate-500 font-mono">({msg.timestamp})</span>
									</div>
									<div
										className={`p-3.5 rounded-2xl text-sm leading-relaxed max-w-[85%] ${
											msg.role === 'user'
												? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-tr-none shadow-lg shadow-indigo-500/10'
												: 'glass-panel text-slate-200 rounded-tl-none shadow-sm'
										}`}
									>
										{msg.role === 'user' ? (
											<div className="whitespace-pre-wrap">{msg.content}</div>
										) : (
											<MarkdownRenderer text={msg.content} />
										)}
									</div>
								</div>
							))}
							{aiLoading && (
								<div className="flex flex-col items-start">
									<div className="flex items-center space-x-1.5 mb-1.5">
										<span className="text-[10px] text-slate-400 font-bold">Asesor Gemini</span>
										<span className="text-[9px] text-indigo-400 animate-pulse font-medium">escribiendo...</span>
									</div>
									<div className="glass-panel p-4 rounded-2xl rounded-tl-none text-sm text-slate-400 shadow-md flex items-center space-x-2">
										<svg className="animate-spin h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}></circle>
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										<span className="animate-pulse">Analizando flujo de caja...</span>
									</div>
								</div>
							)}
							{aiError && (
								<div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs rounded-xl">
									{aiError}
								</div>
							)}
							<div ref={chatEndRef} />
						</div>

						{/* Scroll to bottom FAB */}
						{!isAtBottom && (
							<button
								type="button"
								onClick={() => scrollToBottom()}
								className="absolute bottom-3 right-3 z-10 w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center transition-all active:scale-90 animate-in fade-in"
								title="Ir al final"
							>
								<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
								</svg>
							</button>
						)}
					</div>
				)}

				{/* Formulario de Input al pie */}
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleAskGemini(customQuestion);
					}}
					className="p-3 bg-slate-950/40 border-t border-slate-800/40 flex gap-2 items-end shrink-0"
				>
					<textarea
						ref={textareaRef}
						rows={1}
						value={customQuestion}
						onChange={(e) => {
							setCustomQuestion(e.target.value);
							handleTextareaInput();
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								handleAskGemini(customQuestion);
								// Reset textarea height after send
								if (textareaRef.current) textareaRef.current.style.height = 'auto';
							}
						}}
						placeholder={geminiApiKey ? "Escribe tu consulta sobre finanzas..." : "Configura tu API Key para empezar"}
						disabled={!geminiApiKey}
						className="flex-1 premium-input focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 outline-none resize-none placeholder:text-slate-500 max-h-32 overflow-y-auto disabled:opacity-40 disabled:cursor-not-allowed"
					/>
					<button
						type="submit"
						disabled={aiLoading || !customQuestion.trim() || !geminiApiKey}
						className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-indigo-600/10"
					>
						<Icons.Sparkles />
						<span className="hidden sm:inline">Enviar</span>
					</button>
				</form>
			</div>
		</div>
	);
}
