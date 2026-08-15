# ChatCommerce CRM Africa — Guide de Configuration Production

## ⚡ Variables d'Environnement Obligatoires (Vercel)

Configurez dans **Vercel Dashboard > Settings > Environment Variables** pour Production, Preview ET Development :

| Variable | Description | Exemple |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (Pooled) | `postgresql://user:pass@ep-xxx.pooler.neon.tech/dbname?sslmode=require` |
| `JWT_SECRET` | Clé secrète JWT (MIN 32 caractères) | `chatcommerce-africa-super-secret-jwt-key-2024-xK9mZ` |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | `AXkASg...` |

## 📦 Étapes de Configuration

### 1. Base de données Neon PostgreSQL
1. Créer un compte sur [neon.tech](https://neon.tech)
2. Créer un nouveau projet (Region: US East 2 recommended)
3. Copier la **Connection String (Pooled)** dans `DATABASE_URL`
4. La pooled connection est obligatoire pour Vercel serverless

### 2. Upstash Redis (Rate Limiting)
1. Créer un compte sur [upstash.com](https://upstash.com)
2. Créer une base Redis (Free tier: 10K commands/day)
3. Copier l'**REST URL** dans `UPSTASH_REDIS_REST_URL`
4. Copier le **REST Token** dans `UPSTASH_REDIS_REST_TOKEN`

### 3. Générer un JWT Secret sécurisé
```bash
# Dans un terminal :
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```
Copier le résultat dans `JWT_SECRET`

### 4. Appliquer le schéma Prisma
```bash
# Avec le DATABASE_URL de Neon configuré localement :
DATABASE_URL="postgresql://..." npx prisma db push
```
Ou via le build Vercel qui exécute automatiquement `prisma db push --skip-generate`

## 🔒 Variables d'Environnement Optionnelles

| Variable | Description |
|---|---|
| `MISTRAL_API_KEY` | Clé API Mistral pour les bots IA Telegram |
| `CHARIOW_API_KEY` | Clé API Chariow pour les paiements |
| `CHARIOW_WEBHOOK_SECRET` | Secret webhook Chariow |
| `ADMIN_PASSWORD` | Mot de passe admin personnalisé (défaut: Admin@2024) |

## 🚀 Déploiement

### Via Git (recommandé)
Chaque `git push` sur `main` déclenche un déploiement automatique.

### Via Vercel CLI
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Premier lancement
Après le déploiement :
- Le bootstrap automatique crée l'admin et l'entreprise
- **Admin** : `admin@chatcommerce.africa` / `Admin@2024`

## 🔧 Rate Limiting Configuré

Les routes suivantes sont protégées par rate limiting Redis :
- `/api/auth/login` : 5 tentatives / minute
- `/api/auth/register` : 3 inscriptions / minute
- `/api/auth/phone/send-otp` : 5 OTP / minute

En développement (sans Upstash), un fallback in-memory est utilisé automatiquement.

## 📊 Fichiers Modifiés (Session Actuelle)

- `prisma/schema.prisma` — driverEarnings : ajout @db.Decimal(19,2)
- `src/lib/rate-limit.ts` — Nouveau : module Upstash Redis rate limiting
- `src/middleware.ts` — Rate limiting middleware sur routes publiques sensibles
- `src/lib/utils.ts` — Ajout helper toNum() Decimal→number
- 15 fichiers API — Corrections TypeScript Decimal→Number
