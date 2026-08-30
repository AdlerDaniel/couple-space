"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AnimeRuntime from "./AnimeRuntime";
import AppBreadcrumbs from "./AppBreadcrumbs";
import AppToast from "./AppToast";
import ClientRouteRecovery from "./ClientRouteRecovery";
import CouplePresenceTracker from "./CouplePresenceTracker";
import MobileNav from "./MobileNav";
import Navbar from "./Navbar";
import ThemeToggle from "./ThemeToggle";
import VisualViewportInsets from "./VisualViewportInsets";

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/logout");
  const isDiscussionPage = pathname.startsWith("/questions/discussion");
  const hideAppChrome = isAuthPage || isDiscussionPage;

  return (
    <>
      {!isDiscussionPage && <ThemeToggle />}
      <VisualViewportInsets />
      {!isAuthPage && <CouplePresenceTracker />}
      {!isAuthPage && !isDiscussionPage && <div className="hidden lg:block"><Navbar /></div>}
      {!hideAppChrome && <AppBreadcrumbs />}
      <div className={isAuthPage || isDiscussionPage ? "min-w-0 flex-1" : "app-desktop-content min-w-0 flex-1"}>
        {children}
      </div>
      {!hideAppChrome && <MobileNav />}
      <AppToast />
      <AnimeRuntime />
      <ClientRouteRecovery />
    </>
  );
}
