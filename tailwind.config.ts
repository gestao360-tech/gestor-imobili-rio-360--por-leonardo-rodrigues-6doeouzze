/* Tailwind config for the frontend react app. This is where the app theme should be defined: https://v2.tailwindcss.com/docs/configuration. */
import type { Config } from 'tailwindcss'
import animatePlugin from 'tailwindcss-animate'
import typographyPlugin from '@tailwindcss/typography'
import aspectRatioPlugin from '@tailwindcss/aspect-ratio'

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter var', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter var', 'system-ui', 'sans-serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
        navy: {
          DEFAULT: '#06182B',
          deep: '#06182B',
          secondary: '#102B46',
          surface: '#153655',
          light: '#1B456E',
          border: 'rgba(212, 163, 71, 0.18)',
        },
        gold: {
          DEFAULT: '#D4A347',
          metallic: '#D4A347',
          luminous: '#FFD477',
          dark: '#98601F',
          bronze: '#86521D',
          light: '#FFF0B2',
          muted: '#C49438',
        },
        orange: {
          DEFAULT: '#F15A24',
          brand: '#F15A24',
          hover: '#D94916',
          light: '#FF7A47',
        },
        brand: {
          DEFAULT: '#F15A24',
          navy: '#06182B',
          secondary: '#102B46',
          gold: '#D4A347',
          goldLight: '#FFD477',
          orange: '#F15A24',
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #F15A24 0%, #D4A347 100%)',
        'gradient-brand-subtle':
          'linear-gradient(135deg, rgba(241, 90, 36, 0.12) 0%, rgba(212, 163, 71, 0.10) 100%)',
        'gradient-gold': 'linear-gradient(135deg, #FFD477 0%, #D4A347 50%, #98601F 100%)',
        'gradient-gold-metallic': 'linear-gradient(135deg, #FFF0B2 0%, #D4A347 60%, #86521D 100%)',
        'gradient-radial-brand':
          'radial-gradient(circle at top right, rgba(212, 163, 71, 0.18), transparent 60%)',
        'gradient-sidebar': 'linear-gradient(180deg, #102B46 0%, #06182B 100%)',
        'gradient-card-dark': 'linear-gradient(180deg, #102B46 0%, #092036 100%)',
        'gradient-emerald': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-amber': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-rose': 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
        'gradient-sky': 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      },
      boxShadow: {
        'glow-brand': '0 0 24px -4px rgba(241, 90, 36, 0.40)',
        'glow-brand-lg': '0 0 36px -6px rgba(241, 90, 36, 0.50)',
        'glow-gold': '0 0 24px -4px rgba(212, 163, 71, 0.40)',
        'glow-gold-lg': '0 0 36px -6px rgba(255, 212, 119, 0.45)',
        'glow-emerald': '0 0 20px -4px rgba(16, 185, 129, 0.35)',
        'glow-amber': '0 0 20px -4px rgba(245, 158, 11, 0.35)',
        'glow-rose': '0 0 20px -4px rgba(244, 63, 94, 0.35)',
        'glow-card': '0 10px 30px -10px rgba(6, 24, 43, 0.08)',
        'glow-card-dark': '0 10px 30px -10px rgba(0, 0, 0, 0.6)',
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        elevation: '0 4px 20px rgba(0, 0, 0, 0.05)',
        soft: '0 4px 24px -6px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.06)',
        lifted: '0 18px 45px -14px rgba(15, 23, 42, 0.22), 0 4px 12px -4px rgba(15, 23, 42, 0.08)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 6px)',
        xl: 'calc(var(--radius) + 0.25rem)',
        '2xl': 'calc(var(--radius) + 0.75rem)',
      },
      transitionProperty: {
        width: 'width',
        height: 'height',
      },
      keyframes: {
        'scale-in': {
          from: { transform: 'scale(0.96)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'scale-in': 'scale-in 0.25s cubic-bezier(0.42, 0, 0.58, 1)',
      },
      transitionTimingFunction: {
        apple: 'cubic-bezier(0.42, 0, 0.58, 1)',
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
    },
  },
  plugins: [animatePlugin, typographyPlugin, aspectRatioPlugin],
} satisfies Config
