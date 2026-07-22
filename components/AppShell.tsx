"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AnimeRuntime from "./AnimeRuntime";
import AppBreadcrumbs from "./AppBreadcrumbs";
import AppToast from "./AppToast";
import ClientRouteRecovery from "./ClientRouteRecovery";
import MobileNav from "./MobileNav";
import Navbar from "./Navbar";
import ThemeToggle from "./ThemeToggle";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/logout");

  return (
    <>
      <ThemeToggle />
      {!isAuthPage && <Navbar />}
      {!isAuthPage && <AppBreadcrumbs />}
      <div className={isAuthPage ? "min-w-0 flex-1" : "app-desktop-content min-w-0 flex-1"}>
        {children}
      </div>
      {!isAuthPage && <MobileNav />}
      <AppToast />
      <AnimeRuntime />
      <ClientRouteRecovery />
    </>
  );
}
