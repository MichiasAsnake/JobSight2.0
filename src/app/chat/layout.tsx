"use client";

import { LayoutWrapper } from "../components/layout-wrapper";

interface ChatLayoutProps {
  children: React.ReactNode;
}

export default function ChatLayout({ children }: ChatLayoutProps) {
  return <LayoutWrapper showSidebar={true}>{children}</LayoutWrapper>;
}
