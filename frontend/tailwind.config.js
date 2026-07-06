export default {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            colors: {
                background: '#020617',
                surface: '#0F172A',
                card: '#1E293B',
                primary: '#7C3AED',
                secondary: '#3B82F6',
                text: '#F8FAFC',
                muted: '#94A3B8',
            },
            boxShadow: {
                glow: '0 0 0 1px rgba(124, 58, 237, 0.2), 0 24px 80px rgba(15, 23, 42, 0.65)',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                fadeUp: {
                    '0%': { opacity: '0', transform: 'translateY(18px)' },
                    '100%': { opacity: '1', transform: 'translateY(0px)' },
                },
                drift: {
                    '0%, 100%': { transform: 'translate(0px, 0px)' },
                    '50%': { transform: 'translate(18px, -12px)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '0% 50%' },
                    '100%': { backgroundPosition: '200% 50%' },
                },
            },
            animation: {
                float: 'float 8s ease-in-out infinite',
                'fade-up': 'fadeUp 0.7s ease-out both',
                drift: 'drift 10s ease-in-out infinite',
                shimmer: 'shimmer 8s linear infinite',
            },
        },
    },
    plugins: [],
};
