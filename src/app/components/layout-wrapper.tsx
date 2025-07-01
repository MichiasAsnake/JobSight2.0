"use client";

import { useState, createContext, useContext } from "react";
import { Sidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useChat } from "./chat-context";

interface LayoutContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutWrapper");
  }
  return context;
}

interface LayoutWrapperProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function LayoutWrapper({
  children,
  showSidebar = false,
}: LayoutWrapperProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { chats, currentChatId, setCurrentChatId, addChat, deleteChat } =
    useChat();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const contextValue: LayoutContextType = {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
  };

  const handleNewChat = () => {
    const newChatId = Date.now().toString();
    const newChat = {
      id: newChatId,
      messages: [
        {
          id: "1",
          content: "Hello! How can I help you today?",
          role: "assistant" as const,
          timestamp: new Date(),
        },
      ],
      title: "New Chat",
      timestamp: new Date(),
    };

    addChat(newChat);
    setCurrentChatId(newChatId);
    setSidebarOpen(false); // Close sidebar on mobile
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setSidebarOpen(false); // Close sidebar on mobile
  };

  const handleDeleteChat = (chatId: string) => {
    deleteChat(chatId);
  };

  // Convert chats to sidebar format
  const chatHistory = chats.map((chat) => ({
    id: chat.id,
    title: chat.title,
    timestamp: chat.timestamp,
    preview:
      chat.messages.length > 1
        ? chat.messages[1]?.content.slice(0, 50) + "..."
        : "New conversation",
  }));

  return (
    <LayoutContext.Provider value={contextValue}>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        {showSidebar && (
          <div
            className={`${
              sidebarOpen ? "block" : "hidden"
            } md:block transition-all duration-300`}
          >
            <Sidebar
              onNewChat={handleNewChat}
              onSelectChat={handleSelectChat}
              onDeleteChat={handleDeleteChat}
              selectedChatId={currentChatId}
              chatHistory={chatHistory}
            />
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header with sidebar toggle */}
          {showSidebar && (
            <header className="border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="md:hidden"
                >
                  {sidebarOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </header>
          )}

          {/* Page Content */}
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </div>
    </LayoutContext.Provider>
  );
}
