"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OMSChatInput } from "../components/oms-chat-input";
import { OMSMessage } from "../components/oms-message";
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

    try {
      // Call OMS chat API
      const response = await fetch("/api/oms-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          context: currentChat?.messages
            .slice(-3)
            .map((m) => m.content)
            .join(" | "),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response from OMS API");
      }

      const data = await response.json();

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        role: "assistant" as const,
        timestamp: new Date(data.timestamp),
      };

      addMessage(currentChatId, assistantMessage);
    } catch (error) {
      console.error("Error sending message:", error);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content:
          "Sorry, I'm having trouble accessing the OMS data right now. Please try again later.",
        role: "assistant" as const,
        timestamp: new Date(),
      };

      addMessage(currentChatId, errorMessage);
    } finally {
      setIsLoading(false);
    }
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
          <OMSMessage
            key={message.id}
            content={message.content}
            isUser={message.role === "user"}
            timestamp={message.timestamp.toISOString()}
          />
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
      <OMSChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
}
