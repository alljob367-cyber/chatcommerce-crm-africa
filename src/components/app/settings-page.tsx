"use client";

import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Users,
  CreditCard,
  MessageSquare,
  Shield,
  Globe,
  Phone,
  Check,
  Crown,
  Rocket,
  Sparkles,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAppStore();
  const plan = user?.company?.plan || "starter";

  const plans = [
    {
      name: "Starter",
      icon: Rocket,
      price: "0",
      period: "/mois",
      features: ["500 contacts", "3 agents", "1 000 messages/mois", "Automatisations basiques", "Support email"],
      current: plan === "starter",
      color: "border-gray-200",
    },
    {
      name: "Business",
      icon: Crown,
      price: "29 900",
      period: "/mois",
      popular: true,
      features: ["5 000 contacts", "10 agents", "10 000 messages/mois", "IA Assistant", "Automatisations avancées", "Support prioritaire", "API WhatsApp"],
      current: plan === "business",
      color: "border-[#25D366]",
    },
    {
      name: "Enterprise",
      icon: Sparkles,
      price: "99 900",
      period: "/mois",
      features: ["Contacts illimités", "Agents illimités", "Messages illimités", "IA avancée", "API complète", "Support dédié 24/7", "Intégrations sur mesure"],
      current: plan === "enterprise",
      color: "border-purple-300",
    },
  ];

  return (
    <>
      <Header title="Paramètres" subtitle="Configuration de votre espace" />

      <div className="p-6 animate-fade-in space-y-6">
        {/* Company Info */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4" /> Informations de l&apos;entreprise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>Nom</Label><Input defaultValue={user?.company?.name} /></div>
              <div><Label>Pays</Label>
                <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" defaultValue={user?.company?.country || "Cameroun"}>
                  {["Cameroun", "Gabon", "Congo", "Guinée Équatoriale", "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Guinée", "Togo", "Bénin"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div><Label>Numéro WhatsApp</Label><Input placeholder="+237 6XX XXX XXX" defaultValue="+237612345678" /></div>
              <div><Label>Devise</Label>
                <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                  <option value="XAF">FCFA (XAF)</option>
                  <option value="XOF">FCFA (XOF)</option>
                  <option value="GNF">GNF</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <Button className="mt-4 bg-[#0F172A]">Sauvegarder</Button>
          </CardContent>
        </Card>

        {/* Subscription Plans */}
        <div>
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Abonnement</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((p) => (
              <Card key={p.name} className={`border-2 ${p.color} shadow-sm relative ${p.current ? "ring-2 ring-[#25D366] ring-offset-2" : ""}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#25D366] text-white text-[10px]">Populaire</Badge>
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                      <p.icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#0F172A]">{p.name}</p>
                      {p.current && <Badge variant="outline" className="text-[9px]">Plan actuel</Badge>}
                    </div>
                  </div>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-[#0F172A]">{p.price}</span>
                    <span className="text-sm text-gray-400"> FCFA{p.period}</span>
                  </div>
                  <ul className="space-y-2 mb-5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${p.current ? "bg-gray-100 text-gray-500" : "bg-[#0F172A] hover:bg-[#1e293b]"}`}
                    disabled={p.current}
                  >
                    {p.current ? "Plan actuel" : "Changer de plan"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* WhatsApp Config */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Configuration WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label>WhatsApp Phone ID</Label><Input placeholder="Ex: 1234567890" /></div>
              <div><Label>Access Token</Label><Input type="password" placeholder="EAAxxxxxxxxxx..." /></div>
              <div><Label>Webhook Verify Token</Label><Input placeholder="my_custom_token" /></div>
            </div>
            <div className="flex items-center gap-3 mt-4 p-3 bg-green-50 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-700">WhatsApp Business API connecté</span>
            </div>
          </CardContent>
        </Card>

        {/* Team */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Équipe ({plan === "starter" ? "3" : plan === "business" ? "10" : "∞"} agents max)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: "Marie Nkoulou", email: "admin@chatcommerce.africa", role: "Admin" },
                { name: "Paul Essomba", email: "manager@chatcommerce.africa", role: "Manager" },
                { name: "Amina Diallo", email: "agent@chatcommerce.africa", role: "Agent" },
              ].map((m) => (
                <div key={m.email} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-bold">
                      {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline">{m.role}</Badge>
                </div>
              ))}
            </div>
            <Button variant="outline" className="mt-4" disabled>
              <Users className="w-4 h-4 mr-2" />Inviter un membre
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}