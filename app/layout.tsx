import "./globals.css";

export const metadata = {
  title: "SacTech Community",
  description: "The Sacramento technology community",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
