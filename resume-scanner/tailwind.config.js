/** @type {import('tailwindcss').Config} */
module.exports = {

    content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#0070f3',
                    dark: '#0050b3',
                }

                ,
                secondary: {
                    DEFAULT: '#f5f5f5',
                    dark: '#333333',
                }

                ,
            }

            ,
        }

        ,
    }

    ,
    plugins: [],
    darkMode: 'media',
}