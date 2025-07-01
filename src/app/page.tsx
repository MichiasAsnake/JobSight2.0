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
    title: "Write a professional email",
    description: "Help me draft a business email",
  },
  {
    icon: <Lightbulb className="h-5 w-5" />,
    title: "Brainstorm ideas",
    description: "Generate creative ideas for my project",
  },
  {
    icon: <Code className="h-5 w-5" />,
    title: "Explain code",
    description: "Help me understand this code snippet",
  },
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: "Study help",
    description: "Explain a complex topic simply",
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
          <h1 className="text-xl font-bold">AI Assistant</h1>
        </div>
        <Button variant="ghost" onClick={() => router.push("/chat")}>
          View Chat History
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 py-8">
        <div className="w-full max-w-4xl mx-auto text-center space-y-8">
          {/* Hero Section */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              How can I help you today?
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Ask me anything. I'm here to help with writing, analysis, coding,
              and much more.
            </p>
          </div>

          {/* Big Input Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
            <div className="relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe what you need help with..."
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
              Popular questions
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
              AI Assistant can help with writing, analysis, coding, and more.
              Your conversations are private and secure.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
