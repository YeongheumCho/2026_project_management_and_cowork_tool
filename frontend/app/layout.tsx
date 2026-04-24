import type { Metadata } from "next";
import "./globals.css";
import ChatBot from "./components/ChatBot";
import { WorkflowSelectionProvider } from "./lib/workflow-selection";

export const metadata: Metadata = {
  title: "KPI Tool - 프로젝트 관리 & 협업",
  description: "사내 업무 협업 및 프로젝트 관리 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <WorkflowSelectionProvider>
          {children}
          <ChatBot />
        </WorkflowSelectionProvider>
      </body>
    </html>
  );
}
