import type { Metadata } from "next";
import "./globals.css";

import { SidebarLayout } from "@/components/sidebar-layout";
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from "@/components/sidebar";
import {
  HouseIcon,
  BookUserIcon,
  CalendarDaysIcon,
  NotebookTextIcon,
  ReceiptIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  title: "스프",
  description: "과외 일정 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" style={{ height: "100%" }}>
      <body style={{ height: "100%" }}>
        <SidebarLayout
          navbar={<>메뉴</>}
          sidebar={
            <Sidebar>
              <SidebarHeader>스프</SidebarHeader>
              <SidebarBody>
                <SidebarSection>
                  <SidebarItem href="/">
                    <HouseIcon
                      data-slot="icon"
                      style={{ fill: "transparent" }}
                    />
                    <span>메인</span>
                  </SidebarItem>

                  <SidebarItem href="/students">
                    <BookUserIcon
                      data-slot="icon"
                      style={{ fill: "transparent" }}
                    />
                    <span className="truncate">수강생</span>
                  </SidebarItem>

                  <SidebarItem href="/syllabuses">
                    <NotebookTextIcon
                        data-slot="icon"
                        style={{ fill: "transparent" }}
                    />
                    <span>계획</span>
                  </SidebarItem>

                  <SidebarItem href="/lessons">
                    <CalendarDaysIcon
                      data-slot="icon"
                      style={{ fill: "transparent" }}
                    />
                    <span>수업</span>
                  </SidebarItem>

                  <SidebarItem href="/payments">
                    <ReceiptIcon
                      data-slot="icon"
                      style={{ fill: "transparent" }}
                    />
                    <span>입금내역</span>
                  </SidebarItem>

                  <SidebarItem href="/meetings">
                    <UserRoundCheckIcon
                      data-slot="icon"
                      style={{ fill: "transparent" }}
                    />
                    <span className="truncate">상담</span>
                  </SidebarItem>
                </SidebarSection>
              </SidebarBody>
            </Sidebar>
          }
        >
          {children}
        </SidebarLayout>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
