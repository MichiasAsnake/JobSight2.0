"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChatInput } from "../components/chat-input";
import { Button } from "@/components/ui/button";
import { useLayout } from "../components/layout-wrapper";
import { useChat } from "../components/chat-context";

export default function ChatPage() {
  const [isLoading, setIsLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const hasInitialized = useRef(false);
  const { setSidebarOpen } = useLayout();
  const { getCurrentChat, addMessage, currentChatId } = useChat();

  const currentChat = getCurrentChat();

  // Handle initial message from URL parameter
  useEffect(() => {
    const initialMessage = searchParams.get("message");
    if (initialMessage && !hasInitialized.current) {
      hasInitialized.current = true;
      handleSendMessage(initialMessage);
    }
  }, [searchParams]);

  const handleSendMessage = async (content: string) => {
    const userMessage = {
      id: Date.now().toString(),
      content,
      role: "user" as const,
      timestamp: new Date(),
    };

    addMessage(currentChatId, userMessage);
    setIsLoading(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: `I received your message: "${content}". This is a simulated response.`,
        role: "assistant" as const,
        timestamp: new Date(),
      };

      addMessage(currentChatId, assistantMessage);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <header className="border-b p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {currentChat?.title || "Chat Assistant"}
        </h1>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Back to Home
        </Button>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentChat?.messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder="Type your message here..."
      />
    </div>
  );
}
