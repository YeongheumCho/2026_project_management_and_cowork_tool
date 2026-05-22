import type { Metadata } from "next";
import "./globals.css";
import ChatBot from "./components/ChatBot";
import { WorkflowSelectionProvider } from "./lib/workflow-selection";

export const metadata: Metadata = {
  title: "SureLog AI",
  description: "SureLog AI project management and collaboration tool",
  icons: {
    icon: [{ url: "/favicon.ico?v=20260522", type: "image/x-icon" }],
    shortcut: "/favicon.ico?v=20260522",
  },
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
