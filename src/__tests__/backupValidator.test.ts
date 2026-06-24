import { describe, it, expect } from 'vitest';
import { validateAndSanitizeBackup, sanitizeString } from '../utils/backupValidator';

describe('Validador de Copias de Seguridad (backupValidator)', () => {
	describe('Sanitización de Strings', () => {
		it('debe escapar caracteres HTML correctamente', () => {
			const dirty = '<script>alert("xss")</script> & hello';
			const clean = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; hello';
			expect(sanitizeString(dirty)).toBe(clean);
		});
	});

	describe('Validación de Copia de Seguridad Completa', () => {
		const validBackup = {
			finanzas_v3_userA_name: 'Ana',
			finanzas_v3_userB_name: 'Carlos',
			finanzas_v2_gemini_key: 'AIzaSyKeyExample',
			finanzas_v3_accounts: [
				{
					id: 'acc-1',
					name: 'Cuenta Nómina',
					owner: 'userA',
					initialBalance: 1500.5
				}
			],
			finanzas_v3_transactions: [
				{
					id: 'tx-1',
					desc: 'Compra Súper',
					amount: 45.3,
					type: 'expense',
					tag: 'Alimentación',
					date: '2026-05-30',
					recurrence: 'one-off',
					owner: 'joint',
					paidBy: 'shared'
				}
			],
			finanzas_v3_debts: [
				{
					id: 'debt-1',
					kind: 'classic',
					desc: 'Préstamo Coche',
					tag: 'Préstamo Coche',
					date: '2026-01',
					owner: 'userB',
					principal: 12000,
					tae: 4.5,
					termMonths: 36
				}
			],
			finanzas_v3_periods: [
				{
					month: '2026-05',
					openingBalance: 1500,
					openingBalanceA: 750,
					openingBalanceB: 750,
					isManualInit: true
				}
			],
			finanzas_v3_ai_chat: [
				{
					role: 'user',
					content: 'Hola',
					timestamp: '14:45'
				}
			]
		};

		it('debe validar y sanitizar un backup completamente válido', () => {
			const result = validateAndSanitizeBackup(validBackup);
			expect(result.finanzas_v3_userA_name).toBe('Ana');
			expect(result.finanzas_v3_accounts[0].name).toBe('Cuenta Nómina');
			expect(result.finanzas_v3_transactions[0].desc).toBe('Compra Súper');
			expect(result.finanzas_v3_debts[0].desc).toBe('Préstamo Coche');
			expect(result.finanzas_v3_periods[0].month).toBe('2026-05');
			expect(result.finanzas_v3_ai_chat[0].content).toBe('Hola');
		});

		it('debe sanitizar XSS de los campos del backup', () => {
			const maliciousBackup = {
				...validBackup,
				finanzas_v3_userA_name: 'Ana <script>alert(1)</script>',
				finanzas_v3_transactions: [
					{
						...validBackup.finanzas_v3_transactions[0],
						desc: 'Gasto <iframe src="javascript:alert(1)"></iframe>'
					}
				]
			};

			const result = validateAndSanitizeBackup(maliciousBackup);
			expect(result.finanzas_v3_userA_name).toBe('Ana &lt;script&gt;alert(1)&lt;/script&gt;');
			expect(result.finanzas_v3_transactions[0].desc).toBe(
				'Gasto &lt;iframe src=&quot;javascript:alert(1)&quot;&gt;&lt;/iframe&gt;'
			);
		});

		it('debe fallar si los tipos de datos no son correctos', () => {
			const badBackup = {
				...validBackup,
				finanzas_v3_userA_name: 123 // Debe ser string
			};
			expect(() => validateAndSanitizeBackup(badBackup)).toThrow();
		});

		it('debe fallar si falta algún campo obligatorio en una transacción', () => {
			const badBackup = {
				...validBackup,
				finanzas_v3_transactions: [
					{
						id: 'tx-1',
						desc: 'Sin cantidad'
						// Falta amount, type, tag, etc.
					}
				]
			};
			expect(() => validateAndSanitizeBackup(badBackup)).toThrow();
		});

		it('debe fallar si un importe es negativo', () => {
			const badBackup = {
				...validBackup,
				finanzas_v3_transactions: [
					{
						...validBackup.finanzas_v3_transactions[0],
						amount: -10 // Debe ser >= 0
					}
				]
			};
			expect(() => validateAndSanitizeBackup(badBackup)).toThrow();
		});

		it('debe fallar si el formato de la fecha es incorrecto', () => {
			const badBackup = {
				...validBackup,
				finanzas_v3_transactions: [
					{
						...validBackup.finanzas_v3_transactions[0],
						date: '30-05-2026' // Debe ser YYYY-MM-DD
					}
				]
			};
			expect(() => validateAndSanitizeBackup(badBackup)).toThrow();
		});

		it('debe aceptar JSON strings y parsearlos correctamente', () => {
			const jsonStringBackup = {
				...validBackup,
				finanzas_v3_transactions: JSON.stringify(validBackup.finanzas_v3_transactions)
			};
			const result = validateAndSanitizeBackup(jsonStringBackup);
			expect(result.finanzas_v3_transactions[0].id).toBe('tx-1');
		});

		it('debe fallar si la estructura no es un objeto o es nula', () => {
			expect(() => validateAndSanitizeBackup(null)).toThrow('copia de seguridad no es un objeto');
			expect(() => validateAndSanitizeBackup('cadena')).toThrow('copia de seguridad no es un objeto');
		});

		it('debe fallar si no contiene información financiera', () => {
			expect(() => validateAndSanitizeBackup({})).toThrow('no contiene información financiera');
			expect(() => validateAndSanitizeBackup({ finanzas_v3_userA_name: 'Ana' })).toThrow(
				'no contiene información financiera'
			);
		});

		it('debe fallar si cuentas, transacciones, deudas o periodos no son arrays', () => {
			expect(() => validateAndSanitizeBackup({ ...validBackup, finanzas_v3_accounts: {} })).toThrow(
				'debe ser un array'
			);
			expect(() => validateAndSanitizeBackup({ ...validBackup, finanzas_v3_transactions: 123 })).toThrow(
				'debe ser un array'
			);
			expect(() => validateAndSanitizeBackup({ ...validBackup, finanzas_v3_debts: {} })).toThrow(
				'debe ser un array'
			);
			expect(() => validateAndSanitizeBackup({ ...validBackup, finanzas_v3_periods: true })).toThrow(
				'debe ser un array'
			);
			expect(() => validateAndSanitizeBackup({ ...validBackup, finanzas_v3_ai_chat: {} })).toThrow(
				'debe ser un array'
			);
		});

		it('debe manejar gemini key vacía o con espacios', () => {
			const result = validateAndSanitizeBackup({
				...validBackup,
				finanzas_v2_gemini_key: '   '
			});
			expect(result.finanzas_v2_gemini_key).toBe('');
		});

		it('debe fallar si el propietario de la cuenta es inválido', () => {
			const badBackup = {
				...validBackup,
				finanzas_v3_accounts: [{ id: 'acc-1', name: 'Cuenta', owner: 'invalid-owner', initialBalance: 100 }]
			};
			expect(() => validateAndSanitizeBackup(badBackup)).toThrow("debe ser 'userA', 'userB' o 'joint'");
		});

		it('debe fallar si una cuenta no es un objeto válido', () => {
			const badBackup = {
				...validBackup,
				finanzas_v3_accounts: [null]
			};
			expect(() => validateAndSanitizeBackup(badBackup)).toThrow('posición 0 es inválida');
		});

		it('debe validar opcionales y valores vacíos en campos opcionales de transacciones', () => {
			const backup = {
				...validBackup,
				finanzas_v3_transactions: [
					{
						id: 'tx-1',
						desc: 'Gasto',
						amount: 100,
						type: 'expense',
						tag: 'Tag',
						date: '2026-05-30',
						recurrence: 'one-off',
						owner: 'joint',
						paidBy: 'shared',
						accountId: undefined,
						fromAccountId: null,
						toAccountId: 'acc-2'
					}
				]
			};
			const result = validateAndSanitizeBackup(backup);
			expect(result.finanzas_v3_transactions[0].accountId).toBeUndefined();
			expect(result.finanzas_v3_transactions[0].fromAccountId).toBeUndefined();
			expect(result.finanzas_v3_transactions[0].toAccountId).toBe('acc-2');
		});

		it('debe fallar con tipo de transacción o pago inválidos', () => {
			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_transactions: [{ ...validBackup.finanzas_v3_transactions[0], type: 'invalid' }]
				})
			).toThrow("debe ser 'income', 'expense' o 'transfer'");

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_transactions: [{ ...validBackup.finanzas_v3_transactions[0], recurrence: 'invalid' }]
				})
			).toThrow("debe ser 'recurring' o 'one-off'");

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_transactions: [{ ...validBackup.finanzas_v3_transactions[0], owner: 'invalid' }]
				})
			).toThrow("debe ser 'userA', 'userB' o 'joint'");

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_transactions: [{ ...validBackup.finanzas_v3_transactions[0], paidBy: 'invalid' }]
				})
			).toThrow("debe ser 'userA', 'userB' o 'shared'");
		});

		it('debe validar deudas de tipo fraccionamiento (paymentPlan)', () => {
			const backup = {
				...validBackup,
				finanzas_v3_debts: [
					{
						id: 'debt-pp',
						kind: 'paymentPlan',
						desc: 'Fraccionado',
						tag: 'Otros',
						date: '2026-05',
						owner: 'joint',
						financedAmount: 300,
						fees: 15,
						totalToPay: 315,
						installments: [
							{ id: 'inst-1', dueMonth: '2026-06', amount: 105, status: 'paid', label: 'Cuota 1' },
							{ id: 'inst-2', dueMonth: '2026-07', amount: 105, status: 'pending', label: 'Cuota 2' },
							{ id: 'inst-3', dueMonth: '2026-08', amount: 105, status: 'pending', label: 'Cuota 3' }
						]
					}
				]
			};
			const result = validateAndSanitizeBackup(backup);
			expect(result.finanzas_v3_debts[0].kind).toBe('paymentPlan');
			expect(result.finanzas_v3_debts[0].installments).toHaveLength(3);
			expect(result.finanzas_v3_debts[0].installments[0].status).toBe('paid');
		});

		it('debe fallar si una deuda clásica tiene campos numéricos no válidos o negativos', () => {
			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [{ ...validBackup.finanzas_v3_debts[0], kind: 'invalid-kind' }]
				})
			).toThrow("debe ser 'classic' o 'paymentPlan'");

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [{ ...validBackup.finanzas_v3_debts[0], date: '2026/05' }]
				})
			).toThrow('formato de fecha');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [{ ...validBackup.finanzas_v3_debts[0], owner: 'invalid-owner' }]
				})
			).toThrow("debe ser 'userA', 'userB' o 'joint'");

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [{ ...validBackup.finanzas_v3_debts[0], principal: -1 }]
				})
			).toThrow('debe ser mayor o igual a 0');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [{ ...validBackup.finanzas_v3_debts[0], tae: 'no-number' }]
				})
			).toThrow('debe ser un número válido');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [{ ...validBackup.finanzas_v3_debts[0], termMonths: 12.5 }]
				})
			).toThrow('debe ser un número entero');
		});

		it('debe fallar si una deuda fraccionada tiene cuotas no válidas', () => {
			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [
						{
							id: 'debt-pp',
							kind: 'paymentPlan',
							desc: 'Fraccionado',
							tag: 'Otros',
							date: '2026-05',
							owner: 'joint',
							financedAmount: 300,
							fees: 15,
							totalToPay: 315,
							installments: 'no-array'
						}
					]
				})
			).toThrow('debe contener un array de cuotas');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [
						{
							id: 'debt-pp',
							kind: 'paymentPlan',
							desc: 'Fraccionado',
							tag: 'Otros',
							date: '2026-05',
							owner: 'joint',
							financedAmount: 300,
							fees: 15,
							totalToPay: 315,
							installments: [null]
						}
					]
				})
			).toThrow('La cuota en la posición 0 de la deuda debt-pp es inválida');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [
						{
							id: 'debt-pp',
							kind: 'paymentPlan',
							desc: 'Fraccionado',
							tag: 'Otros',
							date: '2026-05',
							owner: 'joint',
							financedAmount: 300,
							fees: 15,
							totalToPay: 315,
							installments: [
								{ id: 'inst-1', dueMonth: '2026/06', amount: 105, status: 'paid', label: 'Cuota' }
							]
						}
					]
				})
			).toThrow('debe ser YYYY-MM');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_debts: [
						{
							id: 'debt-pp',
							kind: 'paymentPlan',
							desc: 'Fraccionado',
							tag: 'Otros',
							date: '2026-05',
							owner: 'joint',
							financedAmount: 300,
							fees: 15,
							totalToPay: 315,
							installments: [
								{
									id: 'inst-1',
									dueMonth: '2026-06',
									amount: 105,
									status: 'invalid-status',
									label: 'Cuota'
								}
							]
						}
					]
				})
			).toThrow("debe ser 'paid' o 'pending'");
		});

		it('debe fallar si los periodos o el chat de IA contienen datos erróneos', () => {
			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_periods: [
						{ month: '2026/05', openingBalance: 100, openingBalanceA: 50, openingBalanceB: 50 }
					]
				})
			).toThrow('formato de mes');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_periods: [null]
				})
			).toThrow('período en la posición 0 es inválido');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_ai_chat: [{ role: 'invalid-role', content: 'hola', timestamp: '12:00' }]
				})
			).toThrow('rol del mensaje');

			expect(() =>
				validateAndSanitizeBackup({
					...validBackup,
					finanzas_v3_ai_chat: [null]
				})
			).toThrow('mensaje del chat en la posición 0 es inválido');
		});
	});
});
