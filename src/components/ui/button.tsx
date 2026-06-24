import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
	'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
	{
		variants: {
			variant: {
				default: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10 hover:bg-indigo-500',
				destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
				outline: 'border border-slate-800 bg-slate-950 text-slate-350 hover:bg-slate-900 hover:text-white',
				secondary: 'bg-slate-800 text-slate-200 hover:bg-slate-750 hover:text-white',
				ghost: 'hover:bg-slate-900 hover:text-white text-slate-400',
				link: 'text-indigo-400 underline-offset-4 hover:underline'
			},
			size: {
				default: 'h-11 px-4 py-2.5',
				sm: 'h-9 rounded-lg px-3 text-xs',
				lg: 'h-12 rounded-2xl px-8',
				icon: 'h-10 w-10 rounded-lg'
			}
		},
		defaultVariants: {
			variant: 'default',
			size: 'default'
		}
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : 'button';
		return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
	}
);
Button.displayName = 'Button';

export { Button, buttonVariants };
