"use client";

import { useState, useEffect, useRef } from "react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Bot,
  ArrowRight,
  Sparkles,
  Check,
  Menu,
  X,
  ShoppingBag,
  BarChart3,
  Users,
  Star,
  Sun,
  Moon,
  Zap,
  Store,
  Scissors,
  Pill,
  Car,
  Shirt,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Send,
  Globe,
  Shield,
  TrendingUp,
  MessageCircle,
  Clock,
  Banknote,
  Play,
  Smartphone,
  Rocket,
  Layers,
  Cpu,
  Phone,
  Lock,
  Mail,
  Loader2,
  Crown,
  CreditCard,
  ExternalLink,
  LogIn,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import Image from "next/image";

/* ─── DATA ─────────────────────────────────────────── */

const AGENT_TYPES = [
  { icon: Store, label: "Restaurant", type: "restaurant", desc: "Commandes automatiques, livraison, menu interactif", color: "from-orange-500 to-red-500", badge: "Populaire", channels: ["telegram", "whatsapp"] },
  { icon: Scissors, label: "Salon Coiffure", type: "salon_coiffure", desc: "Prise de RDV, pack mariée, soins cheveux", color: "from-pink-500 to-purple-500", badge: "", channels: ["telegram", "whatsapp"] },
  { icon: Pill, label: "Pharmacie", type: "pharmacie", desc: "Rappel médicaments, commande en ligne, disponibilité", color: "from-green-500 to-teal-500", badge: "", channels: ["telegram", "whatsapp"] },
  { icon: Car, label: "Taxi / Transport", type: "taxi_transport", desc: "Réservation course, devis instantané, suivi course", color: "from-blue-500 to-indigo-500", badge: "", channels: ["telegram", "whatsapp"] },
  { icon: MessageCircle, label: "Braiseuse Poisson", type: "braiseuse_poisson", desc: "Poisson braisé, macho grillé, alloco, commandes WhatsApp", color: "from-red-600 to-orange-600", badge: "Exclusif", channels: ["whatsapp", "telegram"] },
  { icon: Shirt, label: "Pressing / Laverie", type: "pressing_laverie", desc: "Dépôt/retrait vêtements, suivi linge, tarif", color: "from-cyan-500 to-blue-500", badge: "", channels: ["telegram", "whatsapp"] },
  { icon: GraduationCap, label: "Ecole / Formation", type: "ecole_formation", desc: "Inscriptions en ligne, emploi du temps, paiements", color: "from-amber-500 to-orange-500", badge: "", channels: ["telegram", "whatsapp"] },
  { icon: ShoppingBag, label: "Supermarché", type: "supermarche", desc: "Courses en ligne, livraison domicile, pack famille", color: "from-lime-500 to-green-500", badge: "Nouveau", channels: ["whatsapp", "telegram"] },
  { icon: Bot, label: "Clinique", type: "clinique", desc: "RDV médecin, analyses, vaccination, suivi", color: "from-red-500 to-pink-500", badge: "Nouveau", channels: ["whatsapp", "telegram"] },
  { icon: Globe, label: "Agence de Voyage", type: "agence_voyage", desc: "Billets avion, hôtels, excursions, visa", color: "from-violet-500 to-purple-500", badge: "Nouveau", channels: ["whatsapp", "telegram"] },
  { icon: Sparkles, label: "Boulangerie", type: "boulangerie", desc: "Commande pain, pâtisseries, gâteaux anniversaire", color: "from-yellow-500 to-amber-500", badge: "Nouveau", channels: ["whatsapp", "telegram"] },
  { icon: Users, label: "Salle de Sport", type: "salle_sport", desc: "Abonnements, coaching, yoga, zumba, boxe", color: "from-emerald-500 to-teal-500", badge: "Nouveau", channels: ["whatsapp", "telegram"] },
];

const FEATURES = [
  { icon: MessageCircle, title: "Agents WhatsApp + Telegram", desc: "12 types d'agents pré-configurés sur WhatsApp ET Telegram. Vos clients utilisent le canal qu'ils préfèrent." },
  { icon: ShoppingBag, title: "Commandes Automatiques", desc: "Vos clients commandent 24h/24 via WhatsApp ou Telegram. Panier, checkout, confirmation tout automatique." },
  { icon: BarChart3, title: "Dashboard CRM", desc: "KPI en temps réel, revenus, commandes, taux de conversion. Export CSV et rapports." },
  { icon: Users, title: "Gestion Clients", desc: "CRM complet : contacts, conversations historique, suivi des leads et prospects." },
  { icon: Zap, title: "Zero Configuration", desc: "Un clic pour créer un bot. Collez votre token BotFather ou connectez WhatsApp. C'est tout. Pas de code." },
  { icon: Globe, title: "Made for Africa", desc: "Paiement Mobile Money (Orange Money, MTN MoMo), FCFA, multilingue FR/EN." },
];

const TESTIMONIALS = [
  { name: "Marie Nkoulou", role: "Restauratrice, Douala", text: "Mes commandes ont augmenté de 40% depuis que j'utilise le bot Telegram. Mes clients commandent depuis leur téléphone sans appeler.", stars: 5 },
  { name: "Ibrahim Toure", role: "Salon de coiffure, Yaoundé", text: "Le système de réservation automatique m'a fait gagner 2 heures par jour. Plus besoin de répondre au téléphone pour les RDV.", stars: 5 },
  { name: "Fatou Mboup", role: "Pharmacienne, Dakar", text: "Les rappels de médicaments et les commandes en ligne ont fidélisé mes clients. Un outil indispensable.", stars: 5 },
  { name: "Jean-Pierre Kamga", role: "Taxi, Douala", text: "Mes clients réservent leur course directement sur Telegram. Fini les appels perdus et les errances.", stars: 4 },
];

const PRICING = [
  {
    name: "Starter",
    price: "5 000",
    period: "FCFA/mois",
    desc: "Pour demarrer votre activite en ligne",
    features: ["2 agents (WhatsApp ou Telegram)", "CRM complet", "Dashboard KPI", "500 contacts", "Commandes automatiques", "Communaute WhatsApp"],
    cta: "Commencer a 5 000 FCFA",
    popular: false,
  },
  {
    name: "Pro",
    price: "14 900",
    period: "FCFA/mois",
    desc: "Pour les auto-entrepreneurs ambitieux",
    features: ["5 agents (WhatsApp + Telegram)", "CRM complet", "Dashboard avance", "2 000 contacts", "Campagnes Ads (10)", "Livraisons avec livreurs (3)", "IA Assistant Mistral", "Agents Vocaux ElevenLabs (2)", "Communaute WhatsApp"],
    cta: "Commencer a 14 900 FCFA",
    popular: true,
  },
  {
    name: "Business",
    price: "29 900",
    period: "FCFA/mois",
    desc: "Pour les PME qui veulent grandir",
    features: ["12 agents (WhatsApp + Telegram)", "CRM complet", "Dashboard avance", "5 000 contacts", "Campagnes Ads (50)", "Livraisons avec livreurs (10)", "IA Assistant Mistral", "Agents Vocaux ElevenLabs (5)", "Rapports PDF", "Paiement Mobile Money", "Support prioritaire"],
    cta: "Commencer a 29 900 FCFA",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    period: "",
    desc: "Pour les grandes structures et franchises",
    features: ["Agents illimites (tous canaux)", "CRM multi-sites", "Campagnes illimitees", "Livraisons illimitees", "Agents Vocaux illimites", "API complete", "White-label", "Formation dediee", "SLA garanti", "Support 24/7", "Integration sur mesure"],
    cta: "Contacter les ventes",
    popular: false,
  },
];

/* ─── TELEGRAM CHAT MOCKUP DATA ────────────────────── */

const CHAT_MESSAGES = [
  { from: "bot", text: "Bienvenue au Restaurant Le Paradis ! Je suis votre assistant virtuel. Comment puis-je vous aider ?", delay: 0 },
  { from: "user", text: "Bonjour ! Je voudrais voir le menu svp", delay: 800 },
  { from: "bot", text: "Voici notre menu :", delay: 1600, isMenu: true },
  { from: "user", text: "Je commande 2x Poulet DG + 1x Jus Mangue", delay: 2400 },
  { from: "bot", text: "Commande confirmée !\nTotal: 10 000 FCFA\nLivraison estimée: 35 min", delay: 3200, isOrder: true },
];

/* ─── ANIMATED COUNTER HOOK ─────────────────────────── */

function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = Date.now();
          const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          animate();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return { count, ref };
}

/* ─── FLOATING PARTICLES ──────────────────────────── */

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-[#00E676]/30 animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${3 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── TELEGRAM PHONE MOCKUP COMPONENT ──────────────── */

function TelegramMockup() {
  const [visibleMessages, setVisibleMessages] = useState(0);
  const [started, setStarted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          CHAT_MESSAGES.forEach((msg, i) => {
            setTimeout(() => {
              setVisibleMessages(i + 1);
            }, msg.delay);
          });
        }
      },
      { threshold: 0.3 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [started]);

  return (
    <div ref={containerRef} className="relative w-[280px] sm:w-[320px] mx-auto">
      {/* Phone frame */}
      <div className="relative rounded-[3rem] border-[6px] border-zinc-800 dark:border-zinc-700 bg-zinc-900 shadow-2xl shadow-black/50 overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-900 rounded-b-2xl z-10" />

        {/* Screen */}
        <div className="bg-[#0E1621] min-h-[520px] sm:min-h-[580px] p-3 pt-10">
          {/* Telegram header */}
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00E676] to-[#00BFA5] flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Le Paradis Restaurant</p>
              <p className="text-[10px] text-[#00E676]">en ligne</p>
            </div>
            <Smartphone className="w-4 h-4 text-zinc-500" />
          </div>

          {/* Chat messages */}
          <div className="space-y-2.5 mt-3 overflow-hidden">
            {CHAT_MESSAGES.slice(0, visibleMessages).map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"} animate-[slideIn_0.4s_ease-out]`}
              >
                {msg.isMenu ? (
                  <div className="w-full space-y-1.5">
                    <div className="bg-[#182533] rounded-xl p-2 max-w-[90%]">
                      <p className="text-[11px] text-white/70 mb-2">Seleccionnez un plat :</p>
                      {["Poulet DG - 4 500 FCFA", "Ndolé - 3 500 FCFA", "Eru - 3 000 FCFA"].map((item, j) => (
                        <button
                          key={j}
                          className="w-full text-left text-[11px] text-[#00E676] bg-[#00E676]/10 rounded-lg px-3 py-1.5 mb-1 hover:bg-[#00E676]/20 transition"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : msg.isOrder ? (
                  <div className="bg-[#182533] rounded-xl p-2.5 max-w-[85%] border border-[#00E676]/20">
                    <p className="text-[11px] text-white whitespace-pre-line">{msg.text}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="text-[10px] px-2 py-0.5 bg-[#00E676] text-black rounded font-semibold">Confirmer</span>
                      <span className="text-[10px] px-2 py-0.5 bg-white/10 text-white rounded">Annuler</span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`rounded-2xl px-3 py-2 max-w-[80%] ${
                      msg.from === "user"
                        ? "bg-[#00E676] text-black rounded-br-sm"
                        : "bg-[#182533] text-white rounded-bl-sm"
                    }`}
                  >
                    <p className="text-[12px] leading-relaxed">{msg.text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input bar */}
          <div className="mt-4 flex items-center gap-2 bg-[#17212B] rounded-full px-3 py-2">
            <span className="text-[11px] text-zinc-500 flex-1">Ecrire un message...</span>
            <Send className="w-4 h-4 text-[#00E676]" />
          </div>
        </div>
      </div>

      {/* Glow effect behind phone */}
      <div className="absolute -inset-8 bg-[#00E676]/10 rounded-full blur-3xl -z-10" />
    </div>
  );
}

/* ─── MAIN COMPONENT ───────────────────────────────── */

export default function AuthPage() {
  const { setAuth } = useAppStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? (resolvedTheme || theme) === "dark" : true;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [loginTab, setLoginTab] = useState<"email" | "phone">("email");
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [phoneForm, setPhoneForm] = useState({
    phone: "",
    otp: "",
    otpSent: false,
    otpExpiry: 0,
  });
  const [twoFaDialog, setTwoFaDialog] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [pendingAuth, setPendingAuth] = useState<{ token: string; user: Record<string, unknown>; company: Record<string, unknown> } | null>(null);
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    country: "Cameroun",
    phone: "",
    businessType: "",
  });
  // ── Multi-step Registration ──
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [chariowWidgetRegLoaded, setChariowWidgetRegLoaded] = useState(false);
  const [regCheckoutUrl, setRegCheckoutUrl] = useState("");
  const [regCheckoutLoading, setRegCheckoutLoading] = useState(false);

  // Load Chariow widget script for registration
  useEffect(() => {
    if (regStep !== 2 || chariowWidgetRegLoaded) return;
    if (!document.querySelector('link[href*="chariowcdn"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://js.chariowcdn.com/v1/widget.min.css";
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="chariowcdn"]')) {
      const script = document.createElement("script");
      script.src = "https://js.chariowcdn.com/v1/widget.min.js";
      script.async = true;
      script.onload = () => setChariowWidgetRegLoaded(true);
      document.head.appendChild(script);
    } else {
      setChariowWidgetRegLoaded(true);
    }
  }, [regStep, chariowWidgetRegLoaded]);

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((p) => (p + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleAgentClick = (agentType: string, agentLabel: string) => {
    setRegisterForm((prev) => ({ ...prev, companyName: prev.companyName || `Mon ${agentLabel}`, businessType: agentType }));
    setShowRegister(true);
    // Scroll to register dialog (it's a modal so just open it)
  };

  // Demo removed — only admin account remains
  const handleGoLogin = () => {
    setShowRegister(false);
    setShowLogin(true);
  };
  const handleGoRegister = () => {
    setShowLogin(false);
    setShowRegister(true);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", ...form }),
      });
      const data = await res.json();
      if (data.token && data.user) {
        setAuth(data.token, { ...data.user, company: data.company });
      } else {
        setError(data.error || "Identifiants incorrects");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  // ─── Phone Login: Send OTP ──────────────────────────
  const handlePhoneSendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-otp", phone: phoneForm.phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPhoneForm((prev) => ({ ...prev, otpSent: true, otpExpiry: Date.now() + 300000 }));
      toast.success("Code envoye par SMS !");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur d'envoi");
    } finally {
      setLoading(false);
    }
  };

  // ─── Phone Login: Verify OTP ─────────────────────────
  const handlePhoneVerifyOtp = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-otp", phone: phoneForm.phone, code: phoneForm.otp }),
      });
      const data = await res.json();
      if (data.token && data.user) {
        setAuth(data.token, { ...data.user, company: data.company });
      } else {
        setError(data.error || "Code invalide");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de verification");
    } finally {
      setLoading(false);
    }
  };

  // ─── Login with 2FA check ──────────────────────────
  const handleLoginWith2Fa = async () => {
    if (!pendingAuth || !twoFaCode) return;
    setLoading(true);
    setError("");
    try {
      // First, verify the 2FA code via API
      const verifyRes = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pendingAuth.token}` },
        body: JSON.stringify({ action: "verify", code: twoFaCode }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error || "Code 2FA invalide");
        return;
      }
      setAuth(pendingAuth.token, pendingAuth.user as unknown as Parameters<typeof setAuth>[1]);
      setPendingAuth(null);
      setTwoFaDialog(false);
      setTwoFaCode("");
    } catch {
      setError("Erreur 2FA");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: Create account ──
  const handleRegisterStep1 = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...registerForm }),
      });
      const data = await res.json();
      if (data.token && data.user) {
        // Store token/user temporarily but don't enter app yet
        localStorage.setItem("cc_token", data.token);
        localStorage.setItem("cc_user", JSON.stringify({ ...data.user, company: data.company }));
        setRegStep(2); // Move to plan selection
      } else {
        setError(data.error || "Erreur d'inscription");
      }
    } catch {
      setError("Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Select plan and pay ──
  const handleRegPayPlan = async (planKey: string) => {
    setSelectedPlan(planKey);
    setRegCheckoutLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("cc_token");
      const res = await fetch("/api/chariow/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erreur de paiement");
        return;
      }
      if (data.status === "completed") {
        // Already paid — go to dashboard
        toast.success("Paiement deja effectue !");
        const userData = JSON.parse(localStorage.getItem("cc_user") || "{}");
        setAuth(token!, { ...userData, company: { ...userData.company, plan: planKey } });
        setRegStep(1);
        setShowRegister(false);
        return;
      }
      if (data.checkoutUrl) {
        setRegCheckoutUrl(data.checkoutUrl);
        setRegStep(3);
        window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Erreur de connexion au service de paiement");
    } finally {
      setRegCheckoutLoading(false);
    }
  };

  // ── Step 3: Confirm payment and enter app ──
  const handleRegConfirmPayment = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("cc_token");
      if (!token) return;

      // Check payment status server-side — this fetches the REAL order status from DB
      const res = await fetch("/api/chariow/checkout", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      // Look for a completed order matching the selected plan
      const completedOrder = data.orders?.find(
        (o: { plan: string; status: string }) => o.plan === selectedPlan && o.status === "completed"
      );

      const userData = JSON.parse(localStorage.getItem("cc_user") || "{}");

      if (completedOrder) {
        // Payment confirmed by server — safe to enter with the paid plan
        setAuth(token, { ...userData, company: { ...userData.company, plan: selectedPlan } });
        toast.success("Paiement confirme ! Bienvenue sur ChatCommerce !");
      } else {
        // No confirmed payment — enter with default starter plan
        const pendingOrder = data.orders?.find(
          (o: { plan: string; status: string }) => o.status === "pending"
        );
        if (pendingOrder) {
          setAuth(token, { ...userData, company: { ...userData.company, plan: "starter" } });
          toast.info("Paiement en attente. Vous commencez avec le plan Starter. Votre plan sera mis a jour automatiquement apres confirmation.");
        } else {
          setAuth(token, { ...userData, company: { ...userData.company, plan: "starter" } });
          toast.info("Plan Starter active. Vous pouvez mettre a niveau a tout moment.");
        }
      }
    } catch {
      // On error, default to starter — never trust client-side plan
      const token = localStorage.getItem("cc_token");
      const userData = JSON.parse(localStorage.getItem("cc_user") || "{}");
      if (token) {
        setAuth(token, { ...userData, company: { ...userData.company, plan: "starter" } });
      }
      toast.info("Impossible de verifier le paiement. Vous commencez avec le plan Starter.");
    } finally {
      setRegStep(1);
      setRegCheckoutUrl("");
      setShowRegister(false);
      setLoading(false);
    }
  };

  // ── Cancel registration ──
  const handleRegCancel = () => {
    setRegStep(1);
    setSelectedPlan("starter");
    setRegCheckoutUrl("");
    setError("");
    localStorage.removeItem("cc_token");
    localStorage.removeItem("cc_user");
    setRegisterForm((prev) => ({ ...prev, businessType: "" }));
    setShowRegister(false);
  };

  const stat1 = useCounter(12, 1500);
  const stat2 = useCounter(44, 2000);

  return (
    <div className={`min-h-screen ${isDark ? "dark" : ""}`}>
      {/* GLOBAL ANIMATIONS */}
      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.8); opacity: 0.5; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-fade-up { animation: fadeInUp 0.8s ease-out both; }
        .animate-fade-left { animation: fadeInLeft 0.8s ease-out both; }
        .animate-fade-right { animation: fadeInRight 0.8s ease-out both; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-gradient { background-size: 200% 200%; animation: gradient-shift 4s ease infinite; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        .delay-600 { animation-delay: 0.6s; }
        .shimmer-btn { position: relative; overflow: hidden; }
        .shimmer-btn::after {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* ─── NAVBAR ─── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-zinc-950/90 backdrop-blur-xl border-b border-[#00E676]/10 shadow-lg shadow-black/20"
          : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Image src="/logo.png" alt="ChatCommerce CRM" width={36} height={36} className="rounded-xl object-cover shadow-lg shadow-[#00E676]/30" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#00E676] rounded-full animate-pulse" />
            </div>
            <span className="font-bold text-lg text-white font-heading tracking-tight">
              Chat<span className="text-[#00E676]">Commerce</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            {[
              { href: "#agents", label: "Agents" },
              { href: "#features", label: "Features" },
              { href: "#tarifs", label: "Tarifs" },
              { href: "#temoignages", label: "Temoignages" },
            ].map((link) => (
              <a key={link.href} href={link.href} className="text-sm text-zinc-400 hover:text-[#00E676] transition-colors relative group">
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#00E676] group-hover:w-full transition-all duration-300" />
              </a>
            ))}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-zinc-700 hover:border-[#00E676]/50 transition"
            >
              {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <Button size="sm" variant="outline" onClick={() => setShowLogin(true)}
              className="text-xs border-zinc-700 text-white hover:border-[#00E676] hover:text-[#00E676] bg-transparent">
              Connexion
            </Button>
            <Button size="sm" onClick={() => setShowRegister(true)}
              className="text-xs bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black font-semibold hover:shadow-lg hover:shadow-[#00E676]/30 transition-all">
              Commencer
            </Button>
          </div>
          <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="w-6 h-6 text-white" /> : <Menu className="w-6 h-6 text-white" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800 p-4 space-y-3">
            {["agents", "features", "tarifs", "temoignages"].map((id) => (
              <a key={id} href={`#${id}`} className="block text-sm py-2 text-zinc-300" onClick={() => setMobileMenu(false)}>{id.charAt(0).toUpperCase() + id.slice(1)}</a>
            ))}
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setShowLogin(true); setMobileMenu(false); }}>Connexion</Button>
              <Button size="sm" className="flex-1 bg-[#00E676] text-black" onClick={() => { setShowRegister(true); setMobileMenu(false); }}>S'inscrire</Button>
            </div>
          </div>
        )}
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden bg-zinc-950">
        {/* Background image with overlay */}
        <div className="absolute inset-0">
          <Image src="/hero-bg.png" alt="" fill className="object-cover opacity-30" priority />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/80 via-zinc-950/60 to-zinc-950" />
        </div>

        <FloatingParticles />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(0,230,118,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,230,118,0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-12 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div className="space-y-8">
              <div className="animate-fade-up">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00E676]/10 rounded-full border border-[#00E676]/20 backdrop-blur-sm">
                  <Rocket className="w-4 h-4 text-[#00E676]" />
                  <span className="text-sm font-medium text-[#00E676] font-heading">Le CRM WhatsApp + Telegram #1 en Afrique</span>
                </div>
              </div>

              <h1 className="animate-fade-up delay-100 hero-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white">
                Automatisez vos{" "}
                <span className="relative">
                  <span className="bg-gradient-to-r from-[#00E676] via-[#00BFA5] to-[#00E5FF] bg-clip-text text-transparent animate-gradient">
                    ventes
                  </span>
                  <span className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-[#00E676] to-transparent rounded-full" />
                </span>
                {" "}avec WhatsApp & Telegram
              </h1>

              <p className="animate-fade-up delay-200 text-lg md:text-xl text-zinc-400 max-w-lg leading-relaxed text-balance">
                Créez votre bot en <span className="text-white font-semibold font-heading">1 clic</span>. Recevez des commandes, prenez des rendez-vous et gérez vos clients depuis <span className="text-[#25D366] font-semibold font-heading">WhatsApp</span> et <span className="text-[#00E676] font-semibold font-heading">Telegram</span>. <span className="text-white font-semibold font-heading">Zero code. Zero config.</span>
              </p>

              <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-start gap-4">
                <Button
                  size="lg"
                  onClick={handleGoLogin}
                  className="shimmer-btn bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black px-8 py-6 text-base font-bold shadow-xl shadow-[#00E676]/25 hover:shadow-[#00E676]/40 transition-all hover:scale-[1.02]"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Se Connecter
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowRegister(true)}
                  className="px-8 py-6 text-base border-zinc-700 text-white hover:border-[#00E676] hover:text-[#00E676] transition-all"
                >
                  Creer mon compte
                </Button>
              </div>

              <div className="animate-fade-up delay-400 flex items-center gap-6 text-sm text-zinc-500">
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#00E676]" /> 5 000 FCFA/mois</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#00E676]" /> Sans carte bancaire</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#00E676]" /> Prêt en 2 min</span>
              </div>
            </div>

            {/* Right: Phone Mockup */}
            <div className="animate-fade-right delay-300 hidden lg:block">
              <div className="relative animate-float">
                {/* Glowing rings */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-72 h-72 rounded-full border border-[#00E676]/20 animate-[pulse-ring_3s_ease-out_infinite]" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-96 h-96 rounded-full border border-[#00E676]/10 animate-[pulse-ring_3s_ease-out_infinite_1s]" />
                </div>
                <TelegramMockup />
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { ...stat1, suffix: "", label: "Types de Bots" },
              { ...stat2, suffix: "M+", label: "PME en Afrique" },
              { ref: null, count: null, suffix: "/7", label: "Ventes auto", isStatic: true, staticVal: "24" },
              { ref: null, count: null, suffix: "min", label: "Mise en place", isStatic: true, staticVal: "<2" },
            ].map((s, i) => (
              <div key={i} ref={s.ref && !s.isStatic ? s.ref : undefined} className="text-center p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 backdrop-blur-sm animate-fade-up">
                <p className="text-3xl md:text-4xl font-black text-[#00E676] font-heading tracking-tight">
                  {s.isStatic ? s.staticVal : `${s.count}${s.suffix}`}
                </p>
                <p className="text-xs text-zinc-500 mt-1 subheading-accent">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-zinc-600 flex items-start justify-center p-1.5">
            <div className="w-1.5 h-3 rounded-full bg-[#00E676] animate-pulse" />
          </div>
        </div>
      </section>

      {/* ─── AGENTS SECTION ─── */}
      <section id="agents" className="relative py-24 px-4 sm:px-6 bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/50 to-zinc-950" />
        <FloatingParticles />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20 hover:bg-[#00E676]/20">
              <Layers className="w-3 h-3 mr-1" /> 12 Agents WhatsApp + Telegram
            </Badge>
            <h2 className="section-heading text-3xl md:text-5xl font-black text-white mb-4">
              Un agent pour chaque <span className="text-[#00E676]">activite</span>, sur <span className="text-[#25D366]">WhatsApp</span> & <span className="text-[#00E676]">Telegram</span>
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg text-balance">
              Choisissez votre type d&apos;activité. Tout est pré-configuré sur les deux canaux : services, tarifs, horaires. Il suffit d&apos;activer.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {AGENT_TYPES.map((agent, i) => (
              <Card key={agent.label}
                className="group border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm hover:border-[#00E676]/30 hover:shadow-xl hover:shadow-[#00E676]/5 transition-all duration-500 hover:-translate-y-1.5 overflow-hidden cursor-pointer"
                onClick={() => handleAgentClick(agent.type, agent.label)}>
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg`}>
                    <agent.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-white font-heading">{agent.label}</h3>
                    {agent.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20">
                        {agent.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed">{agent.desc}</p>
                  <div className="mt-3 flex items-center gap-2">
                    {agent.channels?.map((ch) => (
                      <span key={ch} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ch === "whatsapp" ? "bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20" : "bg-[#00E676]/10 text-[#00E676] border border-[#00E676]/20"}`}>{ch === "whatsapp" ? "WhatsApp" : "Telegram"}</span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#00E676] group-hover:gap-3 transition-all">
                    <Send className="w-4 h-4" />
                    <span>S'inscrire maintenant</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="relative py-24 px-4 sm:px-6 bg-zinc-950 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20">
              <Cpu className="w-3 h-3 mr-1" /> Comment ça marche
            </Badge>
            <h2 className="section-heading text-3xl md:text-5xl font-black text-white mb-4">
              3 étapes. <span className="text-[#00E676]">C&apos;est tout.</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { step: "01", icon: Zap, title: "Choisissez votre agent", desc: "Restaurant, Salon, Pharmacie, Taxi... Un clic et c'est configuré sur WhatsApp et Telegram avec tous les services." },
              { step: "02", icon: Bot, title: "Connectez WhatsApp ou Telegram", desc: "Collez votre token @BotFather ou connectez votre numéro WhatsApp Business. L'agent est immédiatement en ligne." },
              { step: "03", icon: TrendingUp, title: "Recevez des commandes", desc: "Vos clients commandent 24h/24 sur les deux canaux. Vous recevez les notifications et gérez tout depuis le dashboard." },
            ].map((s, i) => (
              <div key={s.step} className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-br from-[#00E676]/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-8 rounded-2xl border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm text-center">
                  <span className="absolute -top-4 left-8 text-6xl font-black text-[#00E676]/10 font-heading">{s.step}</span>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00E676]/20 to-[#00BFA5]/10 border border-[#00E676]/20 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
                    <s.icon className="w-8 h-8 text-[#00E676]" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 font-heading">{s.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-8 h-8 text-[#00E676]/30" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES SECTION ─── */}
      <section id="features" className="relative py-24 px-4 sm:px-6 bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/30 to-zinc-950" />
        <FloatingParticles />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20">
              <Sparkles className="w-3 h-3 mr-1" /> Fonctionnalités
            </Badge>
            <h2 className="section-heading text-3xl md:text-5xl font-black text-white mb-4">
              Tout pour <span className="text-[#00E676]">dominer</span> votre marché
            </h2>
            <p className="text-zinc-400 max-w-2xl mx-auto text-lg text-balance">
              Un CRM complet intégré avec des agents WhatsApp et Telegram puissants. Gérez votre activité depuis une seule plateforme.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <Card key={f.title}
                className="group border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm hover:border-[#00E676]/20 hover:bg-zinc-900/60 transition-all duration-500">
                <CardContent className="p-7">
                  <div className="w-14 h-14 rounded-2xl bg-[#00E676]/10 border border-[#00E676]/20 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-[#00E676]/20 transition-all duration-500">
                    <f.icon className="w-7 h-7 text-[#00E676]" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 font-heading">{f.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section id="temoignages" className="relative py-24 px-4 sm:px-6 bg-zinc-950 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="section-heading text-3xl md:text-5xl font-black text-white mb-4">
              Ils nous font <span className="text-[#00E676]">confiance</span>
            </h2>
            <p className="text-zinc-400 text-lg text-balance">Plus de 500 commerçants africains utilisent ChatCommerce CRM</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <Card className="border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-sm">
              <CardContent className="p-8 md:p-10">
                <div className="flex items-center gap-1 mb-6">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < TESTIMONIALS[currentTestimonial].stars ? "fill-[#00E676] text-[#00E676]" : "text-zinc-700"}`} />
                  ))}
                </div>
                <p className="text-lg md:text-xl text-zinc-300 leading-relaxed mb-8 italic min-h-[80px] font-heading">
                  &ldquo;{TESTIMONIALS[currentTestimonial].text}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00E676] to-[#00BFA5] flex items-center justify-center text-white font-bold text-lg">
                      {TESTIMONIALS[currentTestimonial].name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-white font-heading">{TESTIMONIALS[currentTestimonial].name}</p>
                      <p className="text-sm text-zinc-500">{TESTIMONIALS[currentTestimonial].role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setCurrentTestimonial((p) => (p - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)}
                      className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center hover:border-[#00E676] hover:text-[#00E676] text-zinc-400 transition">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="flex gap-1.5">
                      {TESTIMONIALS.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === currentTestimonial ? "bg-[#00E676] w-6" : "bg-zinc-700"}`} />
                      ))}
                    </div>
                    <button onClick={() => setCurrentTestimonial((p) => (p + 1) % TESTIMONIALS.length)}
                      className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center hover:border-[#00E676] hover:text-[#00E676] text-zinc-400 transition">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ─── PRICING SECTION ─── */}
      <section id="tarifs" className="relative py-24 px-4 sm:px-6 bg-zinc-950 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-900/30 to-zinc-950" />
        <FloatingParticles />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-[#00E676]/10 text-[#00E676] border-[#00E676]/20">
              <Banknote className="w-3 h-3 mr-1" /> Tarifs
            </Badge>
            <h2 className="section-heading text-3xl md:text-5xl font-black text-white mb-4">
              Simple et <span className="text-[#00E676]">transparent</span>
            </h2>
            <p className="text-zinc-400 text-lg text-balance">Choisissez votre plan et commencez immediatement.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <Card key={plan.name}
                className={`relative border backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 ${
                  plan.popular
                    ? "border-[#00E676]/50 bg-zinc-900/80 shadow-xl shadow-[#00E676]/10 scale-105"
                    : "border-zinc-800/50 bg-zinc-900/30 hover:border-zinc-700"
                }`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black text-xs font-bold rounded-full shadow-lg shadow-[#00E676]/30">
                    Le plus populaire
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-lg font-bold text-white font-heading">{plan.name}</h3>
                  <p className="text-sm text-zinc-500 mt-1">{plan.desc}</p>
                  <div className="mt-5 mb-7">
                    {plan.price === "Sur devis" ? (
                      <span className="text-4xl font-black text-[#00E676] font-heading tracking-tight">Sur devis</span>
                    ) : (
                      <>
                        <span className="text-4xl font-black text-white font-heading tracking-tight">{plan.price}</span>
                        {plan.period && <span className="text-sm text-zinc-500 ml-1">{plan.period}</span>}
                      </>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-400">
                        <div className="w-5 h-5 rounded-full bg-[#00E676]/10 flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 text-[#00E676]" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full py-5 font-semibold transition-all ${
                      plan.popular
                        ? "bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black hover:shadow-lg hover:shadow-[#00E676]/30"
                        : "border-zinc-700 text-white hover:border-[#00E676] hover:text-[#00E676]"
                    }`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => setShowRegister(true)}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ─── */}
      <section className="relative py-24 px-4 sm:px-6 bg-zinc-950 overflow-hidden">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800/50">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00E676]/20 via-transparent to-[#00BFA5]/20" />
            <div className="absolute inset-0 bg-zinc-950/80" />
            <FloatingParticles />
            <div className="relative p-10 md:p-16 space-y-8">
              <div className="relative mx-auto" style={{ width: 80, height: 80 }}>
                <Image src="/logo.png" alt="ChatCommerce CRM" width={80} height={80} className="rounded-2xl object-cover shadow-2xl shadow-[#00E676]/30" />
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white">
                Prêt à automatiser votre <span className="text-[#00E676]">activité</span> ?
              </h2>
              <p className="text-lg text-zinc-400 max-w-xl mx-auto">
                Rejoignez des centaines de commerçants africains qui vendent 24h/24 avec des agents WhatsApp et Telegram.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  size="lg"
                  onClick={handleGoRegister}
                  className="shimmer-btn bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black px-8 py-6 text-base font-bold shadow-xl shadow-[#00E676]/30 hover:shadow-[#00E676]/50 transition-all hover:scale-[1.02]"
                >
                  S'inscrire maintenant
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-zinc-700 text-white hover:border-[#00E676] hover:text-[#00E676] px-8 py-6 text-base transition-all"
                >
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contacter sur Telegram
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="relative py-12 px-4 sm:px-6 border-t border-zinc-800/50 bg-zinc-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="ChatCommerce CRM" width={32} height={32} className="rounded-lg object-cover" />
              <span className="font-bold text-white">ChatCommerce CRM Africa</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-[#00E676]" /> Données sécurisées</span>
              <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-[#00E676]" /> Made in Africa</span>
              <span className="flex items-center gap-1.5"><Banknote className="w-4 h-4 text-[#00E676]" /> Mobile Money</span>
            </div>
            <p className="text-sm text-zinc-600">
              &copy; {new Date().getFullYear()} ALLJOB BATACONNECT IA
            </p>
          </div>
        </div>
      </footer>

      {/* ─── LOGIN DIALOG ─── */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-white">Connexion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Login Tabs */}
            <div className="flex rounded-lg bg-zinc-800 p-1 gap-1">
              <button
                onClick={() => { setLoginTab("email"); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  loginTab === "email" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                onClick={() => { setLoginTab("phone"); setError(""); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                  loginTab === "phone" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                <Phone className="w-4 h-4" />
                Telephone
              </button>
            </div>

            {loginTab === "email" ? (
              <>
                <div>
                  <Label className="text-sm text-zinc-400">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="votre@email.com" />
                </div>
                <div>
                  <Label className="text-sm text-zinc-400">Mot de passe</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="••••••••" />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button className="w-full bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black font-semibold hover:shadow-lg hover:shadow-[#00E676]/30" onClick={handleLogin} disabled={loading}>
                  {loading ? "Connexion..." : "Se connecter"}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <Label className="text-sm text-zinc-400">Numero de telephone</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={phoneForm.phone}
                      onChange={(e) => setPhoneForm({ ...phoneForm, phone: e.target.value })}
                      className="flex-1 bg-zinc-800 border-zinc-700 text-white"
                      placeholder="+237 6XX XXX XXX"
                      disabled={phoneForm.otpSent}
                    />
                    {!phoneForm.otpSent && (
                      <Button variant="outline" onClick={handlePhoneSendOtp} disabled={loading || !phoneForm.phone} className="shrink-0 border-zinc-600 text-zinc-300 hover:text-white hover:border-[#00E676]">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                </div>
                {phoneForm.otpSent && (
                  <>
                    <div>
                      <Label className="text-sm text-zinc-400">Code de verification (SMS)</Label>
                      <Input
                        value={phoneForm.otp}
                        onChange={(e) => setPhoneForm({ ...phoneForm, otp: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        className="mt-1 bg-zinc-800 border-zinc-700 text-white text-center text-lg tracking-[0.5em] font-mono"
                        placeholder="• • • • • •"
                        maxLength={6}
                      />
                      <p className="text-[10px] text-zinc-500 mt-1 text-center">
                        Code valide 5 minutes
                        {phoneForm.otpExpiry > Date.now() && (
                          <span className="ml-2">
                            — Renvoyer dans <span className="text-[#00E676]">{Math.max(0, Math.ceil((phoneForm.otpExpiry - Date.now()) / 60000))} min</span>
                          </span>
                        )}
                      </p>
                    </div>
                    <Button className="w-full bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black font-semibold hover:shadow-lg hover:shadow-[#00E676]/30" onClick={handlePhoneVerifyOtp} disabled={loading || phoneForm.otp.length !== 6}>
                      {loading ? "Verification..." : "Verifier et se connecter"}
                    </Button>
                  </>
                )}
                {error && <p className="text-sm text-red-400">{error}</p>}
              </>
            )}

            <p className="text-center text-sm text-zinc-500">
              Pas encore de compte ?{" "}
              <button onClick={() => { setShowLogin(false); setShowRegister(true); setError(""); setPhoneForm({ phone: "", otp: "", otpSent: false, otpExpiry: 0 }); }} className="text-[#00E676] font-medium hover:underline">
                S&apos;inscrire
              </button>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 2FA DIALOG ─── */}
      <Dialog open={twoFaDialog} onOpenChange={setTwoFaDialog}>
        <DialogContent className="sm:max-w-sm bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold text-white flex items-center justify-center gap-2">
              <Shield className="w-6 h-6 text-[#00E676]" />
              Verification 2FA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-zinc-400 text-center">
              Entrez le code de votre application d&apos;authentification
            </p>
            <div className="flex items-center justify-center gap-2 p-4 rounded-xl bg-zinc-800 border border-zinc-700">
              <Lock className="w-5 h-5 text-[#00E676]" />
              <span className="text-sm text-zinc-300">Double authentification requise</span>
            </div>
            <Input
              value={twoFaCode}
              onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="bg-zinc-800 border-zinc-700 text-white text-center text-2xl tracking-[0.5em] font-mono"
              placeholder="• • • • • •"
              maxLength={6}
              autoFocus
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button className="w-full bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black font-semibold hover:shadow-lg hover:shadow-[#00E676]/30" onClick={handleLoginWith2Fa} disabled={loading || twoFaCode.length !== 6}>
              {loading ? "Verification..." : "Verifier"}
            </Button>
            <Button variant="ghost" className="w-full text-zinc-500 hover:text-zinc-300" onClick={() => { setTwoFaDialog(false); setPendingAuth(null); setTwoFaCode(""); setError(""); }}>
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── REGISTER DIALOG (Multi-step) ─── */}
      <Dialog open={showRegister} onOpenChange={(open) => { if (!open) handleRegCancel(); }}>
        <DialogContent className={regStep === 2 ? "sm:max-w-2xl bg-zinc-900 border-zinc-800" : "sm:max-w-md bg-zinc-900 border-zinc-800"}>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${regStep >= s ? "bg-[#00E676] text-black" : "bg-zinc-700 text-zinc-400"}`}>
                  {regStep > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={`w-10 h-0.5 ${regStep > s ? "bg-[#00E676]" : "bg-zinc-700"}`} />}
              </div>
            ))}
          </div>

          {/* ═══ STEP 1: Account Info ═══ */}
          {regStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold text-white">Créer votre compte</DialogTitle>
                <p className="text-center text-sm text-zinc-400">Étape 1 : Informations de base</p>
              </DialogHeader>
              <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
                {registerForm.businessType && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20 mb-1">
                    <Bot className="w-4 h-4 text-[#00E676]" />
                    <span className="text-sm font-medium text-[#00E676]">
                      Agent sélectionné : <strong>{AGENT_TYPES.find((a) => a.type === registerForm.businessType)?.label || registerForm.businessType}</strong>
                    </span>
                  </div>
                )}
                <div>
                  <Label className="text-sm text-zinc-400">Nom complet</Label>
                  <Input value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Votre nom" />
                </div>
                <div>
                  <Label className="text-sm text-zinc-400">Email</Label>
                  <Input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="votre@email.com" />
                </div>
                <div>
                  <Label className="text-sm text-zinc-400">Mot de passe</Label>
                  <Input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Min. 8 chars, majuscule + chiffre" />
                </div>
                <div>
                  <Label className="text-sm text-zinc-400">Nom de l&apos;entreprise</Label>
                  <Input value={registerForm.companyName} onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Mon Entreprise" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-zinc-400">Pays</Label>
                    <Input value={registerForm.country} onChange={(e) => setRegisterForm({ ...registerForm, country: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="Cameroun" />
                  </div>
                  <div>
                    <Label className="text-sm text-zinc-400">Téléphone</Label>
                    <Input value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} className="mt-1 bg-zinc-800 border-zinc-700 text-white" placeholder="+237 6XX XXX XXX" />
                  </div>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button className="w-full bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black font-semibold hover:shadow-lg hover:shadow-[#00E676]/30" onClick={handleRegisterStep1} disabled={loading}>
                  {loading ? "Création..." : "Continuer vers les plans"}
                </Button>
                <p className="text-center text-sm text-zinc-500">
                  Déjà un compte ?{" "}
                  <button onClick={() => { handleRegCancel(); setShowLogin(true); }} className="text-[#00E676] font-medium hover:underline">
                    Se connecter
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ═══ STEP 2: Plan Selection + Payment ═══ */}
          {regStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold text-white">Choisissez votre plan</DialogTitle>
                <p className="text-center text-sm text-zinc-400">Étape 2 : Sélectionnez un pack et payez pour démarrer</p>
              </DialogHeader>
              <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
                {/* Plan Cards - 2x2 grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: "starter", name: "Starter", icon: Rocket, price: "5 000", features: ["500 contacts", "2 agents", "WhatsApp ou Telegram", "50 produits"], color: "border-border" },
                    { key: "pro", name: "Pro", icon: Zap, price: "14 900", features: ["2 000 contacts", "5 agents", "WhatsApp + Telegram", "IA + Vocaux (2)"], color: "border-[#25D366]", popular: true },
                    { key: "business", name: "Business", icon: Crown, price: "29 900", features: ["5 000 contacts", "10 agents", "Mobile Money", "IA + Vocaux (5)"], color: "border-blue-400" },
                    { key: "enterprise", name: "Enterprise", icon: Sparkles, price: "69 900", features: ["Illimite", "API + White-label", "Tous canaux", "Support 24/7"], color: "border-purple-300" },
                  ].map((p) => (
                    <Card key={p.key} className={`border-2 ${p.color} relative cursor-pointer transition-all hover:shadow-lg ${selectedPlan === p.key ? "ring-2 ring-[#00E676] ring-offset-2 ring-offset-zinc-900" : ""}`} onClick={() => setSelectedPlan(p.key)}>
                      {p.popular && (
                        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                          <Badge className="bg-[#25D366] text-white text-[9px] px-1.5">Populaire</Badge>
                        </div>
                      )}
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                            <p.icon className="w-4 h-4 text-[#00E676]" />
                          </div>
                          <p className="font-semibold text-white text-sm font-heading">{p.name}</p>
                        </div>
                        <p className="text-lg font-bold text-white mb-2 font-heading tracking-tight">{p.price} <span className="text-xs text-zinc-400 font-normal">FCFA/mois</span></p>
                        <ul className="space-y-1">
                          {p.features.map((f) => (
                            <li key={f} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                              <Check className="w-3 h-3 text-[#00E676] shrink-0" />{f}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Chariow Widget in registration */}
                {chariowWidgetRegLoaded && (
                  <div className="flex justify-center py-2">
                    <div id="chariow-widget-reg" data-product-id="prd_9lchjpi5"
                      data-store-domain="pvgxjrjr.mychariow.shop"
                      data-style="tap"
                      data-border-style="rounded"
                      data-cta-width="sm"
                      data-background-color="#FFFFFF"
                      data-cta-animation="shine"
                      data-locale="fr"
                      data-primary-color="#ffcc00"></div>
                  </div>
                )}

                {error && <p className="text-sm text-red-400">{error}</p>}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 border-zinc-700 text-zinc-300 hover:text-white" onClick={() => setRegStep(1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Retour
                  </Button>
                  <Button className="flex-2 bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black font-semibold hover:shadow-lg hover:shadow-[#00E676]/30" onClick={() => handleRegPayPlan(selectedPlan)} disabled={regCheckoutLoading}>
                    {regCheckoutLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Paiement...</> : <><CreditCard className="w-4 h-4 mr-2" />Payer {selectedPlan === "starter" ? "5 000" : selectedPlan === "pro" ? "14 900" : selectedPlan === "business" ? "29 900" : "69 900"} FCFA</>}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* ═══ STEP 3: Payment Confirmation ═══ */}
          {regStep === 3 && (
            <>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-bold text-white">Paiement en cours</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="w-16 h-16 rounded-full bg-[#ffcc00]/20 flex items-center justify-center mb-4">
                    <CreditCard className="w-8 h-8 text-[#ffcc00]" />
                  </div>
                  <p className="text-white font-semibold text-lg mb-1">Finalisez votre paiement</p>
                  <p className="text-zinc-400 text-sm text-center">La page de paiement Chariow s&apos;est ouverte dans un nouvel onglet. Completez le paiement puis revenez ici.</p>
                </div>
                <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700">
                  <p className="text-sm text-zinc-300 mb-2">Plan sélectionné : <span className="text-white font-bold">{selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}</span></p>
                  <p className="text-sm text-zinc-300">Montant : <span className="text-[#00E676] font-bold">{selectedPlan === "starter" ? "5 000" : selectedPlan === "pro" ? "14 900" : selectedPlan === "business" ? "29 900" : "69 900"} FCFA/mois</span></p>
                </div>
                <div className="p-3 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#00E676]" />
                    <p className="text-xs text-[#00E676]">Paiement securise via Chariow (Mobile Money, carte bancaire)</p>
                  </div>
                </div>
                <Button variant="outline" className="w-full border-zinc-700 text-zinc-300" onClick={() => { if (regCheckoutUrl) window.open(regCheckoutUrl, "_blank", "noopener,noreferrer"); }}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Reouvrir la page de paiement
                </Button>
                <Button className="w-full bg-gradient-to-r from-[#00E676] to-[#00BFA5] text-black font-semibold hover:shadow-lg hover:shadow-[#00E676]/30" onClick={handleRegConfirmPayment}>
                  <Check className="w-4 h-4 mr-2" />
                  J&apos;ai payé — Accéder à mon espace
                </Button>
                <p className="text-center text-xs text-zinc-500">Le webhook Chariow mettra à jour votre plan automatiquement après confirmation.</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
