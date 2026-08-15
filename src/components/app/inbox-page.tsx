"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Send,
  Phone,
  UserCircle,
  MoreVertical,
  MessageCircle,
  ArrowLeft,
  Tag,
  Clock,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ContactInfo { id: string; name: string; phone: string; avatar?: string; tags?: string }
interface AssignedInfo { id: string; name: string; avatar?: string }
interface MsgInfo { id: string; body: string; direction: string; senderType: string; isRead: boolean; createdAt: string }

interface Conversation {
  id: string;
  status: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  contact: ContactInfo;
  assignedTo?: AssignedInfo;
  messages?: MsgInfo[];
}

export default function InboxPage() {
  const { token, user } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MsgInfo[]>([]);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedRef = useRef<Conversation | null>(null);

  const fetchConversations = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/conversations?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setConversations(d.conversations || []);
        if (d.conversations?.length > 0 && !selectedRef.current) {
          const first = d.conversations[0];
          setSelected(first);
          selectedRef.current = first;
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, statusFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (!selected || !token) return;
    fetch(`/api/conversations/messages?conversationId=${selected.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []))
      .catch(() => {});
  }, [selected, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!reply.trim() || !token || !selected) return;
    setSending(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: selected.contact.id, message: reply }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
          setReply("");
        }
      }
    } catch {}
    setSending(false);
  };

  const handleStatusChange = async (convId: string, status: string) => {
    if (!token) return;
    try {
      await fetch("/api/conversations", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: convId, status }),
      });
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, status } : c));
      if (selected?.id === convId) setSelected((prev) => prev ? { ...prev, status } : prev);
    } catch {}
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
  };

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
    open: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    waiting: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
    closed: "bg-muted text-muted-foreground",
  };
  const statusLabels: Record<string, string> = {
    new: "Nouveau",
    open: "Ouvert",
    waiting: "En attente",
    closed: "Fermé",
  };

  const filtered = conversations.filter((c) =>
    search === "" || c.contact.name.toLowerCase().includes(search.toLowerCase()) || c.contact.phone.includes(search)
  );

  return (
    <>
      <Header title="Inbox WhatsApp" subtitle={`${conversations.length} conversations actives`}>
        <div className="hidden sm:flex items-center gap-1">
          {["all", "new", "open", "waiting"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "ghost"}
              size="sm"
              className={`text-xs h-8 ${statusFilter === s ? "bg-[#25D366] text-white" : ""}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "Tous" : statusLabels[s]}
            </Button>
          ))}
        </div>
      </Header>

      <div className="flex h-[calc(100vh-64px)] animate-fade-in">
        {/* Conversation List - hidden on mobile when a conversation is selected */}
        <div className={`w-full md:w-80 border-r border-border flex flex-col shrink-0 bg-background ${selected ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <ScrollArea className="flex-1">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 bg-muted rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                        <div className="h-3 bg-muted/60 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))
              : filtered.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelected(conv)}
                    className={`w-full p-3 flex items-start gap-3 hover:bg-muted transition-colors text-left border-b border-border ${
                      selected?.id === conv.id ? "bg-[#25D366]/10" : ""
                    }`}
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold">
                        {conv.contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-foreground truncate">{conv.contact.name}</p>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.lastMessage || "Pas de message"}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={`text-[9px] px-1.5 py-0 ${statusColors[conv.status]}`}>
                          {statusLabels[conv.status]}
                        </Badge>
                        {conv.unreadCount > 0 && (
                          <span className="bg-[#25D366] text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className={`${selected ? 'flex' : 'hidden'} md:flex flex-1 flex-col inbox-chat-bg`}>
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="h-16 bg-background px-4 flex items-center justify-between border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setSelected(null)}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold">
                      {selected.contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{selected.contact.name}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />{selected.contact.phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <Badge className={`text-[10px] cursor-pointer ${statusColors[selected.status]}`}>
                          {statusLabels[selected.status]}
                        </Badge>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {Object.entries(statusLabels).map(([key, label]) => (
                        <DropdownMenuItem key={key} onClick={() => handleStatusChange(selected.id, key)}>
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="max-w-2xl mx-auto space-y-2">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-3.5 py-2 rounded-lg text-sm ${
                          msg.direction === "outbound"
                            ? "whatsapp-bubble-out"
                            : "whatsapp-bubble-in"
                        }`}
                      >
                        <p className="text-foreground leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(msg.createdAt)}
                          </span>
                          {msg.direction === "outbound" && (
                            <span className="text-[10px] text-blue-500">✓✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Input */}
              <div className="bg-background px-4 py-3 border-t border-border shrink-0">
                <div className="max-w-2xl mx-auto flex items-center gap-2">
                  <Input
                    placeholder="Écrire un message..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!reply.trim() || sending}
                    className="bg-[#25D366] hover:bg-[#128C7E] text-white shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sélectionnez une conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}