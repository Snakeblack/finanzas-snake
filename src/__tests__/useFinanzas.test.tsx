import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFinanzas } from '../hooks/useFinanzas';
import { FinanzasProvider } from '../context/FinanzasContext';
import type { ReactNode } from 'react';

describe('useFinanzas', () => {
	it('debe lanzar un error si se usa fuera del FinanzasProvider', () => {
		// Suprimir el error de consola de React que se produce con el renderHook fallido
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		
		expect(() => {
			renderHook(() => useFinanzas());
		}).toThrow('useFinanzas debe ser utilizado dentro de un FinanzasProvider.');
		
		spy.mockRestore();
	});

	it('debe devolver el contexto cuando se usa dentro del FinanzasProvider', () => {
		const wrapper = ({ children }: { children: ReactNode }) => (
			<FinanzasProvider>{children}</FinanzasProvider>
		);

		const { result } = renderHook(() => useFinanzas(), { wrapper });

		expect(result.current).toBeDefined();
		expect(result.current.userAName).toBe('Usuario A');
		expect(result.current.accounts).toHaveLength(3);
		expect(typeof result.current.handleAddTransaction).toBe('function');
	});
});
