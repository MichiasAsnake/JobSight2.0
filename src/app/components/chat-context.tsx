"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

interface Chat {
  id: string;
  messages: Message[];
  title: string;
  timestamp: Date;
}

interface ChatContextType {
  chats: Chat[];
  currentChatId: string;
  setCurrentChatId: (id: string) => void;
  addChat: (chat: Chat) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  deleteChat: (chatId: string) => void;
  addMessage: (chatId: string, message: Message) => void;
  getCurrentChat: () => Chat | undefined;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [chats, setChats] = useState<Chat[]>([
    {
      id: "current",
      messages: [
        {
          id: "1",
          content: "Hello! How can I help you today?",
          role: "assistant",
          timestamp: new Date(),
        },
      ],
      title: "New Chat",
      timestamp: new Date(),
    },
  ]);
  const [currentChatId, setCurrentChatId] = useState("current");

  const addChat = (chat: Chat) => {
    setChats((prev) => [...prev, chat]);
  };

  const updateChat = (chatId: string, updates: Partial<Chat>) => {
    setChats((prev) =>
      prev.map((chat) => (chat.id === chatId ? { ...chat, ...updates } : chat))
    );
  };

  const deleteChat = (chatId: string) => {
    setChats((prev) => prev.filter((chat) => chat.id !== chatId));
    if (currentChatId === chatId) {
      const remainingChats = chats.filter((chat) => chat.id !== chatId);
      if (remainingChats.length > 0) {
        setCurrentChatId(remainingChats[0].id);
      } else {
        // Create a new chat if all are deleted
        const newChat: Chat = {
          id: Date.now().toString(),
          messages: [
            {
              id: "1",
              content: "Hello! How can I help you today?",
              role: "assistant",
              timestamp: new Date(),
            },
          ],
          title: "New Chat",
          timestamp: new Date(),
        };
        addChat(newChat);
        setCurrentChatId(newChat.id);
      }
    }
  };

  const addMessage = (chatId: string, message: Message) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, message],
              title:
                chat.messages.length === 1
                  ? message.content.slice(0, 50) + "..."
                  : chat.title,
            }
          : chat
      )
    );
  };

  const getCurrentChat = () => {
    return chats.find((chat) => chat.id === currentChatId);
  };

  const value: ChatContextType = {
    chats,
    currentChatId,
    setCurrentChatId,
    addChat,
    updateChat,
    deleteChat,
    addMessage,
    getCurrentChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
