import { useState, type Dispatch, type SetStateAction, type SyntheticEvent } from 'react';
import type { Account, Transaction, Debt, Period, ChatMessage } from '../types';
import {
	buildFinanceBackupPayload,
	importFinanceBackupPayload,
	type FinanceBackupSnapshot,
	type ImportedFinanceBackupData
} from '../services/storageService';
import { autoGenerateMissingPeriods } from '../utils/dateUtils';

/** Setters del contexto que la importación de backup aplica al volcar los datos validados. */
export interface BackupStateAppliers {
	setAccounts: (accounts: Account[]) => void;
	setTransactions: (transactions: Transaction[]) => void;
	setDebts: (debts: Debt[]) => void;
	setPeriods: (periods: Period[]) => void;
	setUserAName: (name: string) => void;
	setUserBName: (name: string) => void;
	setGeminiApiKey: (key: string) => void;
	setChatMessages: (messages: ChatMessage[]) => void;
	setSelectedMonth: (month: string) => void;
	setProfileCount: (count: 1 | 2) => void;
}

/**
 * Vuelca al estado lo que una copia o una sincronización ya validó y guardó. Solo toca lo que
 * la copia trae: un dato ausente deja el estado actual como está.
 */
export const applyImportedBackup = (imported: ImportedFinanceBackupData, appliers: BackupStateAppliers): void => {
	if (imported.userAName !== undefined) {
		appliers.setUserAName(imported.userAName);
	}
	if (imported.userBName !== undefined) {
		appliers.setUserBName(imported.userBName);
	}
	if (imported.profileCount !== undefined) {
		appliers.setProfileCount(imported.profileCount);
	}
	if (imported.accounts !== undefined) {
		appliers.setAccounts(imported.accounts);
	}
	let finalPeriods = imported.periods;
	let finalTransactions = imported.transactions;
	if (finalPeriods !== undefined && finalTransactions !== undefined) {
		const generated = autoGenerateMissingPeriods(finalPeriods, finalTransactions);
		finalPeriods = generated.periods;
		finalTransactions = generated.transactions;
	}

	if (finalTransactions !== undefined) {
		appliers.setTransactions(finalTransactions);
	}
	if (imported.debts !== undefined) {
		appliers.setDebts(imported.debts);
	}
	if (finalPeriods !== undefined) {
		appliers.setPeriods(finalPeriods);
	}
	if (imported.geminiApiKey !== undefined) {
		appliers.setGeminiApiKey(imported.geminiApiKey);
	}
	if (imported.chatMessages !== undefined) {
		appliers.setChatMessages(imported.chatMessages);
	}
	if (imported.selectedMonth) {
		appliers.setSelectedMonth(imported.selectedMonth);
	}
};

interface UseBackupSyncParams {
	/** Lee el estado actual a serializar al exportar (thunk: se evalúa al pulsar exportar). */
	getSnapshot: () => FinanceBackupSnapshot;
	appliers: BackupStateAppliers;
}

export interface UseBackupSyncResult {
	importError: string;
	setImportError: Dispatch<SetStateAction<string>>;
	importSuccess: string;
	setImportSuccess: Dispatch<SetStateAction<string>>;
	handleExportData: () => void;
	handleImportData: (e: SyntheticEvent<HTMLFormElement>, jsonString: string) => void;
}

/**
 * Encapsula el backup local: exportación a JSON descargable e importación validada.
 * Extraído de `FinanzasContext` (D1).
 *
 * Como ambos flujos atraviesan todo el estado de dominio, el contexto le pasa `getSnapshot`
 * (estado a serializar) y `appliers` (setters para volcar lo importado). No introduce
 * dependencias reactivas: ambos handlers se ejecutan a nivel de evento.
 */
export const useBackupSync = ({ getSnapshot, appliers }: UseBackupSyncParams): UseBackupSyncResult => {
	const [importError, setImportError] = useState('');
	const [importSuccess, setImportSuccess] = useState('');

	const handleExportData = () => {
		try {
			const backupData = buildFinanceBackupPayload(getSnapshot());

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
		} catch (err) {
			window.alert(`Error al exportar datos: ${err instanceof Error ? err.message : String(err)}`);
		}
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
			applyImportedBackup(await importFinanceBackupPayload(parsed), appliers);

			setImportSuccess('Datos importados y validados con éxito.');
		} catch (err) {
			setImportError(`Error al procesar el backup: ${err instanceof Error ? err.message : String(err)}`);
		}
	};

	return {
		importError,
		setImportError,
		importSuccess,
		setImportSuccess,
		handleExportData,
		handleImportData
	};
};
