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
      <body className="min-h-screen">
        <nav className="bg-white border-b px-6 py-4">
          <h1 className="text-xl font-bold">AI Employee Dashboard</h1>
        </nav>
        <main className="max-w-5xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}
