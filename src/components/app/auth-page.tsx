"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";

export default function AuthPage() {
  const { setAuth } = useAppStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "demo@chatcommerce.africa",
    password: "demo",
    companyName: "",
    country: "Cameroun",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "/api/auth" : "/api/auth";
      const body =
        mode === "login"
          ? { action: "login", email: form.email, password: form.password }
          : {
              action: "register",
              name: form.name,
              email: form.email,
              password: form.password,
              companyName: form.companyName,
              country: form.country,
              phone: form.phone,
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");

      setAuth(data.token, {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        company: data.company,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
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

      setAuth(data.token, {
        id: data.user.id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        company: data.company,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0F172A] text-white flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-[#25D366] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-48 h-48 bg-[#2563EB] rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md text-center">
          <div className="w-20 h-20 bg-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-500/20">
            <MessageCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">ChatCommerce</h1>
          <p className="text-lg text-gray-300 mb-2">CRM Africa</p>
          <p className="text-gray-400 leading-relaxed">
            Le premier CRM WhatsApp conçu pour les entreprises africaines.
            Gérez vos clients, automatisez vos conversations et augmentez
            vos revenus.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {["Cameroun", "Côte d'Ivoire", "Sénégal", "Gabon", "Congo", "Guinée Équatoriale"].map((c) => (
              <span key={c} className="px-3 py-1 bg-white/10 rounded-full text-sm text-gray-300">
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-12 h-12 bg-[#25D366] rounded-xl flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]">ChatCommerce</h1>
              <p className="text-xs text-gray-500">CRM Africa</p>
            </div>
          </div>

          <Card className="border-0 shadow-xl shadow-gray-200/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">
                {mode === "login" ? "Connexion" : "Créer un compte"}
              </CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Accédez à votre espace de gestion"
                  : "Démarrez avec ChatCommerce gratuitement"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "register" && (
                  <>
                    <div>
                      <Label>Nom complet</Label>
                      <Input
                        placeholder="Marie Nkoulou"
                        value={form.name}
                        onChange={(e) => updateForm("name", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Nom de l'entreprise</Label>
                      <Input
                        placeholder="Mon Restaurant"
                        value={form.companyName}
                        onChange={(e) => updateForm("companyName", e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label>Pays</Label>
                      <select
                        value={form.country}
                        onChange={(e) => updateForm("country", e.target.value)}
                        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                      >
                        {["Cameroun", "Gabon", "Congo", "Guinée Équatoriale", "Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Guinée", "Togo", "Bénin"].map(
                          (c) => (
                            <option key={c} value={c}>{c}</option>
                          )
                        )}
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="vous@exemple.com"
                    value={form.email}
                    onChange={(e) => updateForm("email", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Mot de passe</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => updateForm("password", e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">{error}</p>
                )}

                <Button
                  type="submit"
                  className="w-full bg-[#0F172A] hover:bg-[#1e293b]"
                  disabled={loading}
                >
                  {loading ? "Chargement..." : mode === "login" ? "Se connecter" : "Créer le compte"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[#25D366] text-[#128C7E] hover:bg-[#25D366] hover:text-white"
                  onClick={handleDemo}
                  disabled={loading}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Essayer la démo
                </Button>

                <p className="text-center text-sm text-muted-foreground mt-4">
                  {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
                  <button
                    type="button"
                    className="text-[#25D366] font-medium hover:underline"
                    onClick={() => {
                      setMode(mode === "login" ? "register" : "login");
                      setError("");
                    }}
                  >
                    {mode === "login" ? "S'inscrire" : "Se connecter"}
                  </button>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}