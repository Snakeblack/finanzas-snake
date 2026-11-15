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
 * Identificador de la serie recurrente a la que pertenece un movimiento: el de su raíz.
 */
export const seriesIdOf = (t: Transaction): string => t.originId || t.id;

/**
 * Clona los movimientos recurrentes de un mes en el mes destino.
 *
 * El identificador de cada clon es el de su serie más el mes destino, de modo que no crece con
 * los meses. Si ese identificador ya está en uso (dos movimientos de la misma serie en el mes de
 * origen), se deriva del movimiento clonado para no pisar a otro.
 *
 * Las series quitadas del mes de origen con «solo este» siguen desde su instancia guardada en
 * `skipped`, salvo que el mes tenga otra instancia de la misma serie.
 *
 * @param transactions Lista actual de transacciones
 * @param sourceMonth Mes del que se copian los recurrentes (YYYY-MM)
 * @param targetMonth Mes en el que se crean los clones (YYYY-MM)
 * @param skipped Instancias saltadas del mes de origen (`Period.skippedRecurring`)
 * @returns Los clones nuevos, sin incluir las transacciones existentes
 */
export const cloneRecurringForMonth = (
	transactions: Transaction[],
	sourceMonth: string,
	targetMonth: string,
	skipped: readonly Transaction[] = []
): Transaction[] => {
	const usedIds = new Set(transactions.map((t) => t.id));
	const sources = transactions.filter((t) => t.date.substring(0, 7) === sourceMonth && t.recurrence === 'recurring');
	const presentSeries = new Set(sources.map(seriesIdOf));
	skipped.forEach((t) => {
		const seriesId = seriesIdOf(t);
		if (t.recurrence === 'recurring' && !presentSeries.has(seriesId)) {
			presentSeries.add(seriesId);
			sources.push(t);
		}
	});
	return sources
		.map(({ sortIndex: _sortIndex, ...t }) => {
			const seriesId = t.originId || t.id;
			let id = `${seriesId}-${targetMonth}`;
			if (usedIds.has(id)) {
				id = `${t.id}-${targetMonth}`;
			}
			usedIds.add(id);
			return {
				...t,
				id,
				date: getValidDateForMonth(targetMonth, t.date.substring(8, 10)),
				originId: seriesId
			};
		});
};

/**
 * Guarda en su mes la instancia de una serie quitada con «solo este», tal como estaba, para que la
 * serie siga al crear el mes siguiente. Solo si ese mes es el último: los meses nuevos se crean
 * siempre desde el último. Sustituye otra instancia guardada de la misma serie.
 *
 * @param periods Lista actual de periodos
 * @param instance La instancia antes de editarla o borrarla
 * @returns Los periodos actualizados, o los mismos si no hay nada que guardar
 */
export const recordSkippedRecurring = (periods: Period[], instance: Transaction): Period[] => {
	const month = instance.date.substring(0, 7);
	const latestMonth = periods.reduce((max, p) => (p.month > max ? p.month : max), '');
	if (instance.recurrence !== 'recurring' || month !== latestMonth) {
		return periods;
	}
	const seriesId = seriesIdOf(instance);
	const { sortIndex: _sortIndex, ...template } = instance;
	return periods.map((p) =>
		p.month === month
			? {
					...p,
					skippedRecurring: [...(p.skippedRecurring ?? []).filter((t) => seriesIdOf(t) !== seriesId), template]
				}
			: p
	);
};

/**
 * Aplica a las instancias guardadas de una serie, desde un mes, el cambio de «este y los
 * siguientes» o «todos».
 *
 * @param periods Lista actual de periodos
 * @param seriesId Serie afectada
 * @param fromMonth Primer mes afectado (YYYY-MM); '' para todos
 * @param update Devuelve la instancia cambiada, o null para quitarla porque la serie termina
 * @returns Los periodos actualizados, o los mismos si ninguno guarda esa serie
 */
export const updateSkippedRecurring = (
	periods: Period[],
	seriesId: string,
	fromMonth: string,
	update: (instance: Transaction) => Transaction | null
): Period[] => {
	let changed = false;
	const updated = periods.map((p) => {
		if (p.month < fromMonth || !p.skippedRecurring?.some((t) => seriesIdOf(t) === seriesId)) {
			return p;
		}
		changed = true;
		const kept = p.skippedRecurring.flatMap((t) => {
			if (seriesIdOf(t) !== seriesId) return [t];
			const next = update(t);
			return next ? [next] : [];
		});
		const { skippedRecurring: _previous, ...rest } = p;
		return kept.length > 0 ? { ...rest, skippedRecurring: kept } : rest;
	});
	return changed ? updated : periods;
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
		const extended = appendMonthsWithRecurring(periods, transactions, currentMonth);
		return { periods: extended.periods, transactions: [...extended.transactions] };
	}

	return { periods, transactions };
};

/**
 * Añade los meses posteriores al último hasta `untilMonth`, cada uno con los recurrentes del mes
 * previo (y las series que siguen tras «solo este»), como «Crear mes siguiente».
 */
const appendMonthsWithRecurring = (
	periods: Period[],
	transactions: Transaction[],
	untilMonth: string
): { periods: Period[]; transactions: Transaction[] } => {
	const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
	const lastPeriod = sorted[sorted.length - 1];
	const updatedPeriods = [...periods];
	let newTransactions = transactions;
	let prevSkipped = lastPeriod.skippedRecurring ?? [];
	let iter = lastPeriod.month;
	while (iter < untilMonth) {
		const prevMonth = iter;
		iter = addMonthsToMonth(iter, 1);
		updatedPeriods.push({ month: iter, openingBalance: 0 });

		// Copiar movimientos recurrentes del mes previo al nuevo mes iterado
		const cloned = cloneRecurringForMonth(newTransactions, prevMonth, iter, prevSkipped);
		newTransactions = [...cloned, ...newTransactions];
		prevSkipped = [];
	}
	return { periods: updatedPeriods, transactions: newTransactions };
};

/** Años antes o después del actual dentro de los que un movimiento crea meses (como al migrar). */
const MONTH_CREATION_YEAR_SPAN = 10;

/**
 * Crea los meses que faltan para que todo movimiento caiga en un periodo y cuente.
 *
 * Los meses anteriores al primero (y los huecos intermedios) se añaden vacíos, sin clonar
 * recurrentes hacia atrás. Los posteriores al último se añaden uno a uno con los recurrentes del
 * mes previo. El saldo inicial de las cuentas sigue anclado en el mes con apertura manual: si
 * ninguno lo es y se añaden meses por delante, el antiguo primer mes pasa a serlo. Solo crea meses
 * dentro de diez años antes o después del actual, para que una fecha absurda no genere cientos.
 *
 * @param periods Lista actual de periodos
 * @param transactions Lista actual de transacciones
 * @returns Los mismos arrays si no falta ningún mes; si no, los actualizados sin mutar los originales
 */
export const ensurePeriodsForTransactions = (
	periods: Period[],
	transactions: Transaction[]
): { periods: Period[]; transactions: Transaction[] } => {
	if (periods.length === 0) {
		return { periods, transactions };
	}

	const currentYear = new Date().getFullYear();
	const minMonth = `${currentYear - MONTH_CREATION_YEAR_SPAN}-01`;
	const maxMonth = `${currentYear + MONTH_CREATION_YEAR_SPAN}-12`;
	const existing = new Set(periods.map((p) => p.month));
	const missing = new Set<string>();
	transactions.forEach((t) => {
		const month = t.date.substring(0, 7);
		if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month) && month >= minMonth && month <= maxMonth && !existing.has(month)) {
			missing.add(month);
		}
	});
	if (missing.size === 0) {
		return { periods, transactions };
	}

	const sortedMissing = [...missing].sort();
	const earliestMissing = sortedMissing[0];
	const latestMissing = sortedMissing[sortedMissing.length - 1];
	const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
	const firstMonth = sorted[0].month;
	const lastMonth = sorted[sorted.length - 1].month;
	const addsEarlierMonths = earliestMissing < firstMonth;
	const keepAnchor = addsEarlierMonths && !periods.some((p) => p.isManualInit);

	let updatedPeriods: Period[] = periods.map((p) =>
		keepAnchor && p.month === firstMonth ? { ...p, isManualInit: true } : p
	);
	const startMonth = addsEarlierMonths ? earliestMissing : firstMonth;
	for (let month = startMonth; month < lastMonth; month = addMonthsToMonth(month, 1)) {
		if (!existing.has(month)) {
			updatedPeriods.push({ month, openingBalance: 0 });
		}
	}

	let updatedTransactions = transactions;
	if (latestMissing > lastMonth) {
		const extended = appendMonthsWithRecurring(updatedPeriods, transactions, latestMissing);
		updatedPeriods = extended.periods;
		updatedTransactions = extended.transactions;
	}

	return {
		periods: updatedPeriods.sort((a, b) => a.month.localeCompare(b.month)),
		transactions: updatedTransactions
	};
};

export type ReconfigurePeriodsResult =
	| { ok: true; periods: Period[] }
	| { ok: false; reason: 'earlier-periods-exist'; firstMonth: string };

/**
 * Aplica «Configurar cuenta» a los periodos existentes sin descartar ninguno.
 *
 * El mes de inicio pasa a ser el único con apertura manual. Si es anterior al primero existente,
 * los meses intermedios se añaden vacíos (sin clonar recurrentes hacia atrás). Si es posterior, el
 * cambio se rechaza: dejaría meses y movimientos anteriores al inicio.
 *
 * @param periods Lista actual de periodos
 * @param targetMonth Mes de inicio elegido (YYYY-MM)
 * @param openingBalance Saldo de apertura manual del mes de inicio
 * @returns Los periodos resultantes ordenados por mes, o el motivo del rechazo
 */
export const reconfigurePeriods = (
	periods: Period[],
	targetMonth: string,
	openingBalance: number
): ReconfigurePeriodsResult => {
	const first: Period = { month: targetMonth, openingBalance, isManualInit: true };
	if (periods.length === 0) {
		return { ok: true, periods: [first] };
	}

	const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
	const firstMonth = sorted[0].month;
	if (targetMonth > firstMonth) {
		return { ok: false, reason: 'earlier-periods-exist', firstMonth };
	}
	if (targetMonth === firstMonth) {
		return { ok: true, periods: [first, ...sorted.slice(1)] };
	}

	const added: Period[] = [];
	for (let month = addMonthsToMonth(targetMonth, 1); month < firstMonth; month = addMonthsToMonth(month, 1)) {
		added.push({ month, openingBalance: 0 });
	}
	return {
		ok: true,
		periods: [first, ...added, { month: firstMonth, openingBalance: 0 }, ...sorted.slice(1)]
	};
};
