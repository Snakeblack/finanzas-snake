/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './main.tsx', './src/**/*.{js,ts,jsx,tsx}'],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"Plus Jakarta Sans"', 'sans-serif'],
				heading: ['"Outfit"', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				slate: {
					50: 'hsl(var(--slate-50) / <alpha-value>)',
					100: 'hsl(var(--slate-100) / <alpha-value>)',
					200: 'hsl(var(--slate-200) / <alpha-value>)',
					300: 'hsl(var(--slate-300) / <alpha-value>)',
					350: 'hsl(var(--slate-350) / <alpha-value>)',
					400: 'hsl(var(--slate-400) / <alpha-value>)',
					450: 'hsl(var(--slate-450) / <alpha-value>)',
					500: 'hsl(var(--slate-500) / <alpha-value>)',
					600: 'hsl(var(--slate-600) / <alpha-value>)',
					700: 'hsl(var(--slate-700) / <alpha-value>)',
					750: 'hsl(var(--slate-750) / <alpha-value>)',
					755: 'hsl(var(--slate-750) / <alpha-value>)',
					800: 'hsl(var(--slate-800) / <alpha-value>)',
					850: 'hsl(var(--slate-850) / <alpha-value>)',
					900: 'hsl(var(--slate-900) / <alpha-value>)',
					955: 'hsl(var(--slate-950) / <alpha-value>)', // Add 955 as alias just in case, but standard is 950
					950: 'hsl(var(--slate-950) / <alpha-value>)'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require('tailwindcss-animate')]
};
