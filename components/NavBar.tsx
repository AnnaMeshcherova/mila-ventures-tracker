"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useMentionBadge } from "@/components/MentionBadgeProvider";

const navLinks = [
  { href: "/overview", label: "Overview", shortLabel: "Overview" },
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dash" },
  { href: "/history", label: "History", shortLabel: "History" },
  { href: "/action-items", label: "Actions", shortLabel: "Actions" },
];

export function NavBar() {
  const pathname = usePathname();
  const { count } = useMentionBadge();

  if (pathname?.startsWith("/auth") || pathname === "/onboarding") {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 h-14 bg-card border-b border-border">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-full flex items-center justify-between">
        <div className="flex items-center gap-6 md:gap-8">
          <Link href="/overview" className="text-lg font-bold tracking-tight">
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
        <Link
          href="/submit"
          className={cn(
            "px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors",
            pathname === "/submit"
              ? "bg-primary text-primary-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          Submit
        </Link>
      </div>
    </nav>
  );
}
