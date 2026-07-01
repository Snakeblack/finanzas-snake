import { Period, Transaction } from '../types';

/**
 * Normaliza un mes a formato YYYY-MM. Si no se provee valor, retorna el mes actual.
 *
 * @param value String de mes o fecha a normalizar
 * @returns Mes en formato YYYY-MM
 */
export const normalizeMonth = (value?: string): string => {
	return value?.substring(0, 7) || new Date().toISOString().substring(0, 7);
};

/**
 * Añade o resta una cantidad de meses a un mes determinado (YYYY-MM).
 *
 * @param month Mes de partida (YYYY-MM)
 * @param monthsToAdd Cantidad de meses a añadir (positivo o negativo)
 * @returns Nuevo mes en formato YYYY-MM
 */
export const addMonthsToMonth = (month: string, monthsToAdd: number): string => {
	const [year, monthIndex] = normalizeMonth(month).split('-').map(Number);
	const date = new Date(year, monthIndex - 1 + monthsToAdd, 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Obtiene una fecha en formato YYYY-MM-DD válida para un mes determinado (YYYY-MM)
 * ajustando el día preferido (si es superior a los días de ese mes, se ajusta al último día).
 *
 * @param monthStr Mes destino (YYYY-MM)
 * @param preferredDayStr Día preferido en string (DD)
 * @returns Fecha en formato YYYY-MM-DD
 */
export const getValidDateForMonth = (monthStr: string, preferredDayStr: string): string => {
	const [year, monthIndex] = monthStr.split('-').map(Number);
	const preferredDay = parseInt(preferredDayStr, 10);
	const lastDayOfMonth = new Date(year, monthIndex, 0).getDate();
	const clampedDay = Math.min(preferredDay, lastDayOfMonth);
	const dayStr = String(clampedDay).padStart(2, '0');
	return `${monthStr}-${dayStr}`;
};

/**
 * Auto-genera los periodos faltantes y copia los movimientos recurrentes correspondientes.
 * Devuelve los arrays actualizados de periodos y transacciones sin mutar los originales.
 *
 * @param periods Lista actual de periodos
 * @param transactions Lista actual de transacciones
 * @returns Un objeto con los periodos y transacciones actualizados
 */
export const autoGenerateMissingPeriods = (
	periods: Period[],
	transactions: Transaction[]
): { periods: Period[]; transactions: Transaction[] } => {
	if (periods.length === 0) {
		return { periods, transactions };
	}
	const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
	const latestMonth = sorted[sorted.length - 1].month;
	const currentMonth = new Date().toISOString().substring(0, 7);

	if (currentMonth > latestMonth) {
		const updatedPeriods = [...periods];
		let newTransactions = [...transactions];
		let iter = latestMonth;
		while (iter < currentMonth) {
			const prevMonth = iter;
			iter = addMonthsToMonth(iter, 1);
			updatedPeriods.push({
				month: iter,
				openingBalance: 0
			});

			// Copiar movimientos recurrentes del mes previo al nuevo mes iterado
			const recurringTxsInPrev = newTransactions.filter(
				(t) => t.date.substring(0, 7) === prevMonth && t.recurrence === 'recurring'
			);
			const cloned = recurringTxsInPrev.map((t) => ({
				...t,
				id: `${t.id}-${iter}`,
				date: getValidDateForMonth(iter, t.date.substring(8, 10)),
				originId: t.originId || t.id
			}));
			newTransactions = [...cloned, ...newTransactions];
		}
		return { periods: updatedPeriods, transactions: newTransactions };
	}

	return { periods, transactions };
};
