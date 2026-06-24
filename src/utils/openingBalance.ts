export const parseOpeningBalanceInput = (value: number | string): number => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : 0;
	}

	const trimmedValue = value.trim();
	if (trimmedValue === '') {
		return 0;
	}

	const parsedValue = Number(trimmedValue);
	return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
};
