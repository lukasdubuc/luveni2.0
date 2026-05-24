export function SiteShell({ 
  children, 
  footerDescription, 
  theme = "light" 
}: { 
  children: ReactNode; 
  footerDescription?: string; 
  theme?: "light" | "dark" 
}) {
  return (
    // Removed transition-colors duration-200
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header theme={theme} />
      <main className="w-full flex-1">
        {children}
      </main>
      <Footer description={footerDescription} theme={theme} />
    </div>
  );
}
