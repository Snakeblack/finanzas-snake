import { describe, it, expect } from 'vitest';
import { buildChatPdfHtml, type ChatPdfSnapshot, type ChatPdfOptions } from '../services/chatPdfExport';
import type { Account, Transaction, ClassicDebt, ChatMessage, TagBreakdown } from '../types';

const accounts: Account[] = [
	{ id: 'acc-a', name: 'Efectivo A', owner: 'userA', initialBalance: 1000 },
	{ id: 'acc-b', name: 'Banco Común', owner: 'joint', initialBalance: 200 }
];

const classicDebt: ClassicDebt = {
	id: 'debt-1',
	kind: 'classic',
	desc: 'Préstamo Coche',
	tag: 'Préstamo Personal',
	date: '2026-05',
	principal: 10000,
	tae: 5,
	termMonths: 12,
	owner: 'joint'
};

const transaction: Transaction = {
	id: 'tx-1',
	desc: 'Nómina Mayo',
	money: { amount: '2500.00', currency: 'EUR' },
	type: 'income',
	tag: 'Sueldo',
	date: '2026-05-01',
	recurrence: 'recurring',
	owner: 'userA'
};

const chatMessages: ChatMessage[] = [
	{ role: 'user', content: '¿Cómo voy este mes? <b>importante</b>', timestamp: '2026-05-10 10:00' },
	{ role: 'model', content: 'Vas **bien**.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |', timestamp: '2026-05-10 10:01' }
];

const tagData: TagBreakdown[] = [{ tag: 'Alimentación', amount: 350.5 }];

const baseSnapshot: ChatPdfSnapshot = {
	viewMode: 'all',
	userAName: 'Alice',
	userBName: 'Bob',
	selectedMonth: '2026-05',
	netOwed: 0,
	accounts,
	accountBalances: { 'acc-a': 1200, 'acc-b': 200 },
	debts: [classicDebt],
	filteredDebts: [classicDebt],
	filteredTransactions: [transaction],
	chatMessages,
	tagData,
	totalIncomes: 2500,
	recurringIncomes: 2500,
	oneOffIncomes: 0,
	totalExpenses: 350.5,
	recurringExpenses: 0,
	oneOffExpenses: 350.5,
	totalMonthlyDebtPayments: 856.07,
	netMonthlyBalance: 1293.43,
	currentOpeningBalance: 1200,
	currentClosingBalance: 2493.43
};

const allOptions: ChatPdfOptions = {
	showContext: true,
	showDebts: true,
	showTransactions: true,
	showChat: true
};

const fixedDate = new Date(2026, 4, 10, 14, 5, 9); // 2026-05-10 14:05:09 local

describe('buildChatPdfHtml', () => {
	it('genera un título de PDF determinista a partir de la fecha inyectada', () => {
		const { pdfTitle } = buildChatPdfHtml(baseSnapshot, allOptions, fixedDate);
		expect(pdfTitle).toBe('20260510-140509-finanzaspro');
	});

	it('incluye el título en el HTML y arma un documento completo', () => {
		const { html } = buildChatPdfHtml(baseSnapshot, allOptions, fixedDate);
		expect(html).toContain('<!DOCTYPE html>');
		expect(html).toContain('<title>20260510-140509-finanzaspro</title>');
		expect(html).toContain('FinanzasPro');
	});

	it('renderiza las cuatro secciones cuando todas las opciones están activas', () => {
		const { html } = buildChatPdfHtml(baseSnapshot, allOptions, fixedDate);
		expect(html).toContain('Contexto Financiero de la Vista');
		expect(html).toContain('Registro de Deudas del Mes');
		expect(html).toContain('Movimientos Detallados del Mes');
		expect(html).toContain('Historial de Conversación con el Asesor');
	});

	it('omite las secciones cuyas opciones están desactivadas', () => {
		const { html } = buildChatPdfHtml(
			baseSnapshot,
			{ ...allOptions, showDebts: false, showChat: false },
			fixedDate
		);
		expect(html).toContain('Contexto Financiero de la Vista');
		expect(html).toContain('Movimientos Detallados del Mes');
		expect(html).not.toContain('Registro de Deudas del Mes');
		expect(html).not.toContain('Historial de Conversación con el Asesor');
	});

	it('muestra el aviso de vacío cuando no se selecciona ninguna sección', () => {
		const { html } = buildChatPdfHtml(
			baseSnapshot,
			{ showContext: false, showDebts: false, showTransactions: false, showChat: false },
			fixedDate
		);
		expect(html).toContain('Ninguna sección seleccionada para exportar.');
	});

	it('usa el saldo calculado de la cuenta y cae al inicial cuando no hay dato', () => {
		const { html } = buildChatPdfHtml(
			{ ...baseSnapshot, accountBalances: { 'acc-a': 1200 } },
			allOptions,
			fixedDate
		);
		expect(html).toContain('1200.00€'); // acc-a desde accountBalances
		expect(html).toContain('200.00€'); // acc-b cae a initialBalance
	});

	it('escapa el contenido del usuario y renderiza markdown del asesor', () => {
		const { html } = buildChatPdfHtml(baseSnapshot, allOptions, fixedDate);
		// Mensaje de usuario escapado (no inyecta HTML crudo)
		expect(html).toContain('&lt;b&gt;importante&lt;/b&gt;');
		// Markdown del asesor convertido
		expect(html).toContain('<strong>bien</strong>');
		expect(html).toContain('<table');
	});

	it('refleja la liquidación según netOwed', () => {
		const alDia = buildChatPdfHtml(baseSnapshot, allOptions, fixedDate).html;
		expect(alDia).toContain('Cuentas al día');

		const bDebe = buildChatPdfHtml({ ...baseSnapshot, netOwed: 50 }, allOptions, fixedDate).html;
		expect(bDebe).toContain('Bob debe a Alice 50.00€');

		const aDebe = buildChatPdfHtml({ ...baseSnapshot, netOwed: -30 }, allOptions, fixedDate).html;
		expect(aDebe).toContain('Alice debe a Bob 30.00€');
	});

	it('muestra placeholders cuando no hay deudas ni movimientos', () => {
		const { html } = buildChatPdfHtml(
			{ ...baseSnapshot, debts: [], filteredDebts: [], filteredTransactions: [] },
			allOptions,
			fixedDate
		);
		expect(html).toContain('No hay deudas registradas');
		expect(html).toContain('No hay movimientos este mes');
	});
});
