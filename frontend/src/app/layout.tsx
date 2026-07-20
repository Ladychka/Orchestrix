import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'AI Employee Dashboard',
  description: 'Monitor AI Finance Officer tasks',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans min-h-screen bg-page antialiased`}>
        <nav className="bg-card border-b border-border sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-heading tracking-tight">AI Employee Dashboard</h1>
            <span className="text-xs text-muted">AI Finance Officer MVP</span>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto p-6 sm:p-8">{children}</main>
      </body>
    </html>
  );
}
