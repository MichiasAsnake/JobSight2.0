"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Sparkles,
  MessageCircle,
  Lightbulb,
  Code,
  BookOpen,
} from "lucide-react";

const commonQuestions = [
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: "Order Status",
    description: "Show me recent orders and their status",
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    title: "Rush Orders",
    description: "Show me all rush and priority orders",
  },
  {
    icon: <Code className="h-5 w-5" />,
    title: "Customer Info",
    description: "Show me customer information and order history",
  },
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: "Order Statistics",
    description: "Give me an overview of order statistics",
  },
];

export default function Home() {
  const [input, setInput] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      // Navigate to chat page with the input as initial message
      router.push(`/chat?message=${encodeURIComponent(input.trim())}`);
    }
  };

  const handleQuestionClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">OMS AI Assistant</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/data")}>
            Data Management
          </Button>
          <Button variant="ghost" onClick={() => router.push("/chat")}>
            View Chat History
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8">
        <div className="w-full max-w-4xl mx-auto text-center space-y-8">
          {/* Hero Section */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              How can I help with your orders?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ask me about orders, customers, rush jobs, or get insights from
              your OMS data.
            </p>
          </div>

          {/* Big Input Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about orders, customers, or get OMS insights..."
                className="min-h-[120px] text-lg p-6 pr-16 resize-none border-2 focus:border-primary/50 transition-colors"
                style={{ minHeight: "120px" }}
              />
              <Button
                type="submit"
                disabled={!input.trim()}
                size="icon"
                className="absolute bottom-4 right-4 h-12 w-12"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </form>

          {/* Common Questions */}
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Quick OMS Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {commonQuestions.map((question, index) => (
                <button
                  key={index}
                  onClick={() => handleQuestionClick(question.description)}
                  className="group p-4 text-left border rounded-lg hover:border-primary/50 hover:bg-muted/50 transition-all duration-200 hover:scale-[1.02]"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-muted-foreground group-hover:text-primary transition-colors">
                      {question.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {question.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {question.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Info */}
          <div className="text-sm text-muted-foreground max-w-2xl mx-auto">
            <p>
              OMS AI Assistant can help with order management, customer
              insights, and data analysis. Your conversations are private and
              secure.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
