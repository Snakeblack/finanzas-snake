import { describe, it, expect } from 'vitest';
import {
	bufToHex,
	hexToBuf,
	generateSalt,
	deriveKeyFromPassword,
	encryptWithKey,
	decryptWithKey
} from '../services/cryptoService';

describe('Servicio Criptográfico (cryptoService)', () => {
	describe('Operaciones Hexadecimales', () => {
		it('debe convertir buffers a hexadecimales', () => {
			const buf = new Uint8Array([0, 1, 10, 15, 16, 255]);
			expect(bufToHex(buf)).toBe('00010a0f10ff');
		});

		it('debe convertir hexadecimales a buffers', () => {
			const hex = '00010a0f10ff';
			const buf = hexToBuf(hex);
			expect(buf[0]).toBe(0);
			expect(buf[1]).toBe(1);
			expect(buf[2]).toBe(10);
			expect(buf[3]).toBe(15);
			expect(buf[4]).toBe(16);
			expect(buf[5]).toBe(255);
		});

		it('debe lanzar un error si la longitud del hexadecimal es impar', () => {
			expect(() => hexToBuf('0')).toThrow();
			expect(() => hexToBuf('abc')).toThrow();
		});
	});

	describe('Generación de Salt', () => {
		it('debe generar un salt de 16 bytes de forma aleatoria', () => {
			const salt1 = generateSalt();
			const salt2 = generateSalt();
			expect(salt1).toBeInstanceOf(Uint8Array);
			expect(salt1.length).toBe(16);
			// Verificamos que sean diferentes (aleatorios)
			expect(bufToHex(salt1)).not.toBe(bufToHex(salt2));
		});
	});

	describe('Cifrado y Descifrado con Clave (AES-GCM)', () => {
		it('debe cifrar y descifrar texto correctamente con la misma contraseña y salt', async () => {
			const password = 'mi-password-secreto';
			const salt = generateSalt();
			const plaintext = '¡Datos financieros confidenciales!';

			const key = await deriveKeyFromPassword(password, salt);
			const encrypted = await encryptWithKey(plaintext, key);

			expect(encrypted).toContain(':');
			const parts = encrypted.split(':');
			expect(parts.length).toBe(2);
			// El IV debe tener 12 bytes (24 caracteres hex)
			expect(parts[0].length).toBe(24);

			const decrypted = await decryptWithKey(encrypted, key);
			expect(decrypted).toBe(plaintext);
		});

		it('debe fallar al descifrar si se usa una contraseña diferente', async () => {
			const salt = generateSalt();
			const plaintext = 'texto secreto';

			const keyCorrecta = await deriveKeyFromPassword('clave-correcta', salt);
			const keyIncorrecta = await deriveKeyFromPassword('clave-incorrecta', salt);

			const encrypted = await encryptWithKey(plaintext, keyCorrecta);

			await expect(decryptWithKey(encrypted, keyIncorrecta)).rejects.toThrow();
		});

		it('debe lanzar error al descifrar si el formato es inválido', async () => {
			const salt = generateSalt();
			const key = await deriveKeyFromPassword('clave', salt);

			await expect(decryptWithKey('invalidformat', key)).rejects.toThrow(
				'Formato cifrado inválido. Se esperaba "iv:ciphertext".'
			);
			await expect(decryptWithKey('part1:part2:part3', key)).rejects.toThrow(
				'Formato cifrado inválido. Se esperaba "iv:ciphertext".'
			);
		});
	});
});
