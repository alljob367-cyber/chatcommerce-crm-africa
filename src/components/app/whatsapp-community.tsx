"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Users, ExternalLink, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// WhatsApp Community link — update this URL when you create the actual community
const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/ChatCommerceCRMAfrica";

const COMMUNITY_BENEFITS = [
  { icon: "💡", title: "Astuces & Conseils", desc: "Partage de bonnes pratiques CRM et Telegram bots" },
  { icon: "🤝", title: "Networking", desc: "Connectez-vous avec d'autres entrepreneurs africains" },
  { icon: "📢", title: "Annonces", desc: "Soyez les premiers informes des nouvelles fonctionnalites" },
  { icon: "🐛", title: "Support", desc: "Aide mutuelle et resolution de problemes techniques" },
  { icon: "📊", title: "Retours", desc: "Participez a l'amelioration du produit" },
  { icon: "🎉", title: "Offres exclusives", desc: "Promotions et offres speciales pour les membres" },
];

export default function WhatsAppCommunity({ variant = "header" }: { variant?: "header" | "dashboard" }) {
  const [open, setOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);

  useEffect(() => {
    setHasJoined(localStorage.getItem("cc_whatsapp_joined") === "true");
  }, []);

  const handleJoin = () => {
    // Open WhatsApp community link
    window.open(WHATSAPP_COMMUNITY_URL, "_blank", "noopener,noreferrer");
    setJoined(true);
    // Save to localStorage so we don't show the dialog again
    localStorage.setItem("cc_whatsapp_joined", "true");
    setHasJoined(true);
  };

  if (hasJoined && variant === "header") return null;

  if (variant === "header") {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="text-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/10 gap-1.5 text-xs"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden lg:inline">Communaute</span>
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#25D366]">
                <MessageCircle className="w-5 h-5" />
                Communaute WhatsApp ChatCommerce
              </DialogTitle>
              <DialogDescription>
                Rejoignez notre communaute d&apos;entrepreneurs africains utilisant ChatCommerce CRM.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Community stats */}
              <div className="flex items-center justify-around bg-[#25D366]/5 rounded-xl p-4 border border-[#25D366]/10">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#25D366]">500+</p>
                  <p className="text-xs text-muted-foreground">Membres</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#25D366]">12+</p>
                  <p className="text-xs text-muted-foreground">Pays</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#25D366]">24/7</p>
                  <p className="text-xs text-muted-foreground">Actif</p>
                </div>
              </div>

              {/* Benefits */}
              <div className="grid grid-cols-2 gap-3">
                {COMMUNITY_BENEFITS.map((b) => (
                  <div key={b.title} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                    <span className="text-lg leading-none">{b.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{b.title}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Button
                className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold gap-2"
                size="lg"
                onClick={handleJoin}
              >
                {joined ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Rejoint ! Ouvrir WhatsApp
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" />
                    Rejoindre la Communaute WhatsApp
                  </>
                )}
                <ExternalLink className="w-4 h-4 ml-1" />
              </Button>

              <p className="text-[10px] text-muted-foreground text-center">
                Gratuit et inclus dans tous les plans ChatCommerce CRM
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Dashboard variant — compact card
  return (
    <>
      <div
        className="bg-gradient-to-br from-[#25D366]/10 to-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-4 cursor-pointer hover:from-[#25D366]/15 hover:to-[#25D366]/10 transition-all"
        onClick={() => setOpen(true)}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-foreground">Communaute WhatsApp</h4>
            <p className="text-[11px] text-muted-foreground">Rejoignez 500+ entrepreneurs</p>
          </div>
          <Badge className="bg-[#25D366] text-white text-[10px] border-0">Gratuit</Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>💬 Astuces & Conseils</span>
          <span>🤝 Networking</span>
          <span>📢 Nouveautes</span>
        </div>
      </div>

      {/* Dialog (same as header variant) */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#25D366]">
              <MessageCircle className="w-5 h-5" />
              Communaute WhatsApp ChatCommerce
            </DialogTitle>
            <DialogDescription>
              Rejoignez notre communaute d&apos;entrepreneurs africains utilisant ChatCommerce CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-around bg-[#25D366]/5 rounded-xl p-4 border border-[#25D366]/10">
              <div className="text-center">
                <p className="text-2xl font-bold text-[#25D366]">500+</p>
                <p className="text-xs text-muted-foreground">Membres</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#25D366]">12+</p>
                <p className="text-xs text-muted-foreground">Pays</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-[#25D366]">24/7</p>
                <p className="text-xs text-muted-foreground">Actif</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {COMMUNITY_BENEFITS.map((b) => (
                <div key={b.title} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50">
                  <span className="text-lg leading-none">{b.icon}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{b.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white font-semibold gap-2"
              size="lg"
              onClick={handleJoin}
            >
              {joined ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Rejoint ! Ouvrir WhatsApp
                </>
              ) : (
                <>
                  <MessageCircle className="w-5 h-5" />
                  Rejoindre la Communaute WhatsApp
                </>
              )}
              <ExternalLink className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              Gratuit et inclus dans tous les plans ChatCommerce CRM
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
