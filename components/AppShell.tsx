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
  const isFullScreenChat = pathname === "/chat" || pathname.startsWith("/questions/discussion");
  const hideAppChrome = isAuthPage || isFullScreenChat;

  return (
    <>
      {!isFullScreenChat && <ThemeToggle />}
      <VisualViewportInsets />
      {!isAuthPage && <CouplePresenceTracker />}
      {!isAuthPage && (!isFullScreenChat || pathname === "/chat") && <div className="hidden lg:block"><Navbar /></div>}
      {!hideAppChrome && <AppBreadcrumbs />}
      <div className={isAuthPage || isFullScreenChat ? `min-w-0 flex-1 ${pathname === "/chat" ? "lg:pl-[5.25rem] 2xl:pl-[14.25rem]" : ""}` : "app-desktop-content min-w-0 flex-1"}>
        {children}
      </div>
      {!hideAppChrome && <MobileNav />}
      <AppToast />
      <AnimeRuntime />
      <ClientRouteRecovery />
    </>
  );
}
