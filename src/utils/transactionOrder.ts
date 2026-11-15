import type { Transaction } from '../types';

/**
 * Ordena movimientos para mostrarlos: primero los días más recientes y, dentro de un día, el orden
 * elegido a mano. Los que nadie ha ordenado van antes y conservan su orden de llegada.
 *
 * @param transactions Movimientos a ordenar; no se modifica
 */
export const sortForDisplay = (transactions: Transaction[]): Transaction[] => {
	return [...transactions].sort((a, b) => {
		const dateCompare = b.date.localeCompare(a.date);
		if (dateCompare !== 0) return dateCompare;
		return (a.sortIndex ?? -1) - (b.sortIndex ?? -1);
	});
};

/**
 * Mueve un movimiento a la posición de otro del mismo día y guarda el orden resultante de ese día
 * en `sortIndex`, para que sobreviva a guardar y recargar.
 *
 * @returns La lista con el orden nuevo, o la misma lista si no hay nada que mover
 */
export const moveWithinDay = (transactions: Transaction[], draggedId: string, targetId: string): Transaction[] => {
	if (draggedId === targetId) return transactions;
	const dragged = transactions.find((t) => t.id === draggedId);
	const target = transactions.find((t) => t.id === targetId);
	if (!dragged || !target || dragged.date !== target.date) return transactions;

	const dayIds = sortForDisplay(transactions.filter((t) => t.date === dragged.date)).map((t) => t.id);
	const targetPosition = dayIds.indexOf(targetId);
	dayIds.splice(dayIds.indexOf(draggedId), 1);
	dayIds.splice(targetPosition, 0, draggedId);
	const position = new Map(dayIds.map((id, index) => [id, index]));

	return transactions.map((t) => {
		const sortIndex = position.get(t.id);
		return sortIndex === undefined || sortIndex === t.sortIndex ? t : { ...t, sortIndex };
	});
};
