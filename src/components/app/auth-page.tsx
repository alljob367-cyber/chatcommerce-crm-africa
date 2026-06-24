"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  MessageCircle,
  ArrowRight,
  Sparkles,
  Check,
  Menu,
  X,
  Smartphone,
  ShoppingBag,
  Bot,
  BarChart3,
  Users,
  Inbox,
  ChevronRight,
  Star,
  Sun,
  Moon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTheme } from "next-themes";

export default function AuthPage() {
  const { setAuth } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "demo@chatcommerce.africa",
    password: "demo",
    companyName: "",
    country: "Cameroun",
    phone: "",
  });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    companyName: "",
    country: "Cameroun",
    phone: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setAuth(data.token, { id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role, company: data.company });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", ...registerForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setAuth(data.token, { id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role, company: data.company });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally { setLoading(false); }
  };

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
      if (!res.ok) throw new Error(data.error || "Erreur");
      setAuth(data.token, { id: data.user.id, name: data.user.name, email: data.user.email, role: data.user.role, company: data.company });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally { setLoading(false); }
  };

  const updateForm = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));
  const updateRegister = (field: string, value: string) => setRegisterForm((f) => ({ ...f, [field]: value }));

  const navItems = [
    { label: "Fonctionnalités", href: "#features" },
    { label: "Tarifs", href: "#pricing" },
    { label: "Ressources", href: "#resources" },
    { label: "À propos", href: "#about" },
  ];

  const features = [
    { icon: Inbox, title: "Boîte WhatsApp partagée", desc: "Centralisez toutes vos conversations WhatsApp dans une seule interface collaborative.", color: "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400" },
    { icon: ShoppingBag, title: "Catalogue produits", desc: "Affichez vos produits et services directement dans WhatsApp pour vos clients.", color: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400" },
    { icon: Smartphone, title: "Gestion des commandes", desc: "Suivez vos commandes, paiements Mobile Money et livraisons en temps réel.", color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/15 dark:text-yellow-400" },
    { icon: Bot, title: "Assistant IA", desc: "Répondez automatiquement 24h/24 en français, anglais et espagnol.", color: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400" },
    { icon: BarChart3, title: "Tableau de bord", desc: "Analysez vos ventes, performances et croissance avec des KPIs clairs.", color: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400" },
    { icon: Users, title: "Multi-utilisateurs", desc: "Collaborez en équipe avec rôles et permissions personnalisés.", color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
  ];

  const trustedBy = [
    "HOTEL LA CALEBASSE",
    "Le Gourmet RESTAURANT",
    "SuperMarket BATA",
    "Belle & Chic BOUTIQUE",
    "Pharmacie SANTÉ PLUS",
    "Voyages EXPLORER",
  ];

  const plans = [
    { name: "Starter", price: "5 000", period: "/mois", desc: "Pour démarrer votre activité WhatsApp", features: ["500 contacts", "3 agents", "1 000 messages/mois", "Automatisations basiques", "Support email"], cta: "Démarrer maintenant", popular: false },
    { name: "Business", price: "29 900", period: "/mois", desc: "Pour les entreprises en croissance", features: ["5 000 contacts", "10 agents", "10 000 messages/mois", "Assistant IA", "Automatisations avancées", "Support prioritaire", "API WhatsApp"], cta: "Essai gratuit 14 jours", popular: true },
    { name: "Enterprise", price: "Sur mesure", period: "", desc: "Pour les grandes organisations", features: ["Contacts illimités", "Agents illimités", "Messages illimités", "IA avancée", "API complète", "Support dédié 24/7", "Intégrations sur mesure"], cta: "Contacter les ventes", popular: false },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-background">
      {/* ===== HEADER / NAV ===== */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-background/90 backdrop-blur-md border-b border-gray-100 dark:border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-[#0F172A] dark:text-white text-lg">ChatCommerce</span>
              <span className="hidden sm:inline text-xs text-gray-400 font-medium bg-gray-50 dark:bg-muted px-2 py-0.5 rounded-full ml-1">CRM Afrique</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-6">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} className="text-sm text-gray-600 dark:text-gray-300 hover:text-[#0F172A] dark:hover:text-white transition-colors font-medium">
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Desktop CTAs */}
            <div className="hidden md:flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="text-gray-600 hover:text-[#0F172A] dark:text-gray-300 dark:hover:text-white"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="w-4.5 h-4.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute w-4.5 h-4.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              <Button variant="ghost" className="text-sm text-gray-600 hover:text-[#0F172A] dark:text-gray-300 dark:hover:text-white" onClick={() => setShowLogin(true)}>
                Se connecter
              </Button>
              <Dialog open={showLogin} onOpenChange={setShowLogin}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Connexion</DialogTitle></DialogHeader>
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} required /></div>
                    <div><Label>Mot de passe</Label><Input type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} required /></div>
                    {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
                    <Button type="submit" className="w-full bg-[#0F172A] hover:bg-[#1e293b]" disabled={loading}>
                      {loading ? "Chargement..." : "Se connecter"} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button type="button" variant="outline" className="w-full border-[#25D366] text-[#128C7E] hover:bg-[#25D366] hover:text-white" onClick={handleDemo} disabled={loading}>
                      <Sparkles className="w-4 h-4 mr-2" />Essayer la démo
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Button className="bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium px-5" onClick={() => setShowRegister(true)}>
                Démarrer maintenant
              </Button>
              <Dialog open={showRegister} onOpenChange={setShowRegister}>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Créer votre compte</DialogTitle></DialogHeader>
                  <p className="text-sm text-gray-500">Démarrez avec ChatCommerce à partir de 5 000 FCFA/mois. Paiement par Mobile Money.</p>
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div><Label>Nom complet</Label><Input placeholder="Marie Nkoulou" value={registerForm.name} onChange={(e) => updateRegister("name", e.target.value)} required /></div>
                    <div><Label>Nom de l&apos;entreprise</Label><Input placeholder="Mon Restaurant" value={registerForm.companyName} onChange={(e) => updateRegister("companyName", e.target.value)} required /></div>
                    <div><Label>Pays</Label>
                      <select value={registerForm.country} onChange={(e) => updateRegister("country", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                        {["Cameroun", "Gabon", "Congo", "Guinée Équatoriale", "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Guinée", "Togo", "Bénin"].map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div><Label>Email</Label><Input type="email" placeholder="vous@exemple.com" value={registerForm.email} onChange={(e) => updateRegister("email", e.target.value)} required /></div>
                    <div><Label>Téléphone</Label><Input placeholder="+237 6XX XXX XXX" value={registerForm.phone} onChange={(e) => updateRegister("phone", e.target.value)} /></div>
                    <div><Label>Mot de passe</Label><Input type="password" placeholder="••••••••" value={registerForm.password} onChange={(e) => updateRegister("password", e.target.value)} required /></div>
                    {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
                    <Button type="submit" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" disabled={loading}>
                      {loading ? "Création..." : "Créer mon compte"} <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Mobile menu button */}
            <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenu && (
            <div className="md:hidden pb-4 border-t border-gray-100 dark:border-border pt-4 space-y-3 animate-fade-in">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} className="block text-sm text-gray-600 dark:text-gray-300 py-2" onClick={() => setMobileMenu(false)}>
                  {item.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3 border-t border-gray-50 dark:border-border">
                <Button variant="outline" className="w-full" onClick={() => { setShowLogin(true); setMobileMenu(false); }}>Se connecter</Button>
                <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={handleDemo}>
                  <Sparkles className="w-4 h-4 mr-2" />Essayer la démo
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ===== HERO SECTION ===== */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text */}
            <div className="animate-fade-in">
              <div className="inline-flex items-center gap-2 bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-400 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
                <Sparkles className="w-4 h-4" />
                Premier CRM WhatsApp pour l&apos;Afrique
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0F172A] dark:text-white leading-tight mb-6">
                Transformez WhatsApp en{" "}
                <span className="text-[#25D366]">machine à vendre</span>
              </h1>
              <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed mb-8 max-w-xl">
                Gérez vos clients, commandes et ventes depuis une seule plateforme. Répondez plus vite,
                vendez plus et faites grandir votre business africain.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Button
                  size="lg"
                  className="bg-[#25D366] hover:bg-[#128C7E] text-white text-base font-semibold px-8 h-12 shadow-lg shadow-green-500/20"
                  onClick={() => setShowRegister(true)}
                >
                  Commencer à 5 000 FCFA/mois
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-gray-200 dark:border-border text-[#0F172A] dark:text-white text-base font-medium px-8 h-12 hover:bg-gray-50 dark:hover:bg-muted"
                  onClick={handleDemo}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Voir la démo
                </Button>
              </div>
              {/* Trust badges */}
              <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-500 dark:text-gray-400">
                {[
                  "Installation facile",
                  "Sans carte bancaire",
                  "Annulation à tout moment",
                ].map((text) => (
                  <span key={text} className="flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-[#25D366]" />
                    {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Image */}
            <div className="relative animate-fade-in" style={{ animationDelay: "200ms" }}>
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-green-900/10">
                <img
                  src="/landing-hero.png"
                  alt="ChatCommerce CRM - Transformez WhatsApp en machine à vendre"
                  className="w-full h-auto"
                />
              </div>
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 bg-white dark:bg-card rounded-xl shadow-lg p-3 hidden lg:flex items-center gap-2 animate-fade-in" style={{ animationDelay: "600ms" }}>
                <div className="w-8 h-8 bg-green-100 dark:bg-green-500/15 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-white">+1 258 clients</p>
                  <p className="text-[10px] text-gray-400">Ce mois-ci</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white dark:bg-card rounded-xl shadow-lg p-3 hidden lg:flex items-center gap-2 animate-fade-in" style={{ animationDelay: "800ms" }}>
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-500/15 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-white">12.8M XAF</p>
                  <p className="text-[10px] text-gray-400">Chiffre d&apos;affaires</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUSTED BY ===== */}
      <section className="border-y border-gray-100 dark:border-border bg-gray-50/50 dark:bg-muted/30 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 font-medium mb-6 uppercase tracking-wider">
            Ils nous font confiance
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {trustedBy.map((brand) => (
              <span key={brand} className="text-gray-300 dark:text-gray-600 font-bold text-sm tracking-wide hover:text-gray-400 dark:hover:text-gray-500 transition-colors">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] dark:text-white mb-4">
              Tout ce dont vous avez besoin pour vendre sur WhatsApp
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              Une plateforme complète qui transforme chaque conversation en opportunité de vente.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat) => (
              <Card key={feat.title} className="border-0 shadow-sm hover:shadow-lg transition-all duration-300 group py-0 overflow-hidden">
                <CardContent className="p-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${feat.color} mb-4 group-hover:scale-110 transition-transform`}>
                    <feat.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0F172A] dark:text-white mb-2">{feat.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{feat.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DASHBOARD PREVIEW ===== */}
      <section className="py-20 bg-[#0F172A] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#25D366] rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-[#2563EB] rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-[#25D366] text-sm font-semibold uppercase tracking-wider mb-4">
                Une expérience simple et puissante
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Gérez votre business depuis WhatsApp
              </h2>
              <p className="text-gray-400 leading-relaxed mb-8">
                Un tableau de bord intuitif qui vous donne une vue complète sur vos clients,
                vos ventes et la performance de votre équipe. Tout ce dont vous avez besoin,
                en un coup d&apos;oeil.
              </p>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {[
                  { value: "1 258", label: "Total clients" },
                  { value: "568", label: "Commandes" },
                  { value: "12.85M", label: "Chiffre d'affaires (XAF)" },
                  { value: "24.6%", label: "Taux de conversion" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
              <Button
                className="bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold"
                onClick={handleDemo}
              >
                Voir la démo complète <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="relative">
              <img
                src="/landing-hero.png"
                alt="Dashboard ChatCommerce"
                className="rounded-2xl shadow-2xl shadow-black/30 w-full"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F172A]/20 to-transparent rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="py-20 bg-gray-50 dark:bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] dark:text-white mb-4">
              Ce que disent nos utilisateurs
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Des entrepreneurs africains qui font confiance à ChatCommerce.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Aminata Diallo", role: "Restauratrice, Dakar", text: "ChatCommerce a transformé la façon dont je gère mes commandes WhatsApp. Mes ventes ont augmenté de 40% en 3 mois !", rating: 5 },
              { name: "Jean-Pierre Mbarga", role: "Gérant supermarché, Douala", text: "L'automatisation des réponses me fait gagner 3 heures par jour. Je peux me concentrer sur la croissance de mon business.", rating: 5 },
              { name: "Fatou Bamba", role: "Propriétaire boutique, Abidjan", text: "Le catalogue produits sur WhatsApp est incroyable. Mes clients commandent directement sans appeler. C'est magique !", rating: 5 },
            ].map((t) => (
              <Card key={t.name} className="border-0 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#0F172A] text-white flex items-center justify-center text-xs font-bold">
                      {t.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A] dark:text-white">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING ===== */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] dark:text-white mb-4">
              Des tarifs adaptés au marché africain
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg">Commencez à 5 000 FCFA/mois, évoluez à votre rythme.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`border-0 shadow-sm hover:shadow-lg transition-all duration-300 relative ${plan.popular ? "ring-2 ring-[#25D366] scale-105" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-[#25D366] text-white text-xs font-bold px-4 py-1 rounded-full">Le plus populaire</span>
                  </div>
                )}
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-[#0F172A] dark:text-white">{plan.name}</h3>
                  <p className="text-sm text-gray-400 mt-1 mb-4">{plan.desc}</p>
                  <div className="mb-6">
                    {plan.price === "Sur mesure" ? (
                      <p className="text-3xl font-bold text-[#0F172A] dark:text-white">Sur mesure</p>
                    ) : (
                      <>
                        <span className="text-4xl font-extrabold text-[#0F172A] dark:text-white">{plan.price}</span>
                        <span className="text-gray-400 text-sm ml-1">FCFA{plan.period}</span>
                      </>
                    )}
                  </div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-[#25D366] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full font-medium ${plan.popular ? "bg-[#25D366] hover:bg-[#128C7E] text-white" : "bg-[#0F172A] hover:bg-[#1e293b] text-white"}`}
                    onClick={plan.popular ? () => setShowRegister(true) : handleDemo}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="py-20 bg-[#0F172A]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Prêt à transformer WhatsApp en machine à vendre ?
          </h2>
          <p className="text-gray-400 text-lg mb-8 max-w-2xl mx-auto">
            Rejoignez des centaines d&apos;entreprises africaines qui utilisent ChatCommerce pour
            augmenter leurs ventes et fidéliser leurs clients.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="bg-[#25D366] hover:bg-[#128C7E] text-white text-base font-semibold px-8 h-12 shadow-lg shadow-green-500/20" onClick={() => setShowRegister(true)}>
              Commencer à 5 000 FCFA/mois <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 text-base font-medium px-8 h-12" onClick={handleDemo}>
              <Sparkles className="w-4 h-4 mr-2" />Voir la démo
            </Button>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#0a0f1a] text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">ChatCommerce</span>
              </div>
              <p className="text-sm leading-relaxed">
                Le premier CRM WhatsApp conçu pour les entreprises africaines.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Produit</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Tarifs</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Intégrations</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Ressources</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Tutoriels</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm mb-3">Pays</h4>
              <ul className="space-y-2 text-sm">
                <li>Cameroun</li>
                <li>Côte d&apos;Ivoire</li>
                <li>Sénégal</li>
                <li>Guinée Équatoriale</li>
                <li>+ 7 autres pays</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs">&copy; 2026 ChatCommerce CRM Afrique. Tous droits réservés.</p>
            <div className="flex gap-4 text-xs">
              <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
              <a href="#" className="hover:text-white transition-colors">CGU</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Login/Register dialogs for mobile */}
      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent>
          <DialogHeader><DialogTitle>Connexion</DialogTitle></DialogHeader>
          <form onSubmit={handleLogin} className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} required /></div>
            <div><Label>Mot de passe</Label><Input type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} required /></div>
            {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
            <Button type="submit" className="w-full bg-[#0F172A] hover:bg-[#1e293b]" disabled={loading}>
              {loading ? "Chargement..." : "Se connecter"} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button type="button" variant="outline" className="w-full border-[#25D366] text-[#128C7E] hover:bg-[#25D366] hover:text-white" onClick={handleDemo} disabled={loading}>
              <Sparkles className="w-4 h-4 mr-2" />Essayer la démo
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Créer votre compte</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">Démarrez avec ChatCommerce à partir de 5 000 FCFA/mois. Paiement par Mobile Money.</p>
          <form onSubmit={handleRegister} className="space-y-3">
            <div><Label>Nom complet</Label><Input placeholder="Marie Nkoulou" value={registerForm.name} onChange={(e) => updateRegister("name", e.target.value)} required /></div>
            <div><Label>Nom de l&apos;entreprise</Label><Input placeholder="Mon Restaurant" value={registerForm.companyName} onChange={(e) => updateRegister("companyName", e.target.value)} required /></div>
            <div><Label>Pays</Label>
              <select value={registerForm.country} onChange={(e) => updateRegister("country", e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
                {["Cameroun", "Gabon", "Congo", "Guinée Équatoriale", "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Guinée", "Togo", "Bénin"].map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div><Label>Email</Label><Input type="email" placeholder="vous@exemple.com" value={registerForm.email} onChange={(e) => updateRegister("email", e.target.value)} required /></div>
            <div><Label>Téléphone</Label><Input placeholder="+237 6XX XXX XXX" value={registerForm.phone} onChange={(e) => updateRegister("phone", e.target.value)} /></div>
            <div><Label>Mot de passe</Label><Input type="password" placeholder="••••••••" value={registerForm.password} onChange={(e) => updateRegister("password", e.target.value)} required /></div>
            {error && <p className="text-sm text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>}
            <Button type="submit" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" disabled={loading}>
              {loading ? "Création..." : "Créer mon compte"} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}