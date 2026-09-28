"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Library" },
  { href: "/ingest", label: "Add paper" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = pathname.startsWith("/papers/");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <Image
              src="/paper-lens-icon.png"
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-lg"
              unoptimized
            />
            <span className="font-serif text-lg">Paper Lens</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm" aria-label="Primary">
            {LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-full px-3 py-1.5",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main id="content" className={workspace ? "h-[calc(100dvh-3.5rem)] overflow-hidden" : undefined}>
        {children}
      </main>
    </div>
  );
}
