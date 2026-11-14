import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Account, ChatMessage, Transaction, Debt, Period } from '../types';
import { deriveKeyFromPassword, encryptWithKey, decryptWithKey, generateSalt } from '../services/cryptoService';
import {
	setCryptoKey,
	saveStoredAccounts,
	saveStoredTransactions,
	saveStoredDebts,
	saveStoredPeriods,
	saveGeminiApiKey,
	saveAiChat,
	saveUserNames,
	saveProfileCount,
	executeSilentMigrationIfRequired,
	readUserNames,
	readStoredTransactions,
	readStoredDebts,
	readStoredPeriods,
	readStoredAccounts,
	readGeminiApiKey,
	readAiChat,
	readProfileCount
} from '../services/storageService';
import { bytesToHex, hexToBytes } from '../utils/hexEncoding';
import { autoGenerateMissingPeriods } from '../utils/dateUtils';

const PASSWORD_SALT_KEY = 'finanzas_v3_password_salt';
const PASSWORD_CHECK_KEY = 'finanzas_v3_password_check';

/** Estado de dominio en memoria que `handleSetupPassword` cifra al activar el PIN. */
export interface SecurityDataSnapshot {
	accounts: Account[];
	transactions: Transaction[];
	debts: Debt[];
	periods: Period[];
	geminiApiKey: string;
	chatMessages: ChatMessage[];
	userAName: string;
	userBName: string;
	profileCount: 1 | 2;
}

/** Setters del contexto que el flujo de seguridad aplica al desbloquear o bloquear. */
export interface SecurityStateAppliers {
	setAccounts: Dispatch<SetStateAction<Account[]>>;
	setTransactions: Dispatch<SetStateAction<Transaction[]>>;
	setDebts: Dispatch<SetStateAction<Debt[]>>;
	setPeriods: Dispatch<SetStateAction<Period[]>>;
	setUserAName: Dispatch<SetStateAction<string>>;
	setUserBName: Dispatch<SetStateAction<string>>;
	setGeminiApiKey: Dispatch<SetStateAction<string>>;
	setChatMessages: Dispatch<SetStateAction<ChatMessage[]>>;
	setSelectedMonth: Dispatch<SetStateAction<string>>;
	setIsInitialized: Dispatch<SetStateAction<boolean>>;
	setProfileCount: Dispatch<SetStateAction<1 | 2>>;
}

interface UseSecurityParams {
	/** Lee el estado actual a cifrar al configurar el PIN (thunk: se evalúa al confirmar). */
	getSnapshot: () => SecurityDataSnapshot;
	appliers: SecurityStateAppliers;
}

export interface UseSecurityResult {
	isLocked: boolean;
	setIsLocked: Dispatch<SetStateAction<boolean>>;
	hasPasswordSet: boolean;
	/** La persona abrió la pantalla para crear su PIN; los datos siguen en memoria. */
	isSettingUpPin: boolean;
	passwordError: string;
	setPasswordError: Dispatch<SetStateAction<string>>;
	handleStartPinSetup: () => void;
	handleCancelPinSetup: () => void;
	handleSetupPassword: (password: string) => Promise<boolean>;
	handleUnlock: (password: string) => Promise<boolean>;
	handleLockApp: () => void;
}

/**
 * Encapsula la seguridad por PIN (OWASP): estado de bloqueo y los flujos de cifrado.
 * Extraído de `FinanzasContext` (D1).
 *
 * Como configurar/desbloquear/bloquear afectan a todo el estado de dominio, el contexto
 * (compositor) le pasa un `getSnapshot` para leer el estado a cifrar y unos `appliers`
 * para volcar lo descifrado o limpiar la memoria. El hook posee crypto + lock state.
 */
export const useSecurity = ({ getSnapshot, appliers }: UseSecurityParams): UseSecurityResult => {
	const [isLocked, setIsLocked] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem(PASSWORD_SALT_KEY) !== null;
		}
		return false;
	});
	const [hasPasswordSet, setHasPasswordSet] = useState(() => {
		if (typeof window !== 'undefined') {
			return localStorage.getItem(PASSWORD_SALT_KEY) !== null;
		}
		return false;
	});
	const [isSettingUpPin, setIsSettingUpPin] = useState(false);
	const [passwordError, setPasswordError] = useState('');

	// Configurar el PIN no es bloquear: handleSetupPassword cifra lo que hay en memoria,
	// así que la pantalla se abre sin limpiar el estado.
	const handleStartPinSetup = () => {
		setPasswordError('');
		setIsSettingUpPin(true);
	};

	const handleCancelPinSetup = () => {
		setPasswordError('');
		setIsSettingUpPin(false);
	};

	const handleSetupPassword = async (password: string): Promise<boolean> => {
		setPasswordError('');
		if (password.length < 4) {
			setPasswordError('El PIN debe tener al menos 4 caracteres.');
			return false;
		}
		let pinPersisted = false;
		try {
			const salt = generateSalt();
			const key = await deriveKeyFromPassword(password, salt);

			// Cifrar el vector de prueba "valid"
			const checkCiphertext = await encryptWithKey('valid', key);

			// Guardar el salt y el vector de prueba en LocalStorage
			const saltHex = bytesToHex(salt);
			localStorage.setItem(PASSWORD_SALT_KEY, saltHex);
			localStorage.setItem(PASSWORD_CHECK_KEY, checkCiphertext);

			// Establecer clave activa en storage
			setCryptoKey(key);
			pinPersisted = true;

			// Cifrar y guardar el estado actual (si existía previamente en texto plano)
			const {
				accounts,
				transactions,
				debts,
				periods,
				geminiApiKey,
				chatMessages,
				userAName,
				userBName,
				profileCount
			} = getSnapshot();
			await saveStoredAccounts(accounts);
			await saveStoredTransactions(transactions);
			await saveStoredDebts(debts);
			await saveStoredPeriods(periods);
			await saveGeminiApiKey(geminiApiKey);
			await saveAiChat(chatMessages);
			await saveUserNames({ userAName, userBName });
			await saveProfileCount(profileCount);

			setHasPasswordSet(true);
			setIsSettingUpPin(false);
			setIsLocked(false);
			appliers.setIsInitialized(true);
			return true;
		} catch (err) {
			const detail = err instanceof Error ? err.message : String(err);
			if (pinPersisted) {
				// La sal y la clave ya existen y puede haber datos cifrados con ellas: quitarlas los
				// dejaría ilegibles. El PIN queda activo y la interfaz lo refleja, en vez de aparentar
				// que no hay PIN y bloquearse en la siguiente recarga.
				setHasPasswordSet(true);
				setIsSettingUpPin(false);
				setIsLocked(false);
				window.alert(
					`El PIN ha quedado activado, pero falló el cifrado de parte de los datos: ${detail}. ` +
						'Tus datos siguen accesibles con este PIN. Exporta una copia de seguridad.'
				);
				return false;
			}
			setPasswordError(`Error al configurar PIN: ${detail}`);
			return false;
		}
	};

	const handleUnlock = async (password: string): Promise<boolean> => {
		setPasswordError('');
		const saltHex = localStorage.getItem(PASSWORD_SALT_KEY);
		const checkCiphertext = localStorage.getItem(PASSWORD_CHECK_KEY);
		if (!saltHex || !checkCiphertext) {
			setPasswordError('No se ha configurado un PIN.');
			return false;
		}
		try {
			const bytes = hexToBytes(saltHex);

			const key = await deriveKeyFromPassword(password, bytes);
			const checkText = await decryptWithKey(checkCiphertext, key);

			if (checkText === 'valid') {
				setCryptoKey(key);

				// Ejecutar migración silenciosa si es necesario
				await executeSilentMigrationIfRequired();
				const loadedUserNames = await readUserNames();
				const loadedProfileCount = await readProfileCount();

				const loadedTx = await readStoredTransactions();
				const loadedDebts = await readStoredDebts();
				const loadedPeriods = await readStoredPeriods(loadedTx, loadedDebts);
				const loadedAccounts = await readStoredAccounts();
				const loadedKey = await readGeminiApiKey();
				const loadedChat = await readAiChat();

				if (loadedAccounts.length === 0 && (loadedTx.length > 0 || loadedDebts.length > 0)) {
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

					let defaultAccs: Account[];
					if (loadedProfileCount === 1) {
						defaultAccs = [
							{
								id: 'default-a',
								name: `Efectivo ${loadedUserNames.userAName}`,
								owner: 'userA',
								initialBalance: initialBalA
							}
						];
					} else {
						defaultAccs = [
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
					appliers.setAccounts(defaultAccs);
					await saveStoredAccounts(defaultAccs);
				} else {
					appliers.setAccounts(loadedAccounts);
				}

				const generated = autoGenerateMissingPeriods(loadedPeriods, loadedTx);
				appliers.setTransactions(generated.transactions);
				appliers.setDebts(loadedDebts);
				appliers.setPeriods(generated.periods);
				appliers.setUserAName(loadedUserNames.userAName);
				appliers.setUserBName(loadedUserNames.userBName);
				appliers.setGeminiApiKey(loadedKey);
				appliers.setChatMessages(loadedChat);
				appliers.setProfileCount(loadedProfileCount as 1 | 2);

				if (loadedPeriods.length > 0) {
					const sortedP = [...loadedPeriods].sort((a, b) => a.month.localeCompare(b.month));
					const currentMonth = new Date().toISOString().substring(0, 7);
					const exists = sortedP.some((p) => p.month === currentMonth);
					if (exists) {
						appliers.setSelectedMonth(currentMonth);
					} else {
						appliers.setSelectedMonth(sortedP[sortedP.length - 1].month);
					}
				}

				setIsLocked(false);
				appliers.setIsInitialized(true);
				return true;
			} else {
				setPasswordError('PIN incorrecto. Vuelve a intentarlo.');
				return false;
			}
		} catch {
			setPasswordError('PIN incorrecto o error al descifrar.');
			return false;
		}
	};

	const handleLockApp = () => {
		appliers.setIsInitialized(false);
		setCryptoKey(null);
		appliers.setAccounts([]);
		appliers.setTransactions([]);
		appliers.setDebts([]);
		appliers.setPeriods([]);
		appliers.setGeminiApiKey('');
		appliers.setChatMessages([]);
		setIsLocked(true);
	};

	return {
		isLocked,
		setIsLocked,
		hasPasswordSet,
		isSettingUpPin,
		passwordError,
		setPasswordError,
		handleStartPinSetup,
		handleCancelPinSetup,
		handleSetupPassword,
		handleUnlock,
		handleLockApp
	};
};
