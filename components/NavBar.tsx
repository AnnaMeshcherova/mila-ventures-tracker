"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMentionBadge } from "@/components/MentionBadgeProvider";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dash" },
  { href: "/overview", label: "Overview", shortLabel: "Overview" },
  { href: "/submit", label: "Submit", shortLabel: "Submit" },
  { href: "/history", label: "History", shortLabel: "History" },
  { href: "/action-items", label: "Actions", shortLabel: "Actions" },
];

export function NavBar() {
  const pathname = usePathname();
  const { count } = useMentionBadge();

  // Don't show nav on auth pages or onboarding
  if (pathname?.startsWith("/auth") || pathname === "/onboarding") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 h-14 bg-card border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-6 md:gap-8">
          <Link href="/dashboard" className="text-lg font-bold tracking-tight">
            Mila Ventures
          </Link>
          <div className="flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors flex items-center",
                  pathname === link.href
                    ? "bg-background text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-background"
                )}
              >
                <span className="hidden md:inline">{link.label}</span>
                <span className="md:hidden">{link.shortLabel}</span>
                {link.href === "/action-items" && count > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-semibold">
            MV
          </div>
        </div>
      </div>
    </nav>
  );
}
