"use client";

import { useState } from "react";
import Header from "./header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Search,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Lock,
  Users,
  Package,
  ShoppingCart,
  Bot,
  BarChart3,
  ArrowLeftRight,
  Zap,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

interface ApiEndpoint {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  title: string;
  description: string;
  headers?: string;
  requestBody?: string;
  responseBody: string;
  notes?: string;
}

interface ApiSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  endpoints: ApiEndpoint[];
}

// ─── Method Badge Color ────────────────────────────────────

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  PATCH: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  PUT: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

// ─── API Sections Data ─────────────────────────────────────

const API_SECTIONS: ApiSection[] = [
  {
    id: "auth",
    title: "Authentification",
    icon: Lock,
    description: "Gestion de l'authentification et des tokens",
    endpoints: [
      {
        method: "POST",
        path: "/api/auth",
        title: "Connexion",
        description: "Authentifier un utilisateur et obtenir un token JWT",
        headers: "Content-Type: application/json",
        requestBody: JSON.stringify(
          {
            email: "admin@example.com",
            password: "monMotDePasse",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            token: "eyJhbGciOiJIUzI1NiIs...",
            user: {
              id: "clxxx",
              name: "Jean Dupont",
              email: "admin@example.com",
              role: "company_admin",
              company: {
                id: "clxxx",
                name: "Mon Entreprise",
                plan: "business",
                country: "Cameroun",
              },
            },
          },
          null,
          2
        ),
        notes: "Le token doit être inclus dans l'en-tête Authorization pour toutes les requêtes ultérieures.",
      },
      {
        method: "POST",
        path: "/api/auth",
        title: "Mettre à jour le profil",
        description: "Modifier le nom et le téléphone de l'utilisateur connecté",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            action: "update_profile",
            name: "Jean NouveauNom",
            phone: "+237 612 345 678",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            message: "Profil mis à jour",
          },
          null,
          2
        ),
      },
      {
        method: "POST",
        path: "/api/auth",
        title: "Changer le mot de passe",
        description: "Modifier le mot de passe de l'utilisateur connecté",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            action: "change_password",
            currentPassword: "ancienMotDePasse",
            newPassword: "nouveauMotDePasse123",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            message: "Mot de passe mis à jour",
          },
          null,
          2
        ),
      },
    ],
  },
  {
    id: "contacts",
    title: "Contacts",
    icon: Users,
    description: "Gestion des contacts clients",
    endpoints: [
      {
        method: "GET",
        path: "/api/contacts",
        title: "Lister les contacts",
        description: "Récupérer la liste des contacts avec pagination et recherche",
        headers: "Authorization: Bearer <token>",
        requestBody: undefined,
        responseBody: JSON.stringify(
          {
            contacts: [
              {
                id: "clxxx",
                name: "Marie Ngassa",
                phone: "+237 699 123 456",
                email: "marie@example.com",
                tags: "vip,client-regulier",
                totalSpent: 125000,
                orderCount: 8,
                source: "whatsapp",
              },
            ],
            total: 42,
            page: 1,
            limit: 20,
          },
          null,
          2
        ),
      },
      {
        method: "POST",
        path: "/api/contacts",
        title: "Créer un contact",
        description: "Ajouter un nouveau contact",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            name: "Paul Kamga",
            phone: "+237 677 888 999",
            email: "paul@example.com",
            tags: "nouveau",
            city: "Douala",
            country: "Cameroun",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            contact: {
              id: "clxxx",
              name: "Paul Kamga",
              phone: "+237 677 888 999",
              createdAt: "2025-01-15T10:30:00Z",
            },
            message: "Contact créé",
          },
          null,
          2
        ),
      },
      {
        method: "PATCH",
        path: "/api/contacts",
        title: "Modifier un contact",
        description: "Mettre à jour les informations d'un contact existant",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            id: "clxxx",
            name: "Paul Kamga Modifié",
            tags: "nouveau,vip",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            message: "Contact mis à jour",
          },
          null,
          2
        ),
      },
    ],
  },
  {
    id: "products",
    title: "Produits",
    icon: Package,
    description: "Gestion du catalogue produits",
    endpoints: [
      {
        method: "GET",
        path: "/api/products",
        title: "Lister les produits",
        description: "Récupérer tous les produits avec recherche optionnelle",
        headers: "Authorization: Bearer <token>",
        requestBody: undefined,
        responseBody: JSON.stringify(
          {
            products: [
              {
                id: "clxxx",
                name: "Poulet DG",
                description: "Poulet à l'ail",
                price: 4500,
                sku: "PDG-001",
                stock: 25,
                isActive: true,
                category: { id: "clxxx", name: "Plats" },
              },
            ],
          },
          null,
          2
        ),
      },
      {
        method: "POST",
        path: "/api/products",
        title: "Créer un produit",
        description: "Ajouter un nouveau produit au catalogue",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            name: "Poulet DG",
            description: "Poulet à l'ail avec plantain",
            price: 4500,
            sku: "PDG-001",
            stock: 25,
            categoryId: "clxxx",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            product: { id: "clxxx", name: "Poulet DG", price: 4500 },
            message: "Produit créé",
          },
          null,
          2
        ),
      },
      {
        method: "PATCH",
        path: "/api/products",
        title: "Modifier un produit",
        description: "Mettre à jour les informations d'un produit",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            id: "clxxx",
            name: "Poulet DG",
            price: 5000,
            stock: 30,
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          { message: "Produit mis à jour" },
          null,
          2
        ),
      },
      {
        method: "DELETE",
        path: "/api/products?id=clxxx",
        title: "Supprimer un produit",
        description: "Retirer un produit du catalogue",
        headers: "Authorization: Bearer <token>",
        requestBody: undefined,
        responseBody: JSON.stringify(
          { message: "Produit supprimé" },
          null,
          2
        ),
      },
    ],
  },
  {
    id: "telegram",
    title: "Agents Telegram",
    icon: Bot,
    description: "Gestion des bots de réservation Telegram",
    endpoints: [
      {
        method: "GET",
        path: "/api/telegram/agents",
        title: "Lister les agents",
        description: "Récupérer tous les agents Telegram de l'entreprise",
        headers: "Authorization: Bearer <token>",
        requestBody: undefined,
        responseBody: JSON.stringify(
          {
            agents: [
              {
                id: "clxxx",
                name: "Bot Restaurant Le Paradis",
                botUsername: "@leparadis_bot",
                businessType: "restaurant",
                isActive: true,
                currency: "XAF",
                _count: { services: 12, bookings: 45 },
              },
            ],
          },
          null,
          2
        ),
      },
      {
        method: "POST",
        path: "/api/telegram/agents",
        title: "Créer un agent",
        description: "Créer un nouvel agent Telegram",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            name: "Mon Restaurant",
            token: "123456:ABC-DEF...",
            businessType: "restaurant",
            currency: "XAF",
            welcomeMessage: "Bienvenue ! Tapez /menu pour voir nos plats.",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            agent: { id: "clxxx", name: "Mon Restaurant" },
            message: "Agent créé",
          },
          null,
          2
        ),
      },
      {
        method: "GET",
        path: "/api/telegram/agents/:id/services",
        title: "Lister les services",
        description: "Récupérer les services d'un agent",
        headers: "Authorization: Bearer <token>",
        requestBody: undefined,
        responseBody: JSON.stringify(
          {
            services: [
              {
                id: "clxxx",
                name: "Poulet DG",
                description: "Poulet à l'ail avec plantain",
                price: 4500,
                duration: null,
                isActive: true,
              },
            ],
          },
          null,
          2
        ),
      },
      {
        method: "POST",
        path: "/api/telegram/agents/:id/services",
        title: "Créer un service",
        description: "Ajouter un service à un agent",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            name: "Poulet DG",
            description: "Poulet à l'ail",
            price: 4500,
            duration: null,
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          { message: "Service ajouté" },
          null,
          2
        ),
      },
      {
        method: "POST",
        path: "/api/telegram/ai",
        title: "Réponse IA",
        description: "Générer une réponse IA pour un message client",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            message: "Je voudrais commander du poulet DG",
            agentId: "clxxx",
            conversationHistory: [
              { role: "user", content: "Bonjour" },
              { role: "assistant", content: "Bonjour ! Bienvenue..." },
            ],
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            response: "Très bien ! Le Poulet DG est disponible à 4 500 FCFA. Souhaitez-vous commander ?",
            matchedService: {
              name: "Poulet DG",
              price: 4500,
              confidence: 0.85,
            },
            aiEnabled: true,
          },
          null,
          2
        ),
      },
    ],
  },
  {
    id: "bookings",
    title: "Réservations",
    icon: ShoppingCart,
    description: "Gestion des réservations et commandes",
    endpoints: [
      {
        method: "GET",
        path: "/api/telegram/bookings",
        title: "Lister les réservations",
        description: "Récupérer les réservations avec filtre par statut",
        headers: "Authorization: Bearer <token>",
        requestBody: undefined,
        responseBody: JSON.stringify(
          {
            bookings: [
              {
                id: "clxxx",
                customerName: "Marie Ngassa",
                serviceName: "Poulet DG",
                bookingDate: "2025-01-20",
                bookingTime: "12:00",
                status: "pending",
                agent: { name: "Bot Le Paradis", businessType: "restaurant" },
              },
            ],
          },
          null,
          2
        ),
      },
      {
        method: "POST",
        path: "/api/telegram/bookings",
        title: "Créer une réservation",
        description: "Enregistrer une nouvelle réservation",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            agentId: "clxxx",
            chatId: "123456789",
            customerName: "Marie Ngassa",
            customerPhone: "+237 699 123 456",
            serviceId: "clxxx",
            serviceName: "Poulet DG",
            bookingDate: "2025-01-20",
            bookingTime: "12:00",
            notes: "Sans piment",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            booking: { id: "clxxx", status: "pending" },
            message: "Réservation créée",
          },
          null,
          2
        ),
      },
      {
        method: "PUT",
        path: "/api/telegram/bookings",
        title: "Modifier le statut",
        description: "Mettre à jour le statut d'une réservation",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            id: "clxxx",
            status: "confirmed",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          { message: "Réservation confirmée" },
          null,
          2
        ),
      },
    ],
  },
  {
    id: "reports",
    title: "Rapports",
    icon: BarChart3,
    description: "Statistiques et rapports d'activité",
    endpoints: [
      {
        method: "GET",
        path: "/api/reports?type=bookings&period=7d",
        title: "Rapport de réservations",
        description: "Statistiques sur les réservations pour une période donnée",
        headers: "Authorization: Bearer <token>",
        requestBody: undefined,
        responseBody: JSON.stringify(
          {
            type: "bookings",
            period: "7d",
            data: {
              total: 45,
              byStatus: {
                pending: 8,
                confirmed: 22,
                completed: 12,
                cancelled: 3,
              },
              daily: [
                { date: "2025-01-14", count: 5 },
                { date: "2025-01-15", count: 8 },
              ],
            },
          },
          null,
          2
        ),
        notes: "Types disponibles: bookings, contacts, revenue. Périodes: 7d, 30d, 90d, 1y",
      },
    ],
  },
  {
    id: "sync",
    title: "Synchronisation",
    icon: ArrowLeftRight,
    description: "Synchronisation des produits et services",
    endpoints: [
      {
        method: "POST",
        path: "/api/sync",
        title: "Synchroniser",
        description: "Lancer une synchronisation manuelle des produits/services",
        headers: "Authorization: Bearer <token>\nContent-Type: application/json",
        requestBody: JSON.stringify(
          {
            source: "products",
            target: "telegram",
            agentId: "clxxx",
          },
          null,
          2
        ),
        responseBody: JSON.stringify(
          {
            message: "Synchronisation terminée",
            synced: 12,
            errors: 0,
          },
          null,
          2
        ),
      },
    ],
  },
  {
    id: "sse",
    title: "Webhooks & SSE",
    icon: Zap,
    description: "Notifications en temps réel via Server-Sent Events",
    endpoints: [
      {
        method: "GET",
        path: "/api/notifications/stream",
        title: "Flux SSE de notifications",
        description: "Connexion SSE pour recevoir les notifications en temps réel",
        headers: "Authorization: Bearer <token>\nAccept: text/event-stream",
        requestBody: undefined,
        responseBody: "// Flux d'événements SSE:\n\ndata: {\"type\":\"new_booking\",\"booking\":{\"id\":\"clxxx\",\"customerName\":\"Marie\"}}\n\ndata: {\"type\":\"new_order\",\"order\":{\"id\":\"clxxx\"}}\n\ndata: {\"type\":\"payment_confirmed\",\"payment\":{\"id\":\"clxxx\"}}",
        notes: "La connexion reste ouverte et envoie des événements en temps réel. Utilisez EventSource côté client.",
      },
    ],
  },
];

// ─── Code Block Component ──────────────────────────────────

function CodeBlock({
  title,
  code,
  onCopy,
}: {
  title: string;
  code: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg overflow-hidden border">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 dark:bg-zinc-900 text-zinc-300">
        <span className="text-xs font-medium">{title}</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-zinc-400 hover:text-white hover:bg-zinc-700"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="w-3 h-3 text-green-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      </div>
      <pre className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-3 overflow-x-auto text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─── Endpoint Card Component ───────────────────────────────

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [expanded, setExpanded] = useState(true);
  const methodStyle = METHOD_STYLES[endpoint.method] || METHOD_STYLES.GET;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-bold px-2 py-1 rounded ${methodStyle}`}>
              {endpoint.method}
            </span>
            <code className="text-sm font-mono text-foreground">{endpoint.path}</code>
          </div>
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-medium">{endpoint.title}</CardTitle>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <CardDescription className="text-xs mt-1">{endpoint.description}</CardDescription>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {endpoint.headers && (
            <CodeBlock
              title="En-têtes (Headers)"
              code={endpoint.headers}
              onCopy={() => toast.success("En-têtes copiés")}
            />
          )}
          {endpoint.requestBody && (
            <CodeBlock
              title="Corps de la requête (Body)"
              code={endpoint.requestBody}
              onCopy={() => toast.success("Requête copiée")}
            />
          )}
          <CodeBlock
            title="Réponse (Response)"
            code={endpoint.responseBody}
            onCopy={() => toast.success("Réponse copiée")}
          />
          {endpoint.notes && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Note :</span> {endpoint.notes}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────

export default function ApiDocsPage() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState(API_SECTIONS[0].id);

  const filteredSections = API_SECTIONS.map((section) => ({
    ...section,
    endpoints: section.endpoints.filter(
      (ep) =>
        ep.title.toLowerCase().includes(search.toLowerCase()) ||
        ep.path.toLowerCase().includes(search.toLowerCase()) ||
        ep.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((section) => section.endpoints.length > 0);

  return (
    <>
      <Header title="Documentation API" subtitle="Référence complète des endpoints ChatCommerce CRM Africa">
        <Badge variant="outline" className="text-xs">
          v1.0
        </Badge>
      </Header>

      <div className="p-4 md:p-6 animate-fade-in space-y-6">
        {/* Overview Card */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-[#25D366]" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Base URL</h2>
                  <p className="text-xs text-muted-foreground">
                    Toutes les requêtes sont relatives à votre domaine
                  </p>
                </div>
              </div>
              <div className="flex-1 md:ml-auto">
                <CodeBlock
                  title="Base"
                  code="https://votre-domaine.com"
                  onCopy={() => toast.success("URL copiée")}
                />
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Authentification :</span>{" "}
                Toutes les requêtes (sauf POST /api/auth) nécessitent l&apos;en-tête{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
                  Authorization: Bearer &lt;token&gt;
                </code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Search + Tabs Layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 shrink-0">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un endpoint..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <nav className="space-y-1 sticky top-6">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                      isActive
                        ? "bg-[#25D366]/10 text-[#25D366] font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#25D366]" : ""}`} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{section.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {section.endpoints.length} endpoint{section.endpoints.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {filteredSections.map((section) => {
              if (section.id !== activeSection) return null;
              const Icon = section.icon;
              return (
                <div key={section.id} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#25D366]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {section.endpoints.map((ep, idx) => (
                      <EndpointCard key={`${ep.method}-${ep.path}-${idx}`} endpoint={ep} />
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredSections.every((s) => s.id !== activeSection) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                  <p className="text-muted-foreground">Aucun endpoint trouvé pour cette recherche</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
