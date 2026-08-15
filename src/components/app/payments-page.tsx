"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/app";
import Header from "./header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Clock,
  XCircle,
  AlertTriangle,
  Copy,
  CheckCircle2,
  ArrowLeft,
  Smartphone,
  CreditCard,
  Receipt,
  Loader2,
  Info,
  ChevronRight,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

const PLAN_PRICES: Record<string, number> = {
  starter: 5000,
  pro: 14900,
  business: 29900,
  enterprise: 69900,
};

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

const PAYMENT_CONFIG = {
  orange_money: {
    name: "Orange Money",
    color: "#FF6600",
    bgColor: "bg-orange-50 dark:bg-orange-500/10",
    borderColor: "border-orange-200 dark:border-orange-500/30",
    textColor: "text-orange-600 dark:text-orange-400",
    defaultNumber: "+237 690 123 456",
    instructions: [
      "Ouvrez votre application Orange Money",
      "Allez dans Transfert / Envoyer de l'argent",
      "Entrez le numero du destinataire",
      "Saisissez le montant exact",
      "Confirmez avec votre code secret",
      "Notez le numero de transaction",
    ],
  },
  mtn_money: {
    name: "MTN Mobile Money",
    color: "#FFCC00",
    bgColor: "bg-yellow-50 dark:bg-yellow-500/10",
    borderColor: "border-yellow-200 dark:border-yellow-500/30",
    textColor: "text-yellow-600 dark:text-yellow-400",
    defaultNumber: "+237 670 123 456",
    instructions: [
      "Composez *126# sur votre telephone MTN",
      "Choisissez Transfert d'argent",
      "Entrez le numero du destinataire",
      "Saisissez le montant exact",
      "Confirmez avec votre code PIN",
      "Notez le numero de transaction",
    ],
  },
};

type Step = "select" | "method" | "pay" | "confirm" | "done";

interface PaymentRecord {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  plan: string;
  status: string;
  transactionRef: string;
  senderPhone: string;
  senderName?: string;
  rejectionReason?: string;
  expiresAt: string;
  confirmedAt?: string;
  createdAt: string;
}

export default function PaymentsPage({ targetPlan }: { targetPlan?: string }) {
  const { user, token } = useAppStore();
  const isAdmin = user?.role === "super_admin" || user?.id === "admin-hardcoded-001";
  const [step, setStep] = useState<Step>(targetPlan ? "method" : "select");
  const [selectedPlan, setSelectedPlan] = useState<string>(targetPlan || "");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [form, setForm] = useState({
    transactionRef: "",
    senderPhone: "",
    senderName: "",
  });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentRecord | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [error, setError] = useState("");

  // Phone numbers for Mobile Money reception (editable by admin)
  const [orangeNumber, setOrangeNumber] = useState(PAYMENT_CONFIG.orange_money.defaultNumber);
  const [mtnNumber, setMtnNumber] = useState(PAYMENT_CONFIG.mtn_money.defaultNumber);
  const [editingNumbers, setEditingNumbers] = useState(false);
  const [savingNumbers, setSavingNumbers] = useState(false);

  const currentPlan = user?.company?.plan || "starter";

  // Charger l'historique des paiements ET les numéros de réception
  useEffect(() => {
    if (token) {
      setLoadingPayments(true);
      Promise.all([
        fetch("/api/payments", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
        fetch("/api/company", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      ])
        .then(([paymentsData, companyData]) => {
          if (paymentsData.payments) setPayments(paymentsData.payments);
          // Load payment settings (phone numbers)
          const settings = companyData.paymentSettings;
          if (settings) {
            try {
              const parsed = typeof settings === 'string' ? JSON.parse(settings) : settings;
              if (parsed.orangeNumber) setOrangeNumber(parsed.orangeNumber);
              if (parsed.mtnNumber) setMtnNumber(parsed.mtnNumber);
            } catch {}
          }
        })
        .catch(() => {})
        .finally(() => setLoadingPayments(false));
    }
  }, [token, paymentResult]);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save reception phone numbers (admin only)
  const handleSaveNumbers = async () => {
    setSavingNumbers(true);
    try {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paymentSettings: JSON.stringify({ orangeNumber, mtnNumber }) }),
      });
      if (res.ok) {
        setEditingNumbers(false);
        toast.success("Numeros de reception mis a jour");
      }
    } catch { toast.error("Erreur de sauvegarde"); }
    finally { setSavingNumbers(false); }
  };

  const getPaymentNumber = (method: string) => method === "orange_money" ? orangeNumber : mtnNumber;

  const handleSubmitPayment = async () => {
    if (!form.transactionRef.trim() || !form.senderPhone.trim()) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          paymentMethod,
          ...form,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erreur lors de la soumission");
        return;
      }

      setPaymentResult(data.payment);
      setStep("done");
    } catch {
      setError("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: string; icon: typeof Check }> = {
      pending: { label: "En attente", variant: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400", icon: Clock },
      confirmed: { label: "Confirme", variant: "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400", icon: CheckCircle2 },
      rejected: { label: "Rejete", variant: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400", icon: XCircle },
      expired: { label: "Expire", variant: "bg-gray-100 text-gray-800 dark:bg-gray-500/20 dark:text-gray-400", icon: AlertTriangle },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.variant}`}>
        <s.icon className="w-3 h-3" />
        {s.label}
      </span>
    );
  };

  const plans = [
    {
      key: "starter",
      name: "Starter",
      price: 5000,
      features: ["500 contacts", "3 agents", "2 agents Telegram", "50 produits", "1 000 messages/mois", "Commandes automatiques", "Communaute WhatsApp"],
    },
    {
      key: "pro",
      name: "Pro",
      price: 14900,
      popular: true,
      features: ["2 000 contacts", "5 agents", "5 agents Telegram", "200 produits", "3 000 messages/mois", "10 campagnes Telegram Ads", "3 livreurs", "IA Assistant", "Communaute WhatsApp"],
    },
    {
      key: "business",
      name: "Business",
      price: 29900,
      features: ["5 000 contacts", "10 agents", "12 agents Telegram", "500 produits", "10 000 messages/mois", "50 campagnes Telegram Ads", "10 livreurs", "IA Assistant", "Rapports PDF", "Paiement Mobile Money", "Support prioritaire"],
    },
    {
      key: "enterprise",
      name: "Enterprise",
      price: 69900,
      features: ["Contacts illimites", "Agents illimites", "Produits illimites", "Messages illimites", "Campagnes illimitees", "IA avancee", "API complete", "White-label", "Support 24/7"],
    },
  ];

  const config = PAYMENT_CONFIG[paymentMethod as keyof typeof PAYMENT_CONFIG];

  // Si un plan cible est passé en props, skip la sélection
  useEffect(() => {
    if (targetPlan) {
      setSelectedPlan(targetPlan);
      setStep("method");
    }
  }, [targetPlan]);

  return (
    <>
      <Header title="Paiement Mobile Money" subtitle="Abonnez-vous via Orange Money ou MTN Mobile Money" />

      <div className="p-6 animate-fade-in space-y-6 max-w-4xl">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {(["select", "method", "pay", "confirm", "done"] as Step[]).map((s, i) => {
            const labels = ["Plan", "Methode", "Paiement", "Confirmation", "Termine"];
            const stepOrder = ["select", "method", "pay", "confirm", "done"];
            const currentIndex = stepOrder.indexOf(step);
            const isActive = i === currentIndex;
            const isDone = i < currentIndex;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isDone
                      ? "bg-[#25D366] text-white"
                      : isActive
                      ? "bg-[#25D366] text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs hidden sm:inline ${isActive || isDone ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {labels[i]}
                </span>
                {i < 4 && <div className={`flex-1 h-px ${i < currentIndex ? "bg-[#25D366]" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>

        {/* STEP 1: Select Plan */}
        {step === "select" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground">Choisissez votre plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <Card
                  key={p.key}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    currentPlan === p.key
                      ? "ring-2 ring-[#25D366] border-[#25D366]"
                      : selectedPlan === p.key
                      ? "ring-2 ring-primary border-primary"
                      : ""
                  } ${p.popular ? "border-orange-300" : ""}`}
                  onClick={() => {
                    if (currentPlan === p.key) return;
                    setSelectedPlan(p.key);
                    setStep("method");
                  }}
                >
                  {p.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-[#FF6600] text-white text-[10px]">Populaire</Badge>
                    </div>
                  )}
                  <CardContent className="p-5">
                    <p className="font-semibold text-foreground mb-1">{p.name}</p>
                    <p className="text-2xl font-bold text-foreground mb-3">
                      {new Intl.NumberFormat("fr-FR").format(p.price)}
                      <span className="text-sm font-normal text-muted-foreground"> FCFA/mois</span>
                    </p>
                    <ul className="space-y-1.5">
                      {p.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="w-3 h-3 text-[#25D366] shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-4 ${
                        currentPlan === p.key
                          ? "bg-muted text-muted-foreground"
                          : "bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                      }`}
                      disabled={currentPlan === p.key}
                    >
                      {currentPlan === p.key ? "Plan actuel" : "Choisir"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Select Payment Method */}
        {step === "method" && (
          <div className="space-y-4">
            <button
              onClick={() => setStep("select")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Retour aux plans
            </button>

            <h2 className="text-lg font-semibold text-foreground">
              Methode de paiement pour {PLAN_NAMES[selectedPlan]}
            </h2>
            <p className="text-sm text-muted-foreground">
              Montant a payer : <span className="font-bold text-foreground">{formatPrice(PLAN_PRICES[selectedPlan])}</span>
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(PAYMENT_CONFIG) as Array<keyof typeof PAYMENT_CONFIG>).map((method) => {
                const m = PAYMENT_CONFIG[method];
                return (
                  <Card
                    key={method}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      paymentMethod === method ? `ring-2 ${method === "orange_money" ? "ring-orange-500" : "ring-yellow-500"}` : ""
                    }`}
                    onClick={() => {
                      setPaymentMethod(method);
                      setStep("pay");
                    }}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-14 h-14 rounded-xl ${m.bgColor} flex items-center justify-center`}
                        >
                          <Smartphone className={`w-7 h-7 ${m.textColor}`} />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-lg">{m.name}</p>
                          <p className="text-xs text-muted-foreground">Paiement mobile instantane</p>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-xs text-muted-foreground">Envoyez a</p>
                        {editingNumbers && isAdmin ? (
                          <Input
                            value={method === "orange_money" ? orangeNumber : mtnNumber}
                            onChange={(e) => { if (method === "orange_money") setOrangeNumber(e.target.value); else setMtnNumber(e.target.value); }}
                            className="mt-1 font-mono text-lg h-8"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <p className="font-mono font-bold text-foreground text-lg">{getPaymentNumber(method)}</p>
                        )}
                      </div>
                      <Button
                        className={`w-full mt-4 ${
                          method === "orange_money"
                            ? "bg-[#FF6600] hover:bg-[#FF6600]/90 text-white"
                            : "bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-gray-900"
                        }`}
                      >
                        Payer avec {m.name} <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Admin: Edit numbers button */}
            {isAdmin && (
              <div className="flex justify-end mt-2">
                {editingNumbers ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingNumbers(false)}>Annuler</Button>
                    <Button size="sm" className="bg-[#25D366] text-white" onClick={handleSaveNumbers} disabled={savingNumbers}>
                      {savingNumbers ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                      Enregistrer
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setEditingNumbers(true)}>
                    ✏️ Modifier les numeros de reception
                  </Button>
                )}
              </div>
            )}

            {/* Separator */}
            <div className="relative my-6">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground font-medium">OU</span>
            </div>

            {/* Chariow Online Payment Card */}
            <Card
              className="border-2 border-[#ffcc00]/40 hover:border-[#ffcc00]/70 transition-all hover:shadow-md cursor-pointer group"
              onClick={async () => {
                if (!selectedPlan) { toast.error("Veuillez d'abord selectionner un plan"); return; }
                try {
                  const res = await fetch("/api/chariow/checkout", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ plan: selectedPlan }),
                  });
                  const data = await res.json();
                  if (!res.ok) { toast.error(data.error || "Erreur de paiement"); setError(data.error || "Erreur de paiement"); return; }
                  if (data.checkoutUrl) {
                    window.open(data.checkoutUrl, "_blank", "noopener,noreferrer");
                    toast.info("Page de paiement Chariow ouverte dans un nouvel onglet");
                  } else if (data.status === "completed") {
                    toast.success("Paiement deja effectue pour ce plan !");
                  }
                } catch { toast.error("Erreur de connexion au service de paiement"); }
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#ffcc00]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CreditCard className="w-7 h-7 text-[#ffcc00]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-lg">Paiement en ligne</p>
                      <Badge className="bg-[#ffcc00] text-gray-900 text-[10px] font-bold">Chariow</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Carte bancaire, Mobile Money, paiement securise</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-[#ffcc00] group-hover:translate-x-1 transition-all" />
                </div>
                <div className="mt-4 p-3 bg-[#ffcc00]/5 rounded-lg border border-[#ffcc00]/10">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ffcc00]" />
                    <p className="text-xs text-muted-foreground">Paiement instantane et automatique. Votre plan est active immediatement apres confirmation.</p>
                  </div>
                </div>
                <Button className="w-full mt-4 bg-[#ffcc00] hover:bg-[#ffcc00]/90 text-gray-900 font-semibold">
                  Payer en ligne avec Chariow <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
        {step === "pay" && config && (
          <div className="space-y-4">
            <button
              onClick={() => setStep("method")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Changer de methode
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Instructions */}
              <Card className={`border-2 ${config.borderColor}`}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className={`w-4 h-4 ${config.textColor}`} />
                    Instructions {config.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-xs text-muted-foreground mb-1">Montant a envoyer</p>
                    <p className="text-3xl font-bold text-foreground">
                      {formatPrice(PLAN_PRICES[selectedPlan])}
                    </p>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground mb-1">Numero du destinataire</p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-xl font-mono font-bold text-foreground">{getPaymentNumber(paymentMethod)}</p>
                      <button onClick={() => handleCopy(getPaymentNumber(paymentMethod))} className="p-1.5 hover:bg-muted-foreground/10 rounded">
                        {copied ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Etapes a suivre :</p>
                    {config.instructions.map((inst, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center shrink-0`}>
                          <span className={`text-xs font-bold ${config.textColor}`}>{i + 1}</span>
                        </div>
                        <p className="text-sm text-foreground pt-0.5">{inst}</p>
                      </div>
                    ))}
                  </div>

                  <div className={`p-3 rounded-lg ${config.bgColor} flex items-start gap-2`}>
                    <Info className={`w-4 h-4 ${config.textColor} mt-0.5 shrink-0`} />
                    <p className="text-xs text-foreground">
                      Apres avoir effectue le transfert, notez le <strong>numero de transaction</strong> qui vous sera communique par SMS ou dans l&apos;historique de votre application.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Formulaire */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Confirmer votre paiement
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={`${paymentMethod === "orange_money" ? "bg-[#FF6600]" : "bg-[#FFCC00] text-gray-900"}`}>
                      {config.name}
                    </Badge>
                    <Badge variant="outline">{PLAN_NAMES[selectedPlan]}</Badge>
                    <span className="text-sm font-bold text-foreground">{formatPrice(PLAN_PRICES[selectedPlan])}</span>
                  </div>

                  <div>
                    <Label htmlFor="senderPhone">Votre numero de telephone *</Label>
                    <Input
                      id="senderPhone"
                      placeholder="+237 6XX XXX XXX"
                      value={form.senderPhone}
                      onChange={(e) => setForm({ ...form, senderPhone: e.target.value })}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Le numero depuis lequel vous avez effectue le transfert</p>
                  </div>

                  <div>
                    <Label htmlFor="senderName">Votre nom complet</Label>
                    <Input
                      id="senderName"
                      placeholder="Jean Dupont"
                      value={form.senderName}
                      onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="transactionRef">Numero de transaction *</Label>
                    <Input
                      id="transactionRef"
                      placeholder="Ex: OM2024010100001 ou MTN202401..."
                      value={form.transactionRef}
                      onChange={(e) => setForm({ ...form, transactionRef: e.target.value })}
                      className="mt-1 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ce numero se trouve dans le SMS de confirmation ou dans votre historique
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Votre demande sera verifiee par notre equipe dans les plus brefs delais (sous 24h).
                      Vous recevrez une confirmation une fois le paiement valide.
                    </p>
                  </div>

                  <Button
                    className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                    onClick={() => {
                      setStep("confirm");
                    }}
                    disabled={!form.transactionRef.trim() || !form.senderPhone.trim()}
                  >
                    Verifier et soumettre <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* STEP 4: Confirmation */}
        {step === "confirm" && config && (
          <Card className="max-w-lg mx-auto">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground text-center">Confirmez votre paiement</h3>

              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium text-foreground">{PLAN_NAMES[selectedPlan]}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold text-foreground">{formatPrice(PLAN_PRICES[selectedPlan])}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Methode</span>
                  <span className="font-medium text-foreground">{config.name}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Numero expediteur</span>
                  <span className="font-mono text-foreground">{form.senderPhone}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">N° Transaction</span>
                  <span className="font-mono text-foreground">{form.transactionRef}</span>
                </div>
                {form.senderName && (
                  <>
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Nom</span>
                      <span className="text-foreground">{form.senderName}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep("pay")}>
                  <ArrowLeft className="w-4 h-4 mr-1" /> Modifier
                </Button>
                <Button
                  className="flex-1 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                  onClick={handleSubmitPayment}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Confirmer le paiement
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 5: Done */}
        {step === "done" && paymentResult && (
          <Card className="max-w-lg mx-auto">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Demande de paiement envoyee !</h3>
              <p className="text-sm text-muted-foreground">
                Votre demande de paiement a ete soumise avec succes. Notre equipe va verifier votre transaction et activer votre plan dans les plus brefs delais.
              </p>

              <div className="p-4 bg-muted rounded-lg text-left space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono font-bold text-[#25D366]">{paymentResult.reference}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium text-foreground">{PLAN_NAMES[paymentResult.plan]}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="font-bold text-foreground">{formatPrice(paymentResult.amount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  {statusBadge(paymentResult.status)}
                </div>
              </div>

              <div className="p-3 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg flex items-start gap-2 text-left">
                <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-xs text-yellow-800 dark:text-yellow-300">
                  Conservez votre reference <strong>{paymentResult.reference}</strong> pour le suivi. Vous pouvez verifier le statut dans l&apos;historique ci-dessous.
                </p>
              </div>

              <Button
                className="w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white"
                onClick={() => {
                  setStep("select");
                  setSelectedPlan("");
                  setPaymentMethod("");
                  setForm({ transactionRef: "", senderPhone: "", senderName: "" });
                  setPaymentResult(null);
                }}
              >
                Effectuer un autre paiement
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Historique des paiements */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Historique des paiements
              {payments.length > 0 && (
                <Badge variant="outline" className="ml-auto">{payments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Aucun paiement pour le moment</p>
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        p.paymentMethod === "orange_money" ? "bg-orange-100 dark:bg-orange-500/20" : "bg-yellow-100 dark:bg-yellow-500/20"
                      }`}>
                        <Smartphone className={`w-5 h-5 ${
                          p.paymentMethod === "orange_money" ? "text-orange-500" : "text-yellow-600"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{PLAN_NAMES[p.plan] || p.plan}</p>
                          {statusBadge(p.status)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {p.reference} - {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                        </p>
                        {p.rejectionReason && (
                          <p className="text-xs text-red-500 mt-0.5">Raison: {p.rejectionReason}</p>
                        )}
                      </div>
                    </div>
                    <p className="font-bold text-foreground text-sm">{formatPrice(p.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}