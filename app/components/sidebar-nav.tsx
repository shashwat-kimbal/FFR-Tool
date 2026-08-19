"use client";

import { usePathname } from "next/navigation";
import { BookOpenCheck, ListChecks, Settings, Upload, type LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  match: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Cases",
    icon: Upload,
    description: "Register-first workflow",
    match: (pathname) => pathname === "/" || pathname.startsWith("/cases"),
  },
  {
    href: "/rules",
    label: "Rule library",
    icon: BookOpenCheck,
    description: "60 editable provisional checks",
    match: (pathname) => pathname.startsWith("/rules"),
  },
  {
    href: "/governance",
    label: "Governance",
    icon: ListChecks,
    description: "Release and evidence controls",
    match: (pathname) => pathname.startsWith("/governance"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    description: "Shared profiles and mappings",
    match: (pathname) => pathname.startsWith("/settings"),
  },
];

export function SidebarNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.match(pathname);
        return (
          <a
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? "active" : ""}
          >
            <Icon size={18} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </span>
          </a>
        );
      })}
    </nav>
  );
}
