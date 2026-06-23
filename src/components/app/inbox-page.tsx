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
  const { token, userId } = useAppStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<MsgInfo[]>([]);
  const [reply, setReply] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/conversations?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        setConversations(d.conversations || []);
        if (d.conversations?.length > 0 && !selected) {
          setSelected(d.conversations[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, statusFilter, selected]);

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
      .catch(console.error);
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
      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
        setReply("");
      }
    } catch (e) {
      console.error(e);
    }
    setSending(false);
  };

  const handleStatusChange = async (convId: string, status: string) => {
    if (!token) return;
    await fetch("/api/conversations", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: convId, status }),
    });
    fetchConversations();
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
  };

  const statusColors: Record<string, string> = {
    new: "bg-blue-100 text-blue-700",
    open: "bg-green-100 text-green-700",
    waiting: "bg-yellow-100 text-yellow-700",
    closed: "bg-gray-100 text-gray-600",
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
        {/* Conversation List */}
        <div className="w-full md:w-80 border-r border-gray-100 flex flex-col shrink-0">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))
              : filtered.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelected(conv)}
                    className={`w-full p-3 flex items-start gap-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${
                      selected?.id === conv.id ? "bg-green-50/50" : ""
                    }`}
                  >
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold">
                        {conv.contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm text-[#0F172A] truncate">{conv.contact.name}</p>
                        {conv.lastMessageAt && (
                          <span className="text-[10px] text-gray-400 shrink-0">
                            {formatTime(conv.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
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
        <div className="hidden md:flex flex-1 flex-col bg-[#ECE5DD]">
          {selected ? (
            <>
              {/* Chat Header */}
              <div className="h-16 bg-white px-4 flex items-center justify-between border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar className="w-9 h-9">
                    <AvatarFallback className="bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold">
                      {selected.contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-sm text-[#0F172A]">{selected.contact.name}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
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
                        <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[10px] text-gray-400">
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
              <div className="bg-white px-4 py-3 border-t border-gray-100 shrink-0">
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
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sélectionnez une conversation</p>
              </div>
            </div>
          )}
        </div>

        {/* Mobile: show selected conversation full screen */}
        {selected && (
          <div className="md:hidden fixed inset-0 bg-[#ECE5DD] z-50 flex flex-col">
            <div className="h-14 bg-white px-4 flex items-center gap-3 border-b border-gray-100">
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold">
                  {selected.contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <p className="font-semibold text-sm">{selected.contact.name}</p>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${msg.direction === "outbound" ? "whatsapp-bubble-out" : "whatsapp-bubble-in"}`}>
                      <p className="text-gray-800">{msg.body}</p>
                      <p className="text-[10px] text-gray-400 text-right mt-1">{formatTime(msg.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="bg-white px-3 py-2 flex gap-2">
              <Input placeholder="Message..." value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} />
              <Button onClick={handleSend} disabled={!reply.trim()} className="bg-[#25D366] hover:bg-[#128C7E]"><Send className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}