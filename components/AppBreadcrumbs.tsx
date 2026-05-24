"use client";

import { getBreadcrumbs, getRouteMeta } from "@/lib/navigation";
import { getPageTheme } from "@/lib/pageThemes";
import { useDashboardAccent } from "@/lib/useDashboardAccent";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NavIcon from "./NavIcon";

export default function AppBreadcrumbs() {
  const pathname = usePathname();
  const dashboardAccent = useDashboardAccent();
  const theme = getPageTheme(pathname, dashboardAccent);
  const breadcrumbs = getBreadcrumbs(pathname);
  const meta = getRouteMeta(pathname);

  if (breadcrumbs.length === 0 || pathname.startsWith("/chat")) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[4.25rem] z-20 hidden px-5 md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <nav
          className="app-glass pointer-events-auto flex max-w-full items-center gap-1 rounded-full px-2 py-1 text-xs font-black"
          style={{ color: theme.accent }}
          aria-label="Путь страницы"
        >
          <Link href="/" className="ui-pressable rounded-full px-2 py-1 opacity-70 hover:opacity-100">
            Главная
          </Link>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.href} className="flex items-center gap-1">
              <span className="opacity-35">/</span>
              {crumb.current ? (
                <span className="max-w-36 truncate rounded-full bg-white/55 px-2 py-1 shadow-inner dark:bg-white/10">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="ui-pressable max-w-32 truncate rounded-full px-2 py-1 opacity-70 hover:opacity-100"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <div
          className="app-glass pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black"
          style={{ color: theme.accent }}
        >
          <NavIcon name={meta.icon} className="h-7 w-7" />
          <span className="min-w-0">
            <span className="block truncate">{meta.label}</span>
            <span className="block truncate text-[10px] font-bold opacity-55">
              {meta.description}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
