import React, { useState, useEffect, useRef } from 'react';
import { useFinanzas } from '../../hooks/useFinanzas';
import { startSyncHost, connectToSyncHost, SyncData } from '../../services/syncService';
import { validateAndSanitizeBackup } from '../../utils/backupValidator';
import { STORAGE_KEYS } from '../../constants';
import {
	saveStoredAccounts,
	saveStoredTransactions,
	saveStoredDebts,
	saveStoredPeriods,
	saveGeminiApiKey,
	saveAiChat
} from '../../services/storageService';

interface SyncModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type SyncMode = 'select' | 'send' | 'receive';
type SyncStatus = 'idle' | 'connecting' | 'connected' | 'completed' | 'error';

export function SyncModal({ isOpen, onClose }: SyncModalProps) {
	const {
		setUserAName,
		setUserBName,
		setAccounts,
		setTransactions,
		setDebts,
		setPeriods,
		setGeminiApiKey,
		setChatMessages,
		setSelectedMonth
	} = useFinanzas();

	const [mode, setMode] = useState<SyncMode>('select');
	const [status, setStatus] = useState<SyncStatus>('idle');
	const [statusText, setStatusText] = useState('');
	const [code, setCode] = useState('');
	const [inputCode, setInputCode] = useState('');
	const [errorMsg, setErrorMsg] = useState('');

	const hostSessionRef = useRef<{ destroy: () => void } | null>(null);
	const clientSessionRef = useRef<{ destroy: () => void } | null>(null);

	// Limpieza al cerrar o cambiar de modo
	const cleanSessions = () => {
		if (hostSessionRef.current) {
			hostSessionRef.current.destroy();
			hostSessionRef.current = null;
		}
		if (clientSessionRef.current) {
			clientSessionRef.current.destroy();
			clientSessionRef.current = null;
		}
	};

	useEffect(() => {
		if (!isOpen) {
			cleanSessions();
			setMode('select');
			setStatus('idle');
			setStatusText('');
			setCode('');
			setInputCode('');
			setErrorMsg('');
		}
		return () => {
			cleanSessions();
		};
	}, [isOpen]);

	// Iniciar modo de envío (Host)
	const handleStartHosting = () => {
		cleanSessions();
		setMode('send');
		setStatus('connecting');
		setStatusText('Conectando con el servicio de señalización...');
		setErrorMsg('');

		try {
			hostSessionRef.current = startSyncHost({
				onCodeGenerated: (generatedCode) => {
					setCode(generatedCode);
					setStatus('idle');
					setStatusText('Listo. Introduce este código en tu otro dispositivo.');
				},
				onConnectionEstablished: () => {
					setStatus('connected');
					setStatusText('¡Dispositivo conectado! Enviando datos...');
				},
				onDataSent: () => {
					setStatus('completed');
					setStatusText('¡Tus datos han sido enviados con éxito!');
				},
				onError: (err) => {
					console.error('Host error:', err);
					setStatus('error');
					setErrorMsg(err.message || 'Error al conectar con el servidor de señalización de PeerJS.');
				}
			});
		} catch (err: any) {
			setStatus('error');
			setErrorMsg(err.message || 'Error inesperado al inicializar la conexión.');
		}
	};

	// Conectar al host y recibir datos (Client)
	const handleConnectToHost = (e: React.FormEvent) => {
		e.preventDefault();
		if (!inputCode.trim() || inputCode.length < 6) {
			setErrorMsg('El código de conexión debe tener 6 caracteres.');
			return;
		}

		cleanSessions();
		setMode('receive');
		setStatus('connecting');
		setStatusText('Conectando al dispositivo emisor...');
		setErrorMsg('');

		try {
			clientSessionRef.current = connectToSyncHost(inputCode, {
				onConnected: () => {
					setStatus('connected');
					setStatusText('Conectado. Recibiendo datos...');
				},
				onDataReceived: async (data) => {
					setStatusText('Datos recibidos. Procesando e importando...');
					try {
						await processReceivedData(data);
						setStatus('completed');
						setStatusText('¡Sincronización completada! Recargando aplicación...');
						setTimeout(() => {
							window.location.reload();
						}, 1500);
					} catch (err: any) {
						setStatus('error');
						setErrorMsg(err.message || 'Error al validar y guardar la base de datos recibida.');
					}
				},
				onError: (err) => {
					console.error('Client error:', err);
					setStatus('error');
					setErrorMsg(err.message || 'No se pudo conectar. Verifica que el código es correcto y el PC emisor sigue activo.');
				}
			});
		} catch (err: any) {
			setStatus('error');
			setErrorMsg(err.message || 'Error inesperado al intentar conectar.');
		}
	};

	// Procesamiento e importación de la base de datos recibida
	const processReceivedData = async (data: SyncData) => {
		const keysToImport = [
			'finanzas_v3_transactions',
			'finanzas_v3_debts',
			'finanzas_v3_periods',
			'finanzas_v3_accounts',
			'finanzas_v3_userA_name',
			'finanzas_v3_userB_name',
			'finanzas_v2_gemini_key',
			'finanzas_v3_ai_chat',
			'finanzas_v3_password_salt',
			'finanzas_v3_password_check'
		];

		// Sanitizador local básico para inyección HTML en campos de texto plano
		const basicSanitize = (str: string): string => {
			return str
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#039;');
		};

		// 1. Validaciones básicas de tipo, longitud y tamaño (Mitigación DoS y Pollution)
		for (const key of keysToImport) {
			const value = data[key];
			if (value !== undefined && value !== null) {
				if (typeof value !== 'string') {
					throw new Error(`El formato del valor para la clave ${key} es inválido.`);
				}
				if (value.length > 2000000) { // Límite de 2MB por clave (2 millones de caracteres)
					throw new Error(`El tamaño de los datos de la clave ${key} supera el límite de seguridad de 2MB.`);
				}
			}
		}

		const isEncrypted = !!data['finanzas_v3_password_salt'];

		if (isEncrypted) {
			// Guardar únicamente las claves autorizadas (Lista Blanca)
			keysToImport.forEach((key) => {
				const value = data[key];
				if (value !== undefined && value !== null) {
					let finalValue = value;
					// Si es el nombre de usuario (que viaja en plano incluso con PIN), lo sanitizamos y limitamos
					if (key === 'finanzas_v3_userA_name' || key === 'finanzas_v3_userB_name') {
						const trimmed = value.trim().substring(0, 50);
						finalValue = basicSanitize(trimmed);
					}
					localStorage.setItem(key, finalValue);
				} else {
					localStorage.removeItem(key);
				}
			});
		} else {
			// Si no está cifrado, filtramos para que solo contenga claves válidas antes de pasar al validador estándar
			const filteredData: Record<string, any> = {};
			keysToImport.forEach((key) => {
				if (data[key] !== undefined && data[key] !== null) {
					filteredData[key] = data[key];
				}
			});

			const validated = validateAndSanitizeBackup(filteredData);

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
			}
			if (validated[STORAGE_KEYS.geminiKey] !== undefined) {
				await saveGeminiApiKey(validated[STORAGE_KEYS.geminiKey]);
				setGeminiApiKey(validated[STORAGE_KEYS.geminiKey]);
			}
			if (validated[STORAGE_KEYS.aiChat] !== undefined) {
				await saveAiChat(validated[STORAGE_KEYS.aiChat]);
				setChatMessages(validated[STORAGE_KEYS.aiChat]);
			}

			// Asegurarse de quitar las claves de contraseña locales si la recibida está en texto plano
			localStorage.removeItem('finanzas_v3_password_salt');
			localStorage.removeItem('finanzas_v3_password_check');

			const activePeriods = validated[STORAGE_KEYS.periods] || [];
			if (activePeriods.length > 0) {
				const sortedP = [...activePeriods].sort((a, b) => a.month.localeCompare(b.month));
				setSelectedMonth(sortedP[sortedP.length - 1].month);
			}
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div 
				className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 relative"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Botón de cerrar */}
				<button 
					onClick={onClose}
					className="absolute top-4 right-4 text-slate-500 hover:text-slate-200 transition-colors"
					aria-label="Cerrar modal"
				>
					<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>

				{/* Cabecera común */}
				<div className="text-center">
					<div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
						<svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
						</svg>
					</div>
					<h2 className="text-xl font-bold text-slate-100">Sincronización P2P</h2>
					<p className="text-xs text-slate-400 mt-1">
						Transfiere tus finanzas directamente entre dispositivos sin usar la nube.
					</p>
				</div>

				{/* MODO SELECCIÓN */}
				{mode === 'select' && (
					<div className="space-y-4 pt-2">
						<button
							onClick={handleStartHosting}
							className="w-full flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all group"
						>
							<div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-500/20 transition-all">
								<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
								</svg>
							</div>
							<div>
								<span className="font-semibold text-slate-200 block text-sm">Enviar datos (desde este dispositivo)</span>
								<span className="text-[11px] text-slate-500 block leading-normal mt-0.5">
									Genera un código temporal para compartir los datos de este PC con tu móvil.
								</span>
							</div>
						</button>

						<button
							onClick={() => setMode('receive')}
							className="w-full flex items-center gap-4 p-4 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition-all group"
						>
							<div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl group-hover:bg-violet-500/20 transition-all">
								<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
									<path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
								</svg>
							</div>
							<div>
								<span className="font-semibold text-slate-200 block text-sm">Recibir datos (en este dispositivo)</span>
								<span className="text-[11px] text-slate-500 block leading-normal mt-0.5">
									Introduce el código del otro dispositivo para descargar y sobreescribir tus datos locales.
								</span>
							</div>
						</button>
					</div>
				)}

				{/* MODO ENVÍO (HOST) */}
				{mode === 'send' && (
					<div className="space-y-6 text-center pt-2">
						{status === 'connecting' && (
							<div className="space-y-4">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-slate-400 font-medium">{statusText}</p>
							</div>
						)}

						{status === 'idle' && (
							<div className="space-y-4">
								<p className="text-xs text-slate-400">
									Introduce este código temporal en la opción **"Recibir datos"** de tu móvil/otro dispositivo:
								</p>
								<div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 inline-block">
									<span className="text-4xl font-mono font-black tracking-widest text-indigo-400 select-all">
										{code}
									</span>
								</div>
								<p className="text-[10px] text-slate-500 italic">
									Mantén esta pestaña abierta. El envío comenzará de forma automática al conectarse el móvil.
								</p>
							</div>
						)}

						{status === 'connected' && (
							<div className="space-y-4">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-indigo-400 font-bold">{statusText}</p>
							</div>
						)}

						{status === 'completed' && (
							<div className="space-y-3">
								<div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
									<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<p className="text-sm font-bold text-slate-200">{statusText}</p>
								<button
									onClick={onClose}
									className="mt-2 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
								>
									Entendido
								</button>
							</div>
						)}
					</div>
				)}

				{/* MODO RECEPCIÓN (CLIENT) */}
				{mode === 'receive' && (
					<div className="space-y-6 pt-2">
						{status === 'idle' && (
							<form onSubmit={handleConnectToHost} className="space-y-4">
								<div className="space-y-2">
									<label htmlFor="sync-code-input" className="block text-xs font-medium text-slate-400">
										Código de Conexión (6 letras/números)
									</label>
									<input
										id="sync-code-input"
										type="text"
										maxLength={6}
										required
										placeholder="EJ: XZYQWE"
										value={inputCode}
										onChange={(e) => setInputCode(e.target.value.toUpperCase().trim())}
										className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-lg font-mono font-black text-center text-indigo-300 outline-none tracking-widest uppercase transition-all"
									/>
								</div>

								<div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-450 leading-relaxed flex gap-2">
									<svg className="w-4 h-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
									</svg>
									<span>
										<strong>Atención:</strong> Al conectar e importar, se reemplazarán por completo todas tus cuentas, movimientos y deudas de este dispositivo con los del emisor.
									</span>
								</div>

								<div className="flex gap-2 pt-2">
									<button
										type="submit"
										className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-95 shadow-md shadow-indigo-600/10"
									>
										Conectar y Sincronizar
									</button>
									<button
										type="button"
										onClick={() => setMode('select')}
										className="w-1/2 bg-slate-850 hover:bg-slate-800 text-slate-300 font-semibold py-2.5 rounded-xl text-xs transition-all"
									>
										Atrás
									</button>
								</div>
							</form>
						)}

						{status === 'connecting' && (
							<div className="space-y-4 text-center">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-slate-400 font-medium">{statusText}</p>
							</div>
						)}

						{status === 'connected' && (
							<div className="space-y-4 text-center">
								<div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
								<p className="text-xs text-indigo-400 font-bold">{statusText}</p>
							</div>
						)}

						{status === 'completed' && (
							<div className="space-y-3 text-center">
								<div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
									<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
										<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<p className="text-sm font-bold text-slate-200">{statusText}</p>
							</div>
						)}
					</div>
				)}

				{/* MENSAJES DE ERROR */}
				{status === 'error' && (
					<div className="space-y-4 text-center pt-2">
						<div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
							<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
								<path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<div className="space-y-2">
							<p className="text-sm font-bold text-slate-200">Ha ocurrido un error</p>
							<p className="text-xs text-rose-400 leading-relaxed px-2">{errorMsg}</p>
						</div>
						<div className="flex gap-2 pt-2 justify-center">
							<button
								onClick={mode === 'send' ? handleStartHosting : () => setStatus('idle')}
								className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
							>
								Reintentar
							</button>
							<button
								onClick={() => setMode('select')}
								className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-semibold rounded-xl transition-all"
							>
								Cambiar Modo
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
