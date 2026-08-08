"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "next-themes";

const AGENT_TYPES = [
  { icon: Store, label: "Restaurant", desc: "Commandes automatiques, livraison, menu interactif", color: "from-orange-500 to-red-500", badge: "Populaire" },
  { icon: Scissors, label: "Salon Coiffure", desc: "Prise de RDV, pack mariée, soins cheveux", color: "from-pink-500 to-purple-500", badge: "" },
  { icon: Pill, label: "Pharmacie", desc: "Rappel médicaments, commande en ligne, disponibilité", color: "from-green-500 to-teal-500", badge: "Nouveau" },
  { icon: Car, label: "Taxi / Transport", desc: "Réservation course, devis instantané, suivi course", color: "from-blue-500 to-indigo-500", badge: "Nouveau" },
  { icon: Shirt, label: "Pressing / Laverie", desc: "Dépôt/retrait vêtements, suivi linge, tarif", color: "from-cyan-500 to-blue-500", badge: "Nouveau" },
  { icon: GraduationCap, label: "Ecole / Formation", desc: "Inscriptions en ligne, emploi du temps, paiements", color: "from-amber-500 to-orange-500", badge: "Nouveau" },
];

const FEATURES = [
  { icon: Bot, title: "Bots Telegram Prêts", desc: "6 types d'agents pré-configurés. Aucune compétence technique requise. Activez en 2 minutes." },
  { icon: ShoppingBag, title: "Commandes Automatiques", desc: "Vos clients commandent 24h/24 via Telegram. Panier, checkout, confirmation tout automatique." },
  { icon: BarChart3, title: "Dashboard CRM", desc: "KPI en temps réel, revenus, commandes, taux de conversion. Export CSV et rapports." },
  { icon: Users, title: "Gestion Clients", desc: "CRM complet : contacts, conversations historique, suivi des leads et prospects." },
  { icon: Zap, title: "Zero Configuration", desc: "Un clic pour créer un bot. Collez votre token BotFather. C'est tout. Pas de code." },
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
    price: "Gratuit",
    period: "",
    desc: "Pour démarrer votre activité en ligne",
    features: ["1 bot Telegram", "CRM complet", "Dashboard KPI", "Commandes automatiques", "Communauté WhatsApp"],
    cta: "Demarrer Gratuitement",
    popular: false,
  },
  {
    name: "Business",
    price: "9 900",
    period: "FCFA/mois",
    desc: "Pour les PME qui veulent grandir",
    features: ["3 bots Telegram", "CRM complet", "Dashboard avancé", "Export rapports PDF", "Support prioritaire", "Paiement Mobile Money", "API intégrée"],
    cta: "Essai Gratuit 14 jours",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Sur devis",
    period: "",
    desc: "Pour les grandes structures et franchises",
    features: ["Bots illimités", "CRM multi-sites", "API complète", "White-label", "Formation dédiée", "SLA garanti", "Intégration sur mesure"],
    cta: "Contacter les ventes",
    popular: false,
  },
];

export default function AuthPage() {
  const { setAuth } = useAppStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted ? (resolvedTheme || theme) === "dark" : false;
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [form, setForm] = useState({
    email: "demo@chatcommerce.africa",
    password: "demo",
  });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    country: "Cameroun",
    phone: "",
  });

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTestimonial((p) => (p + 1) % TESTIMONIALS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleDemo = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "demo" }),
      });
      const data = await res.json();
      if (data.token && data.user) {
        setAuth(data.token, data.user);
      } else {
        setError(data.error || "Erreur de connexion demo");
      }
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
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
        setAuth(data.token, data.user);
      } else {
        setError(data.error || "Identifiants incorrects");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
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
        setAuth(data.token, data.user);
      } else {
        setError(data.error || "Erreur d'inscription");
      }
    } catch {
      setError("Erreur d'inscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? "dark" : ""}`}>
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-zinc-900 dark:text-white">
              ChatCommerce<span className="text-[#25D366]"> CRM</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#agents" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-[#25D366] transition">Agents</a>
            <a href="#features" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-[#25D366] transition">Fonctionnalites</a>
            <a href="#tarifs" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-[#25D366] transition">Tarifs</a>
            <a href="#temoignages" className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-[#25D366] transition">Temoignages</a>
            {mounted && (
              <button onClick={() => setTheme(isDark ? "light" : "dark")} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowLogin(true)} className="text-xs">
              Connexion
            </Button>
            <Button size="sm" onClick={() => setShowRegister(true)} className="bg-[#25D366] hover:bg-[#128C7E] text-white text-xs">
              Commencer Gratuit
            </Button>
          </div>
          <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {/* Mobile Menu */}
        {mobileMenu && (
          <div className="md:hidden bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
            <a href="#agents" className="block text-sm py-2" onClick={() => setMobileMenu(false)}>Agents</a>
            <a href="#features" className="block text-sm py-2" onClick={() => setMobileMenu(false)}>Fonctionnalites</a>
            <a href="#tarifs" className="block text-sm py-2" onClick={() => setMobileMenu(false)}>Tarifs</a>
            <a href="#temoignages" className="block text-sm py-2" onClick={() => setMobileMenu(false)}>Temoignages</a>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => { setShowLogin(true); setMobileMenu(false); }}>Connexion</Button>
              <Button size="sm" className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={() => { setShowRegister(true); setMobileMenu(false); }}>S'inscrire</Button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#25D366]/10 rounded-full border border-[#25D366]/20">
              <Sparkles className="w-4 h-4 text-[#25D366]" />
              <span className="text-sm font-medium text-[#25D366]">La 1ere plateforme CRM Telegram pour l'Afrique</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
              Automatisez vos ventes avec des
              <span className="block bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#075E54] bg-clip-text text-transparent">
                Bots Telegram Intelligents
              </span>
            </h1>
            <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Creez votre bot en <strong className="text-zinc-900 dark:text-white">1 clic</strong>. Recevez des commandes, prenez des rendez-vous et gérez vos clients depuis Telegram. <strong className="text-zinc-900 dark:text-white">Zero configuration. Zero code.</strong>
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button size="lg" onClick={handleDemo} disabled={loading} className="bg-[#25D366] hover:bg-[#128C7E] text-white px-8 py-6 text-base font-semibold shadow-lg shadow-[#25D366]/25 hover:shadow-[#128C7E]/25 transition-all">
                {loading ? "Connexion..." : (
                  <>
                    <Bot className="w-5 h-5 mr-2" />
                    Voir la Demo en Direct
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <Button size="lg" variant="outline" onClick={() => setShowRegister(true)} className="px-8 py-6 text-base">
                Creer mon compte gratuitement
              </Button>
            </div>
            <div className="flex items-center justify-center gap-6 pt-4 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#25D366]" /> Gratuit</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#25D366]" /> Sans carte bancaire</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#25D366]" /> Fonctionne en 2 min</span>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: "6", label: "Types de Bots" },
              { value: "44M+", label: "PME en Afrique" },
              { value: "24/7", label: "Ventes automatiques" },
              { value: "<2min", label: "Mise en place" },
            ].map((s) => (
              <div key={s.label} className="text-center p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                <p className="text-2xl md:text-3xl font-bold text-[#25D366]">{s.value}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENTS SECTION */}
      <section id="agents" className="py-16 md:py-24 px-4 sm:px-6 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-[#25D366]/10 text-[#25D366] border-[#25D366]/20">6 Agents Telegram</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Un bot pour chaque activite
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Choisissez votre type d'activite. Tout est pre-configure : services, tarifs, horaires. Il suffit d'activer.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {AGENT_TYPES.map((agent) => (
              <Card key={agent.label} className="group border-0 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden">
                <CardContent className="p-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <agent.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{agent.label}</h3>
                    {agent.badge && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
                        {agent.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{agent.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[#25D366]">
                    <Send className="w-4 h-4" />
                    <span>Disponible sur Telegram</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 md:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Comment ca marche ?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">3 etapes. C'est tout.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", icon: Zap, title: "Choisissez votre agent", desc: "Restaurant, Salon, Pharmacie, Taxi, Pressing ou Ecole. Un clic et c'est configure." },
              { step: "2", icon: Bot, title: "Activez sur Telegram", desc: "Collez votre token @BotFather. Le bot est immediatement en ligne et pret a recevoir des commandes." },
              { step: "3", icon: TrendingUp, title: "Recevez des commandes", desc: "Vos clients commandent 24h/24. Vous recevez les notifications et gerez tout depuis le dashboard." },
            ].map((s) => (
              <div key={s.step} className="text-center relative">
                <div className="w-16 h-16 rounded-2xl bg-[#25D366]/10 border-2 border-[#25D366]/20 flex items-center justify-center mx-auto mb-4">
                  <s.icon className="w-8 h-8 text-[#25D366]" />
                </div>
                <span className="absolute top-0 right-1/4 md:right-auto md:left-[calc(50%+50px)] text-5xl font-black text-zinc-100 dark:text-zinc-800">{s.step}</span>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-16 md:py-24 px-4 sm:px-6 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Tout ce qu'il vous faut pour vendre
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
              Un CRM complet integre avec des bots Telegram puissants. Gerez votre activite depuis une seule plateforme.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-all">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center mb-4">
                    <f.icon className="w-6 h-6 text-[#25D366]" />
                  </div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="temoignages" className="py-16 md:py-24 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Ils nous font confiance
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">Plus de 500 commerçants africains utilisent ChatCommerce CRM</p>
          </div>
          <div className="max-w-3xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-5 h-5 ${i < TESTIMONIALS[currentTestimonial].stars ? "fill-yellow-400 text-yellow-400" : "text-zinc-300"}`} />
                  ))}
                </div>
                <p className="text-lg text-zinc-700 dark:text-zinc-300 leading-relaxed mb-6 italic">
                  &ldquo;{TESTIMONIALS[currentTestimonial].text}&rdquo;
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-zinc-900 dark:text-white">{TESTIMONIALS[currentTestimonial].name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{TESTIMONIALS[currentTestimonial].role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentTestimonial((p) => (p - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-zinc-400">{currentTestimonial + 1}/{TESTIMONIALS.length}</span>
                    <button onClick={() => setCurrentTestimonial((p) => (p + 1) % TESTIMONIALS.length)} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* PRICING SECTION */}
      <section id="tarifs" className="py-16 md:py-24 px-4 sm:px-6 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              Tarifs simples et transparents
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400">Commencez gratuitement. Evoluez quand vous etes pret.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <Card key={plan.name} className={`border-0 shadow-md hover:shadow-lg transition-all relative ${plan.popular ? "ring-2 ring-[#25D366]" : ""}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#25D366] text-white text-xs font-bold rounded-full">
                    Le plus populaire
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{plan.desc}</p>
                  <div className="mt-4 mb-6">
                    {plan.price === "Gratuit" ? (
                      <span className="text-4xl font-extrabold text-[#25D366]">Gratuit</span>
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold text-zinc-900 dark:text-white">{plan.price}</span>
                        {plan.period && <span className="text-sm text-zinc-500 ml-1">{plan.period}</span>}
                      </>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                        <Check className="w-4 h-4 text-[#25D366] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${plan.popular ? "bg-[#25D366] hover:bg-[#128C7E] text-white" : ""}`}
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

      {/* CTA SECTION */}
      <section className="py-16 md:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-0 shadow-xl overflow-hidden">
            <div className="bg-gradient-to-br from-[#25D366] to-[#075E54] p-10 md:p-16">
              <Bot className="w-16 h-16 text-white/80 mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Pret a automatiser votre activite ?
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                Rejoignez des centaines de commerçants africains qui vendent 24h/24 avec des bots Telegram.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" onClick={handleDemo} disabled={loading} className="bg-white text-[#075E54] hover:bg-white/90 px-8 py-6 text-base font-semibold shadow-lg">
                  {loading ? "Connexion..." : "Essayer Gratuitement"}
                </Button>
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-base">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  Contacter sur Telegram
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-4 sm:px-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-zinc-900 dark:text-white">ChatCommerce CRM Africa</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1"><Shield className="w-4 h-4" /> Donnees securisees</span>
              <span className="flex items-center gap-1"><Globe className="w-4 h-4" /> Made in Africa</span>
              <span className="flex items-center gap-1"><Banknote className="w-4 h-4" /> Mobile Money</span>
            </div>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              &copy; {new Date().getFullYear()} ALLJOB BATACONNECT IA
            </p>
          </div>
        </div>
      </footer>

      {/* LOGIN DIALOG */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Connexion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-sm">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" placeholder="votre@email.com" />
            </div>
            <div>
              <Label className="text-sm">Mot de passe</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={handleLogin} disabled={loading}>
              Se connecter
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Pas encore de compte ?{" "}
              <button onClick={() => { setShowLogin(false); setShowRegister(true); }} className="text-[#25D366] font-medium hover:underline">
                S'inscrire
              </button>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* REGISTER DIALOG */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-bold">Creer votre compte</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-sm">Nom complet</Label>
              <Input value={registerForm.name} onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })} className="mt-1" placeholder="Votre nom" />
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <Input type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} className="mt-1" placeholder="votre@email.com" />
            </div>
            <div>
              <Label className="text-sm">Mot de passe</Label>
              <Input type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} className="mt-1" placeholder="••••••••" />
            </div>
            <div>
              <Label className="text-sm">Nom de l'entreprise</Label>
              <Input value={registerForm.companyName} onChange={(e) => setRegisterForm({ ...registerForm, companyName: e.target.value })} className="mt-1" placeholder="Mon Entreprise" />
            </div>
            <div>
              <Label className="text-sm">Pays</Label>
              <Input value={registerForm.country} onChange={(e) => setRegisterForm({ ...registerForm, country: e.target.value })} className="mt-1" placeholder="Cameroun" />
            </div>
            <div>
              <Label className="text-sm">Telephone</Label>
              <Input value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} className="mt-1" placeholder="+237 6XX XXX XXX" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={handleRegister} disabled={loading}>
              Creer mon compte
            </Button>
            <p className="text-center text-sm text-zinc-500">
              Deja un compte ?{" "}
              <button onClick={() => { setShowRegister(false); setShowLogin(true); }} className="text-[#25D366] font-medium hover:underline">
                Se connecter
              </button>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
