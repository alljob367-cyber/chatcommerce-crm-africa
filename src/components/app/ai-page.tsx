"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Send,
  Sparkles,
  Globe,
  Languages,
  Lightbulb,
  User,
  Zap,
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
}

export default function AIPage() {
  const { token } = useAppStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Bonjour ! Je suis l'assistant IA de ChatCommerce. Je peux vous aider à :\n\n" +
        "• Répondre automatiquement aux clients\n" +
        "• Qualifier les leads\n" +
        "• Proposer des suggestions intelligentes\n" +
        "• Supporter plusieurs langues (FR, EN, ES)\n\n" +
        "Essayez de m'envoyer un message comme le ferait un client !",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, language: "fr" }),
      });
      const data = await res.json();
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        category: data.category,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Désolé, une erreur est survenue. Veuillez réessayer." },
      ]);
    }
    setLoading(false);
  };

  const quickQuestions = [
    "Bonjour, je voudrais commander du Poulet DG",
    "Quel est votre menu ?",
    "Comment se fait la livraison ?",
    "Quels sont vos prix ?",
    "Quels sont vos horaires ?",
    "Comment puis-je payer ?",
  ];

  return (
    <>
      <Header title="Assistant IA" subtitle="Réponses automatiques intelligentes" />

      <div className="p-6 animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-160px)]">
          {/* Chat */}
          <div className="lg:col-span-2 flex flex-col">
            <Card className="flex-1 border-0 shadow-sm flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4">
                <div className="max-w-2xl mx-auto space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-[#0F172A] text-white rounded-br-sm"
                            : "bg-gray-50 text-gray-700 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                        {msg.category && msg.category !== "default" && (
                          <Badge variant="outline" className="mt-2 text-[9px]">
                            <Sparkles className="w-2.5 h-2.5 mr-1" />
                            {msg.category}
                          </Badge>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-gray-500" />
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-gray-100">
                <div className="flex gap-2 max-w-2xl mx-auto">
                  <Input
                    placeholder="Simulez une question client..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  />
                  <Button onClick={handleSend} disabled={loading || !input.trim()} className="bg-[#25D366] hover:bg-[#128C7E]">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2 mt-2 flex-wrap max-w-2xl mx-auto">
                  {quickQuestions.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="text-[11px] h-7"
                      onClick={() => { setInput(q); }}
                    >
                      {q.slice(0, 40)}...
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: Bot, title: "Réponse automatique", desc: "Répond instantanément aux questions fréquentes de vos clients 24/7.", color: "bg-green-50 text-green-600" },
              { icon: Lightbulb, title: "Qualification des leads", desc: "Analyse les besoins et qualifie automatiquement les prospects.", color: "bg-yellow-50 text-yellow-600" },
              { icon: Languages, title: "Multilingue", desc: "Français, Anglais, Espagnol - communiquez dans la langue de vos clients.", color: "bg-blue-50 text-blue-600" },
              { icon: Zap, title: "Suggestions intelligentes", desc: "Propose des produits et offres basés sur l'historique client.", color: "bg-purple-50 text-purple-600" },
              { icon: Globe, title: "Contexte africain", desc: "Optimisé pour le marché africain : Mobile Money, expressions locales, etc.", color: "bg-orange-50 text-orange-600" },
            ].map((feat) => (
              <Card key={feat.title} className="border-0 shadow-sm">
                <CardContent className="p-4 flex gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${feat.color} shrink-0`}>
                    <feat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#0F172A]">{feat.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{feat.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}