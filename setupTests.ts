import '@testing-library/jest-dom';
import { vi, beforeEach } from 'vitest';

// Mock de window.print
if (typeof window !== 'undefined') {
	window.print = vi.fn();
}

// Mock de window.confirm
if (typeof window !== 'undefined') {
	window.confirm = vi.fn(() => true);
}

// Mock de window.alert
if (typeof window !== 'undefined') {
	window.alert = vi.fn();
}

// Limpiar localStorage antes de cada prueba para evitar interferencias
beforeEach(() => {
	localStorage.clear();
});
