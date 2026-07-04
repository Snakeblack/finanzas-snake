import { describe, it, expect } from 'vitest';
import {
	generateShortCode,
	hashCode,
	deriveKeyFromCode,
	encryptPayload,
	decryptPayload
} from '../services/syncService';

describe('syncService - Criptografía y Seguridad', () => {
	it('debe generar códigos de 10 caracteres con caracteres no ambiguos', () => {
		const code = generateShortCode();
		expect(code).toHaveLength(10);
		expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]+$/);
	});

	it('debe producir un hash SHA-256 consistente para el mismo código', async () => {
		const code = 'X5Y6Z7';
		const hash1 = await hashCode(code);
		const hash2 = await hashCode(code);
		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // SHA-256 en hex tiene 64 caracteres
	});

	it('debe cifrar y descifrar un payload correctamente usando la clave derivada del código', async () => {
		const code = 'A1B2C3';
		const payload = JSON.stringify({
			transactions: [{ id: 'tx-1', amount: '100.00' }],
			accounts: [{ id: 'acc-1', name: 'Ahorro' }]
		});

		const key = await deriveKeyFromCode(code);
		const encrypted = await encryptPayload(payload, key);

		expect(encrypted).toContain(':'); // Formato iv:ciphertext
		const decrypted = await decryptPayload(encrypted, key);
		expect(decrypted).toBe(payload);
		expect(JSON.parse(decrypted)).toEqual(JSON.parse(payload));
	});

	it('debe fallar al descifrar si se usa un código diferente', async () => {
		const payload = 'datos-secretos';
		const key = await deriveKeyFromCode('CODE01');
		const wrongKey = await deriveKeyFromCode('CODE02');

		const encrypted = await encryptPayload(payload, key);
		await expect(decryptPayload(encrypted, wrongKey)).rejects.toThrow();
	});
});
