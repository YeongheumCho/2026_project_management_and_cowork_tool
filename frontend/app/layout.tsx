import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ChatBot from "./components/ChatBot";
import { WorkflowSelectionProvider } from "./lib/workflow-selection";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WorkflowSelectionProvider>
          {children}
          <ChatBot />
        </WorkflowSelectionProvider>
      </body>
    </html>
  );
}
