/** @type {import('tailwindcss').Config} */
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                cream: {
                    light: '#fff8d6',
                    DEFAULT: '#fef8cd',
                    dark: '#f0e9be',
                },
                brown: {
                    light: '#c9aa80',
                    DEFAULT: '#b89974',
                    dark: '#9e8364',
                },
                primary: {
                    light: '#c9aa80',
                    DEFAULT: '#b89974',
                    dark: '#9e8364',
                },
                secondary: {
                    light: '#fff8d6',
                    DEFAULT: '#fef8cd',
                    dark: '#f0e9be',
                },
                text: {
                    DEFAULT: '#333333',
                    light: '#666666',
                }
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
    darkMode: 'class',
}