# ChatCommerce CRM Africa — Guide de Déploiement Vercel

## ⚡ Variables d'Environnement Obligatoires

Ajoutez ces variables dans **Vercel Dashboard > Settings > Environment Variables** :

| Variable | Valeur | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_Vu1EqLD0fyxl@ep-icy-bar-ayw4j64r-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require` | Neon PostgreSQL (Pooled) |
| `JWT_SECRET` | `chatcommerce-africa-super-secret-key-2024` | Clé secrète JWT (min 16 chars) |
| `CRON_SECRET` | `chatcommerce-cron-secret-key-2024` | Protection du endpoint cron |

### Optionnel

| Variable | Valeur | Description |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Votre token Bot Father | Pour les bots Telegram |
| `NODE_ENV` | `production` | Défini automatiquement par Vercel |

## 📋 Étapes de Déploiement

### 1. Vercel est déjà connecté via GitHub
Chaque `git push` sur `main` déclenche un déploiement automatique.

### 2. Vérifier le déploiement
- Allez sur https://vercel.com/dashboard
- Le projet devrait apparaître avec un déploiement en cours/succès
- L'URL de production est du type `chatcommerce-crm-africa.vercel.app`

### 3. Premier lancement
Après le déploiement, visitez l'URL et :
- Les comptes admin/demo sont créés automatiquement (seed)
- **Admin** : `admin@chatcommerce.africa` / `Admin@2024`
- **Demo** : `demo@chatcommerce.africa` / `Demo@2024`

## 🔧 Corrections Appliquées (Commit 6f4d48c)

### Bug Critique 1 — Clauses Prisma Invalides (13 fichiers)
Les opérations `update()` et `delete()` utilisaient `{ id, companyId }` dans le `where`, mais aucun index unique n'existe sur cette combinaison. Résultat : erreur Prisma P2025/P2024.

**Fix** : Vérification d'appartenance via `findFirst()` avant chaque `update/delete`.

### Bug Critique 2 — SSE Timeout sur Vercel
L'endpoint SSE `/api/notifications/stream` maintient une connexion ouverte indéfiniment. Vercel limite les fonctions serverless à 10s (Hobby) / 60s (Pro).

**Fix** : Nouvel endpoint `/api/notifications/poll` + polling côté client toutes les 8s.

### Bug Critique 3 — JWT Secret Fallback
Le code utilisait `DATABASE_URL` comme fallback pour la clé JWT. Si cette variable changeait, tous les tokens étaient invalidés.

**Fix** : Fallback dev-only, jamais `DATABASE_URL`.

### Optimisation — Dashboard N+1
Le dashboard lançait jusqu'à 90 requêtes PostgreSQL individuelles pour le graphique de revenus quotidiens.

**Fix** : Requête SQL unique avec `GROUP BY DATE("createdAt")`.

## 📊 Fonctionnalités Déployées (33 API Routes)

Auth | Dashboard | Contacts | Conversations | Produits | Commandes | Leads | Automatisations | Telegram | Paiements | Rapports | Notifications | Sync | Cron
