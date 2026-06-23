"use client";

import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  MapPin,
  Tag,
  MoreVertical,
  UserPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  tags?: string;
  source: string;
  totalSpent: number;
  orderCount: number;
  lastMessageAt?: string;
  avatar?: string;
}

export default function ContactsPage() {
  const { token } = useAppStore();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", tags: "", notes: "", city: "" });
  const [selectedTag, setSelectedTag] = useState("");

  const fetchContacts = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedTag) params.set("tag", selectedTag);
    fetch(`/api/contacts?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setContacts(d.contacts || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token, search, selectedTag]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleAdd = async () => {
    if (!token) return;
    await fetch("/api/contacts", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(newContact),
    });
    setShowAdd(false);
    setNewContact({ name: "", phone: "", email: "", tags: "", notes: "", city: "" });
    fetchContacts();
  };

  const formatXAF = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
  const allTags = Array.from(new Set(contacts.flatMap((c) => (c.tags || "").split(",").filter(Boolean))));
  const sourceLabels: Record<string, string> = { whatsapp: "WhatsApp", manual: "Manuel", import: "Import", website: "Site web" };

  return (
    <>
      <Header title="Contacts" subtitle={`${contacts.length} contacts dans votre base`}>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button className="bg-[#0F172A] hover:bg-[#1e293b] text-white">
              <UserPlus className="w-4 h-4 mr-2" /> Ajouter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div><Label>Nom *</Label><Input placeholder="Nom complet" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} /></div>
              <div><Label>Téléphone *</Label><Input placeholder="+237 6XX XXX XXX" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" placeholder="email@exemple.com" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} /></div>
              <div><Label>Ville</Label><Input placeholder="Douala" value={newContact.city} onChange={(e) => setNewContact({ ...newContact, city: e.target.value })} /></div>
              <div><Label>Tags (séparés par virgule)</Label><Input placeholder="vip, régulier" value={newContact.tags} onChange={(e) => setNewContact({ ...newContact, tags: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea placeholder="Notes internes..." value={newContact.notes} onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })} /></div>
              <Button className="w-full bg-[#0F172A]" onClick={handleAdd}>Ajouter le contact</Button>
            </div>
          </DialogContent>
        </Dialog>
      </Header>

      <div className="p-6 animate-fade-in">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, téléphone, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                size="sm"
                className={`text-xs h-7 ${selectedTag === tag ? "bg-[#25D366] text-white border-[#25D366]" : ""}`}
                onClick={() => setSelectedTag(selectedTag === tag ? "" : tag)}
              >
                <Tag className="w-3 h-3 mr-1" />{tag}
              </Button>
            ))}
          </div>
        </div>

        {/* Contact List */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4 h-32 animate-pulse bg-gray-100 rounded-xl" /></Card>
              ))
            : contacts.map((c) => (
                <Card key={c.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-[#25D366]/10 text-[#128C7E] text-xs font-semibold">
                            {c.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-sm text-[#0F172A]">{c.name}</p>
                          <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            <Phone className="w-3 h-3" />{c.phone}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Voir le profil</DropdownMenuItem>
                          <DropdownMenuItem>Envoyer un message</DropdownMenuItem>
                          <DropdownMenuItem>Créer une commande</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      {c.email && (
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                      )}
                      {c.city && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.city}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5 flex-wrap">
                        {(c.tags || "").split(",").filter(Boolean).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] bg-green-50 text-green-700">{tag}</Badge>
                        ))}
                        <Badge variant="outline" className="text-[10px]">{sourceLabels[c.source] || c.source}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                      <div>
                        <p className="text-xs text-gray-400">Total dépensé</p>
                        <p className="text-sm font-bold text-[#0F172A]">{formatXAF(c.totalSpent)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Commandes</p>
                        <p className="text-sm font-bold text-[#0F172A]">{c.orderCount}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </>
  );
}