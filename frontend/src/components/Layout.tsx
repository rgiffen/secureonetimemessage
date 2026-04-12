import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-on-background font-body">
      <nav className="flex justify-center items-center py-8 w-full max-w-[560px] mx-auto px-6">
        <div className="flex items-center justify-between w-full">
          <Link
            to="/"
            className="text-xl font-bold tracking-tighter hover:text-primary transition-colors"
          >
            SecureDrop
          </Link>
          <div className="font-label text-[0.7rem] uppercase tracking-[0.1em] text-outline">
            One-time secure transfer
          </div>
        </div>
      </nav>
      <main className="w-full max-w-[560px] mx-auto px-6 mt-12 pb-24">{children}</main>
      <footer className="mt-16 pb-12 flex flex-col items-center gap-4 w-full max-w-[560px] mx-auto px-6 font-label text-[0.75rem] uppercase tracking-[0.05em]">
        <Link to="/" className="text-outline-variant hover:text-primary transition-colors">
          Home
        </Link>
        <div className="text-outline-variant/70 mt-4">© SecureDrop. The Architecture of Trust.</div>
      </footer>
    </div>
  );
}
