"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, KeyRound, FileText, MessageSquare, Wallet, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortalNav({ token, cityName }: { token: string; cityName: string }) {
  const pathname = usePathname();
  const base = `/portal/${token}`;
  const items = [
    { href: base, label: "Home", icon: Home },
    { href: `${base}/home`, label: "Your home", icon: KeyRound },
    { href: `${base}/documents`, label: "Documents", icon: FileText },
    { href: `${base}/messages`, label: "Messages", icon: MessageSquare },
    { href: `${base}/costs`, label: "Costs", icon: Wallet },
  ];
  const isActive = (href: string) => (href === base ? pathname === base : pathname.startsWith(href));

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2 text-brand">
            <Compass className="size-5" />
            <span className="text-sm font-semibold text-foreground">QuickMove</span>
          </div>
          <span className="text-xs text-muted-foreground">Your move to {cityName}</span>
        </div>
        {/* Desktop inline nav */}
        <nav className="mx-auto hidden max-w-2xl gap-1 px-3 pb-2 sm:flex">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                isActive(href) ? "bg-brand-muted text-brand" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                isActive(href) ? "text-brand" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", isActive(href) && "text-brand")} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
