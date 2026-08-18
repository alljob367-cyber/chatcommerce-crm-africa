"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2,
  Users,
  CreditCard,
  Bell,
  User,
  Loader2,
  Check,
  Crown,
  Rocket,
  Sparkles,
  Shield,
  Zap,
  Trash2,
  UserPlus,
  Clock,
  Eye,
  EyeOff,
  Phone,
  Globe,
  Mail,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { CURRENCIES, getCurrencyForCountry } from "@/lib/currencies";

// ─────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  avatar?: string;
  createdAt: string;
}

interface CompanyData {
  id: string;
  name: string;
  country: string;
  whatsappNumber: string;
  plan: string;
  maxContacts: number;
  maxAgents: number;
  notifications: {
    new_orders: boolean;
    new_messages: boolean;
    payment_confirmations: boolean;
    daily_reports: boolean;
  };
}

interface SubscriptionData {
  plan: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

interface UsageData {
  contactCount: number;
  agentCount: number;
  telegramAgentCount?: number;
}

const AFRICAN_COUNTRIES = [
  "Cameroun",
  "Gabon",
  "Congo",
  "Guinée Équatoriale",
  "Côte d'Ivoire",
  "Sénégal",
  "Mali",
  "Burkina Faso",
  "Guinée",
  "Togo",
  "Bénin",
  "Niger",
  "Tchad",
  "RCA",
  "RDC",
];

const ROLE_LABELS: Record<string, string> = {
  company_admin: "Admin",
  super_admin: "Admin",
  manager: "Manager",
  agent: "Agent",
  viewer: "Lecteur",
};

const ROLE_BADGE_VARIANT: Record<string, string> = {
  company_admin: "bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20",
  super_admin: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  agent: "bg-muted text-muted-foreground border-border",
  viewer: "bg-muted text-muted-foreground border-border",
};

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    icon: Rocket,
    price: "5 000",
    period: "FCFA/mois",
    features: [
      "500 contacts",
      "3 agents equipe",
      "50 produits",
      "3 automatisations",
      "2 agents Telegram",
      "1 000 messages/mois",
      "100 reservations/mois",
      "Commandes automatiques",
      "Communaute WhatsApp",
      "Support email",
    ],
    color: "border-border",
  },
  {
    key: "pro",
    name: "Pro",
    icon: Zap,
    price: "14 900",
    period: "FCFA/mois",
    popular: true,
    features: [
      "2 000 contacts",
      "5 agents equipe",
      "200 produits",
      "10 automatisations",
      "5 agents Telegram",
      "3 000 messages/mois",
      "500 reservations/mois",
      "10 campagnes Telegram Ads",
      "3 livreurs",
      "IA Assistant",
      "Communaute WhatsApp",
      "Support email",
    ],
    color: "border-[#25D366]",
  },
  {
    key: "business",
    name: "Business",
    icon: Crown,
    price: "29 900",
    period: "FCFA/mois",
    features: [
      "5 000 contacts",
      "10 agents equipe",
      "500 produits",
      "20 automatisations",
      "12 agents Telegram",
      "10 000 messages/mois",
      "5 000 reservations/mois",
      "50 campagnes Telegram Ads",
      "10 livreurs",
      "IA Assistant",
      "Rapports PDF",
      "Paiement Mobile Money",
      "Support prioritaire",
    ],
    color: "border-blue-400",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    icon: Sparkles,
    price: "69 900",
    period: "FCFA/mois",
    features: [
      "Contacts illimites",
      "Agents illimites",
      "Produits illimites",
      "Automatisations illimites",
      "Agents Telegram illimites",
      "Messages illimites",
      "Reservations illimites",
      "Campagnes Telegram Ads illimitees",
      "Livraisons illimitees",
      "IA avancee",
      "API complete + White-label",
      "Rapports PDF avances",
      "Formation dediee",
      "SLA garanti",
      "Support dedie 24/7",
      "Integrations sur mesure",
    ],
    color: "border-purple-300",
  },
];

const PLAN_ORDER = ["starter", "pro", "business", "enterprise"];

// ─────────────────────────────────────────────────────
// HELPER: API call wrapper with auth
// ─────────────────────────────────────────────────────

function authHeaders() {
  const { token } = useAppStore.getState();
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
}

// ─────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, setPage } = useAppStore();

  // ── Company Profile State ──
  const [companyName, setCompanyName] = useState(user?.company?.name || "");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyCountry, setCompanyCountry] = useState(
    user?.company?.country || "Cameroun"
  );
  const [companyWhatsapp, setCompanyWhatsapp] = useState("");
  const [companyCurrency, setCompanyCurrency] = useState("XAF");
  const [savingCompany, setSavingCompany] = useState(false);

  // ── My Account State ──
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profilePhone, setProfilePhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // ── 2FA State ──
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [saving2Fa, setSaving2Fa] = useState(false);

  // ── Team State ──
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("agent");
  const [inviting, setInviting] = useState(false);

  // ── Subscription State ──
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);

  // ── Notifications State ──
  const [notifs, setNotifs] = useState({
    new_orders: true,
    new_messages: true,
    payment_confirmations: true,
    daily_reports: false,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // ── Chariow Payment State ──
  const [chariowLoading, setChariowLoading] = useState(false);
  const [chariowDialogOpen, setChariowDialogOpen] = useState(false);
  const [chariowCheckoutUrl, setChariowCheckoutUrl] = useState("");
  const [chariowTargetPlan, setChariowTargetPlan] = useState("");
  const [chariowDiscount, setChariowDiscount] = useState("");
  const [chariowWidgetLoaded, setChariowWidgetLoaded] = useState(false);

  // ── Load Chariow Widget Script ──
  useEffect(() => {
    if (chariowWidgetLoaded) return;
    // Load CSS
    if (!document.querySelector('link[href*="chariowcdn"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://js.chariowcdn.com/v1/widget.min.css";
      document.head.appendChild(link);
    }
    // Load JS
    if (!document.querySelector('script[src*="chariowcdn"]')) {
      const script = document.createElement("script");
      script.src = "https://js.chariowcdn.com/v1/widget.min.js";
      script.async = true;
      script.onload = () => setChariowWidgetLoaded(true);
      document.head.appendChild(script);
    } else {
      setChariowWidgetLoaded(true);
    }
  }, [chariowWidgetLoaded]);

  // ─────────────────────────────────────────────────────
  // LOAD DATA
  // ─────────────────────────────────────────────────────

  const fetchCompany = useCallback(async () => {
    try {
      const res = await fetch("/api/company", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.company) {
          setCompanyData(data.company);
          setCompanyName(data.company.name);
          setCompanyCountry(data.company.country);
          setCompanyWhatsapp(data.company.whatsappNumber);
          if (data.company.currency) {
            setCompanyCurrency(data.company.currency);
          } else if (data.company.country) {
            setCompanyCurrency(getCurrencyForCountry(data.company.country));
          }
        }
        if (data.subscription) setSubscription(data.subscription);
        if (data.usage) setUsage(data.usage);
        if (data.company?.notifications) {
          setNotifs(data.company.notifications);
        }
      }
    } catch {
      // Silently fail — defaults will be used
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch("/api/company/members", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // Silent
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const fetchUserProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const userData = data.user || data;
        setProfileName(userData.name || "");
        setProfilePhone(userData.phone || "");
      }
    } catch {
      // Silent
    }
  }, []);

  // ── 2FA Status Fetch ──
  const fetch2FaStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/2fa", { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setTwoFaEnabled(data.twoFactorEnabled || false);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCompany();
    fetchMembers();
    fetchUserProfile();
    fetch2FaStatus();
  }, [fetchCompany, fetchMembers, fetchUserProfile, fetch2FaStatus]);

  // ─────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────

  const plan = companyData?.plan || user?.company?.plan || "starter";

  // Save Company Profile
  const handleSaveCompany = async () => {
    if (!companyName.trim()) {
      toast.error("Le nom de l'entreprise est requis");
      return;
    }
    setSavingCompany(true);
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "update",
          name: companyName,
          country: companyCountry,
          whatsappNumber: companyWhatsapp,
          currency: companyCurrency,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Entreprise mise a jour");
      } else {
        toast.error(data.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSavingCompany(false);
    }
  };

  // Save Profile
  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "update_profile",
          name: profileName,
          phone: profilePhone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Profil mis a jour");
      } else {
        toast.error(data.error || "Erreur lors de la sauvegarde");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSavingProfile(false);
    }
  };

  // Change Password
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toast.error("Tous les champs sont requis");
      return;
    }
    if (newPassword.length < 8) {
      toast.error(
        "Le mot de passe doit contenir au moins 8 caracteres"
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "change_password",
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Mot de passe mis a jour");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "Erreur lors du changement");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSavingPassword(false);
    }
  };

  // ── 2FA Handlers ──
  const handleEnable2Fa = async () => {
    setSaving2Fa(true);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("2FA configuree ! Secret: " + data.secret?.slice(0, 8) + "... (en production, scannez avec Google Authenticator)");
        // Auto-verify for now
        const verifyRes = await fetch("/api/auth/2fa", {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify", code: data.verifyCode }),
        });
        if (verifyRes.ok) {
          setTwoFaEnabled(true);
          toast.success("2FA activee avec succes !");
        }
      } else {
        toast.error(data.error || "Erreur lors de l'activation");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSaving2Fa(false);
    }
  };

  const handleDisable2Fa = async () => {
    setSaving2Fa(true);
    try {
      const res = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", code: "000000" }),
      });
      const data = await res.json();
      if (res.ok) {
        setTwoFaEnabled(false);
        toast.success("2FA desactivee");
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSaving2Fa(false);
    }
  };

  // Invite Member
  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast.error("L'email est requis");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      toast.error("Format d'email invalide");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/company/members", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "invite",
          email: inviteEmail,
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          data.message || `Invitation envoyee a ${inviteEmail}`
        );
        if (data.tempPassword) {
          toast.info(
            `Mot de passe temporaire: ${data.tempPassword}`,
            { duration: 8000 }
          );
        }
        setInviteEmail("");
        setInviteRole("agent");
        setInviteOpen(false);
        fetchMembers();
        fetchCompany(); // refresh usage counts
      } else {
        toast.error(data.error || "Erreur lors de l'invitation");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setInviting(false);
    }
  };

  // Delete Member
  const handleDeleteMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Retirer ${memberName} de l'equipe ?`)) return;
    try {
      const res = await fetch(`/api/company/members?id=${memberId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Membre retire");
        fetchMembers();
        fetchCompany();
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    }
  };

  // Save Notifications
  const handleSaveNotifs = async () => {
    setSavingNotifs(true);
    try {
      const res = await fetch("/api/company", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          action: "update_notifications",
          ...notifs,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Notifications mises a jour");
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    } finally {
      setSavingNotifs(false);
    }
  };

  // No trial period — all subscriptions start as active

  // Plan upgrade handler — Chariow checkout
  const handleUpgrade = async (targetPlan: string) => {
    const plan2 = companyData?.plan || plan;
    const currentIdx = PLAN_ORDER.indexOf(plan2);
    const targetIdx = PLAN_ORDER.indexOf(targetPlan);
    if (targetIdx <= currentIdx) return;

    setChariowLoading(true);
    setChariowTargetPlan(targetPlan);
    try {
      const body: Record<string, string> = { plan: targetPlan };
      if (chariowDiscount.trim()) body.discountCode = chariowDiscount.trim();

      const res = await fetch("/api/chariow/checkout", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Erreur lors de l'initiation du paiement");
        return;
      }

      if (data.status === "already_purchased") {
        toast.info(data.error || "Vous avez deja active ce plan");
        return;
      }

      if (data.status === "completed") {
        toast.success("Paiement finalise ! Votre plan a ete mis a jour.");
        // Recharger les données
        fetchCompany();
        return;
      }

      if (data.checkoutUrl) {
        // Ouvrir la page de paiement Chariow dans un nouvel onglet
        setChariowCheckoutUrl(data.checkoutUrl);
        setChariowDialogOpen(true);
        window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      } else {
        toast.error("URL de paiement non disponible");
      }
    } catch {
      toast.error("Erreur de connexion. Veuillez reessayer.");
    } finally {
      setChariowLoading(false);
    }
  };

  const handleChariowDialogClose = () => {
    setChariowDialogOpen(false);
    setChariowCheckoutUrl("");
    fetchCompany(); // Recharger au cas où le webhook a mis à jour le plan
  };

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────

  return (
    <>
      <Header title="Paramètres" subtitle="Configuration de votre espace" />

      <div className="p-6 animate-fade-in">
        <Tabs defaultValue="company" className="w-full">
          <TabsList className="bg-card border border-border w-full mb-6 h-auto p-1 grid grid-cols-5">
            <TabsTrigger
              value="company"
              className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-[#25D366]/10 data-[state=active]:text-[#25D366]"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Entreprise</span>
            </TabsTrigger>
            <TabsTrigger
              value="account"
              className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-[#25D366]/10 data-[state=active]:text-[#25D366]"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Mon Compte</span>
            </TabsTrigger>
            <TabsTrigger
              value="team"
              className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-[#25D366]/10 data-[state=active]:text-[#25D366]"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Equipe</span>
            </TabsTrigger>
            <TabsTrigger
              value="subscription"
              className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-[#25D366]/10 data-[state=active]:text-[#25D366]"
            >
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Abonnement</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center gap-2 py-2.5 text-xs sm:text-sm data-[state=active]:bg-[#25D366]/10 data-[state=active]:text-[#25D366]"
            >
              <Bell className="w-4 h-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#25D366]" />
                  Profil Entreprise
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Informations de votre entreprise visibles dans les conversations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="comp-name" className="text-xs font-medium">
                      Nom de l'entreprise
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="comp-name"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="pl-9"
                        placeholder="Nom de votre entreprise"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comp-phone" className="text-xs font-medium">
                      Telephone
                    </Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="comp-phone"
                        value={companyPhone}
                        onChange={(e) => setCompanyPhone(e.target.value)}
                        className="pl-9"
                        placeholder="+237 6XX XXX XXX"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comp-country" className="text-xs font-medium">
                      Pays
                    </Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
                      <Select
                        value={companyCountry}
                        onValueChange={setCompanyCountry}
                      >
                        <SelectTrigger className="pl-9">
                          <SelectValue placeholder="Choisir un pays" />
                        </SelectTrigger>
                        <SelectContent>
                          {AFRICAN_COUNTRIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="comp-whatsapp"
                      className="text-xs font-medium"
                    >
                      Numero WhatsApp
                    </Label>
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      <Input
                        id="comp-whatsapp"
                        value={companyWhatsapp}
                        onChange={(e) => setCompanyWhatsapp(e.target.value)}
                        className="pl-9"
                        placeholder="+237 6XX XXX XXX"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comp-currency" className="text-xs font-medium">
                      Devise
                    </Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Select
                        value={companyCurrency}
                        onValueChange={setCompanyCurrency}
                      >
                        <SelectTrigger className="pl-9">
                          <SelectValue placeholder="Choisir la devise" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CURRENCIES).map((cur) => (
                            <SelectItem key={cur.code} value={cur.code}>
                              {cur.symbol} — {cur.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Devise utilisee pour afficher les prix (produits, commandes)
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveCompany}
                    disabled={savingCompany}
                    className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                  >
                    {savingCompany ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Sauvegarder
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: MON COMPTE                            */}
          <TabsContent value="account">
            <div className="space-y-6">
              {/* Profile Info */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-[#25D366]" />
                    Informations personnelles
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-name" className="text-xs font-medium">
                        Nom complet
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="user-name"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="pl-9"
                          placeholder="Votre nom"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="user-email" className="text-xs font-medium">
                        Email
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="user-email"
                          value={user?.email || ""}
                          readOnly
                          disabled
                          className="pl-9 bg-muted cursor-not-allowed"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        L'email ne peut pas etre modifie
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="user-phone" className="text-xs font-medium">
                        Telephone
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="user-phone"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          className="pl-9"
                          placeholder="+237 6XX XXX XXX"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                      className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                    >
                      {savingProfile ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Sauvegarder
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Change Password */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#25D366]" />
                    Changer le mot de passe
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Modifiez votre mot de passe pour securiser votre compte.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="max-w-md space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="current-pw"
                        className="text-xs font-medium"
                      >
                        Mot de passe actuel
                      </Label>
                      <div className="relative">
                        <Input
                          id="current-pw"
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showCurrentPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="new-pw"
                        className="text-xs font-medium"
                      >
                        Nouveau mot de passe
                      </Label>
                      <div className="relative">
                        <Input
                          id="new-pw"
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 8 caracteres, majuscule + chiffre"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPw ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="confirm-pw"
                        className="text-xs font-medium"
                      >
                        Confirmer le mot de passe
                      </Label>
                      <Input
                        id="confirm-pw"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeter le nouveau mot de passe"
                      />
                      {confirmPassword &&
                        newPassword !== confirmPassword && (
                          <p className="text-[11px] text-red-500">
                            Les mots de passe ne correspondent pas
                          </p>
                        )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleChangePassword}
                      disabled={
                        savingPassword ||
                        !currentPassword ||
                        !newPassword ||
                        !confirmPassword
                      }
                      variant="outline"
                    >
                      {savingPassword ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Shield className="w-4 h-4 mr-2" />
                      )}
                      Changer le mot de passe
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Two-Factor Authentication */}
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#25D366]" />
                    Double Authentification (2FA)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Protegez votre compte avec une verification en 2 etapes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${twoFaEnabled ? "bg-green-100 dark:bg-green-900/30" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                        <Shield className={`w-5 h-5 ${twoFaEnabled ? "text-green-600 dark:text-green-400" : "text-zinc-400"}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{twoFaEnabled ? "2FA Activee" : "2FA Desactivee"}</p>
                        <p className="text-xs text-muted-foreground">
                          {twoFaEnabled ? "Votre compte est protege par une double authentification" : "Activez la 2FA pour plus de securite"}
                        </p>
                      </div>
                    </div>
                    <Badge className={twoFaEnabled ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}>
                      {twoFaEnabled ? "Actif" : "Inactif"}
                    </Badge>
                  </div>
                  {twoFaEnabled ? (
                    <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={handleDisable2Fa} disabled={saving2Fa}>
                      {saving2Fa ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                      Desactiver la 2FA
                    </Button>
                  ) : (
                    <Button className="bg-[#25D366] hover:bg-[#25D366]/90 text-white" onClick={handleEnable2Fa} disabled={saving2Fa}>
                      {saving2Fa ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                      Activer la 2FA
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 3: GESTION D'EQUIPE                      */}
          <TabsContent value="team">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#25D366]" />
                      Gestion d'Equipe
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      {members.length} / {companyData?.maxAgents || user?.company?.plan === "enterprise" ? "∞" : "?"} agents utilises
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setInviteOpen(true)}
                    size="sm"
                    className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Inviter un membre
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">
                      Chargement...
                    </span>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Aucun membre dans l'equipe
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setInviteOpen(true)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Inviter un membre
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto custom-scroll">
                    {members.map((m) => {
                      const isSelf = m.id === user?.id;
                      const initials = m.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {m.name}
                                {isSelf && (
                                  <span className="text-[10px] text-muted-foreground ml-2">
                                    (vous)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {m.email}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`text-[10px] font-medium border ${ROLE_BADGE_VARIANT[m.role] || ROLE_BADGE_VARIANT.agent}`}
                            >
                              {ROLE_LABELS[m.role] || m.role}
                            </Badge>
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() =>
                                  handleDeleteMember(m.id, m.name)
                                }
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: ABONNEMENT                           */}
          <TabsContent value="subscription">
            <div className="space-y-6">
              {/* Current Plan Banner */}
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                        <Crown className="w-6 h-6 text-[#25D366]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground">
                            Plan{" "}
                            {plan.charAt(0).toUpperCase() + plan.slice(1)}
                          </h3>
                          <Badge
                            className={`text-[10px] bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20`}
                          >
                            {"Actif"}
                          </Badge>
                        </div>

                      </div>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {usage?.contactCount ?? "-"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          / {companyData?.maxContacts || "-"} contacts
                        </p>
                      </div>
                      <Separator
                        orientation="vertical"
                        className="h-12"
                      />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {usage?.agentCount ?? members.length}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          / {companyData?.maxAgents || "?"} equipe
                        </p>
                      </div>
                      <Separator
                        orientation="vertical"
                        className="h-12"
                      />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-foreground">
                          {usage?.telegramAgentCount ?? "-"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          agents Telegram
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Plan Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((p) => {
                  const isCurrent = plan === p.key;
                  const isUpgrade =
                    PLAN_ORDER.indexOf(p.key) > PLAN_ORDER.indexOf(plan);

                  return (
                    <Card
                      key={p.key}
                      className={`border-2 ${p.color} shadow-sm relative ${isCurrent ? "ring-2 ring-[#25D366] ring-offset-2 ring-offset-background" : ""}`}
                    >
                      {p.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-[#25D366] text-white text-[10px]">
                            Populaire
                          </Badge>
                        </div>
                      )}
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <p.icon className="w-5 h-5 text-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {p.name}
                            </p>
                            {isCurrent && (
                              <Badge
                                variant="outline"
                                className="text-[9px]"
                              >
                                Plan actuel
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mb-4">
                          <span className="text-2xl font-bold text-foreground">
                            {p.price}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {" "}FCFA{p.period}
                          </span>
                        </div>
                        <ul className="space-y-2 mb-5">
                          {p.features.map((f) => (
                            <li
                              key={f}
                              className="flex items-center gap-2 text-sm text-foreground"
                            >
                              <Check className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <Button
                          className={`w-full ${isCurrent ? "bg-muted text-muted-foreground cursor-default" : isUpgrade ? "bg-[#25D366] hover:bg-[#25D366]/90 text-white" : "bg-muted text-muted-foreground"}`}
                          disabled={isCurrent || (isUpgrade && chariowLoading)}
                          onClick={() => handleUpgrade(p.key)}
                        >
                          {chariowLoading && chariowTargetPlan === p.key ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : null}
                          {isCurrent
                            ? "Plan actuel"
                            : isUpgrade
                              ? "Payer en ligne"
                              : "Downgrade"}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Chariow Widget - Paiement rapide */}
              {chariowWidgetLoaded && (
                <Card className="border-2 border-dashed border-[#ffcc00]/50 bg-[#ffcc00]/5 mt-6">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[#ffcc00]/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-[#ffcc00]" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">Paiement rapide via Chariow</p>
                        <p className="text-[11px] text-muted-foreground">Payez en toute securite avec Mobile Money & carte bancaire</p>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      {/* Widget Chariow — le produit ID ici est celui du plan Starter par defaut.
                          Le bouton "Payer en ligne" ci-dessus utilise /api/chariow/checkout qui
                          redirige vers le produit Chariow correspondant au plan selectionne. */}
                      <div id="chariow-widget" data-product-id="prd_9lchjpi5"
                        data-store-domain="pvgxjrjr.mychariow.shop"
                        data-style="tap"
                        data-border-style="rounded"
                        data-cta-width="sm"
                        data-background-color="#FFFFFF"
                        data-cta-animation="shine"
                        data-locale="fr"
                        data-primary-color="#ffcc00"></div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Discount Code + Mobile Money Fallback */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-4">
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    placeholder="Code promo (optionnel)"
                    value={chariowDiscount}
                    onChange={(e) => setChariowDiscount(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage("payments")}
                  className="text-xs"
                >
                  <DollarSign className="w-3.5 h-3.5 mr-1" />
                  Ou payer via Mobile Money
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: NOTIFICATIONS                          */}
          <TabsContent value="notifications">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#25D366]" />
                  Preferences de notifications
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Choisissez les evenements pour lesquels vous souhaitez recevoir des
                  notifications.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {/* New Orders */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-[#25D366]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Nouvelles commandes
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Recevez une notification a chaque nouvelle commande
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifs.new_orders}
                      onCheckedChange={(v) =>
                        setNotifs((n) => ({ ...n, new_orders: v }))
                      }
                    />
                  </div>

                  {/* New Messages */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-[#25D366]"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Nouveaux messages
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Notifications pour les nouveaux messages WhatsApp
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifs.new_messages}
                      onCheckedChange={(v) =>
                        setNotifs((n) => ({ ...n, new_messages: v }))
                      }
                    />
                  </div>

                  {/* Payment Confirmations */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-[#25D366]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Confirmations de paiement
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Alertes lors de la reception des paiements
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifs.payment_confirmations}
                      onCheckedChange={(v) =>
                        setNotifs((n) => ({
                          ...n,
                          payment_confirmations: v,
                        }))
                      }
                    />
                  </div>

                  {/* Daily Reports */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                        <svg
                          className="w-4 h-4 text-[#25D366]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Rapports quotidiens
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Resume quotidien de l'activite par email
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notifs.daily_reports}
                      onCheckedChange={(v) =>
                        setNotifs((n) => ({ ...n, daily_reports: v }))
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveNotifs}
                    disabled={savingNotifs}
                    className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                  >
                    {savingNotifs ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Sauvegarder
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* INVITE MEMBER DIALOG                         */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#25D366]" />
              Inviter un membre
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Un email d'invitation sera envoye avec un mot de passe temporaire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label
                htmlFor="invite-email"
                className="text-xs font-medium"
              >
                Adresse email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="pl-9"
                  placeholder="collaborateur@exemple.com"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleInvite();
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                      Agent — Peut gerer les conversations
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                      Lecteur — Consultation uniquement
                    </span>
                  </SelectItem>
                  <SelectItem value="company_admin">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#25D366]" />
                      Admin — Acces complet
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={inviting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="bg-[#25D366] hover:bg-[#25D366]/90 text-white"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              Inviter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chariow Payment Dialog */}
      <Dialog open={chariowDialogOpen} onOpenChange={(open) => !open && handleChariowDialogClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#25D366]" />
              Paiement en cours
            </DialogTitle>
            <DialogDescription>
              Vous avez ete redirige vers la page de paiement securisee Chariow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plan</span>
                <Badge className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20">
                  {chariowTargetPlan.charAt(0).toUpperCase() + chariowTargetPlan.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Montant</span>
                <span className="text-lg font-bold text-[#25D366]">
                  {PLANS.find(p => p.key === chariowTargetPlan)?.price || "..."} FCFA
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Statut</span>
                <span className="text-sm font-medium text-amber-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  En attente de paiement
                </span>
              </div>
            </div>

            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Si la page de paiement ne s'est pas ouverte, cliquez sur le bouton ci-dessous :
              </p>
              <Button
                className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                onClick={() => {
                  if (chariowCheckoutUrl) {
                    window.open(chariowCheckoutUrl, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Ouvrir la page de paiement
              </Button>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <Shield className="w-4 h-4 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-600">
                Paiement securise par Chariow. Votre plan sera active automatiquement apres confirmation.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleChariowDialogClose}>
              Fermer et verifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
