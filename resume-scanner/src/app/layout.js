export const metadata = {
  title: 'Resume-Scanner',
  description: 'open source resume scanner',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
