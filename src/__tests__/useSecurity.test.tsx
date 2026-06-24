import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSecurity } from '../hooks/useSecurity';
import * as storageService from '../services/storageService';

vi.mock('../services/storageService', () => ({
	setCryptoKey: vi.fn(),
	saveStoredAccounts: vi.fn(),
	saveStoredTransactions: vi.fn(),
	saveStoredDebts: vi.fn(),
	saveStoredPeriods: vi.fn(),
	saveGeminiApiKey: vi.fn(),
	saveAiChat: vi.fn(),
	saveUserNames: vi.fn(),
	executeSilentMigrationIfRequired: vi.fn(),
	readUserNames: vi.fn().mockResolvedValue({ userAName: 'User A', userBName: 'User B' }),
	readStoredTransactions: vi.fn().mockResolvedValue([]),
	readStoredDebts: vi.fn().mockResolvedValue([]),
	readStoredPeriods: vi.fn().mockResolvedValue([]),
	readStoredAccounts: vi.fn().mockResolvedValue([]),
	readGeminiApiKey: vi.fn().mockResolvedValue(''),
	readAiChat: vi.fn().mockResolvedValue([]),
	readProfileCount: vi.fn().mockResolvedValue(2)
}));

describe('useSecurity hook', () => {
	const mockGetSnapshot = vi.fn().mockReturnValue({
		accounts: [],
		transactions: [],
		debts: [],
		periods: [],
		geminiApiKey: '',
		chatMessages: [],
		userAName: 'User A',
		userBName: 'User B',
		profileCount: 2
	});

	const mockAppliers = {
		setAccounts: vi.fn(),
		setTransactions: vi.fn(),
		setDebts: vi.fn(),
		setPeriods: vi.fn(),
		setUserAName: vi.fn(),
		setUserBName: vi.fn(),
		setGeminiApiKey: vi.fn(),
		setChatMessages: vi.fn(),
		setSelectedMonth: vi.fn(),
		setIsInitialized: vi.fn(),
		setProfileCount: vi.fn()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	it('debe inicializarse desbloqueado si no hay salt en localStorage', () => {
		const { result } = renderHook(() =>
			useSecurity({
				getSnapshot: mockGetSnapshot,
				appliers: mockAppliers
			})
		);
		expect(result.current.isLocked).toBe(false);
		expect(result.current.hasPasswordSet).toBe(false);
	});

	it('debe rechazar PIN menor de 4 caracteres', async () => {
		const { result } = renderHook(() =>
			useSecurity({
				getSnapshot: mockGetSnapshot,
				appliers: mockAppliers
			})
		);
		let setupRes;
		await act(async () => {
			setupRes = await result.current.handleSetupPassword('123');
		});
		expect(setupRes).toBe(false);
		expect(result.current.passwordError).toBe('El PIN debe tener al menos 4 caracteres.');
	});

	it('debe configurar la clave y cifrar datos en setup', async () => {
		const { result } = renderHook(() =>
			useSecurity({
				getSnapshot: mockGetSnapshot,
				appliers: mockAppliers
			})
		);
		let setupRes;
		await act(async () => {
			setupRes = await result.current.handleSetupPassword('1234');
		});
		expect(setupRes).toBe(true);
		expect(localStorage.getItem('finanzas_v3_password_salt')).not.toBeNull();
		expect(localStorage.getItem('finanzas_v3_password_check')).not.toBeNull();
		expect(storageService.saveStoredAccounts).toHaveBeenCalled();
	});

	it('debe bloquear la app', () => {
		const { result } = renderHook(() =>
			useSecurity({
				getSnapshot: mockGetSnapshot,
				appliers: mockAppliers
			})
		);
		act(() => {
			result.current.handleLockApp();
		});
		expect(result.current.isLocked).toBe(true);
		expect(mockAppliers.setAccounts).toHaveBeenCalledWith([]);
	});
});
