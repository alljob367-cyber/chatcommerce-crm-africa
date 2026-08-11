# Guide Complet : Configurer les Packs de Prix sur Chariow
## ChatCommerce CRM Africa — Monétisation des Abonnements

---

## 📋 Contexte

**Chariow** est une plateforme qui permet de vendre des produits et licences digitales en ligne.
Nous allons l'utiliser pour vendre nos **3 packs d'abonnement ChatCommerce CRM** :

| Pack | Prix | Devise |
|------|------|--------|
| **Starter** | 2 000 FCFA | XAF |
| **Business** | 29 900 FCFA | XAF |
| **Enterprise** | 99 900 FCFA | XAF |

> **Note** : Chariow prend une commission de **15%** sur chaque vente.
> Prix recommandé (après commission) :
> - Starter : ~2 350 FCFA → vendu à 2 000 FCFA (tu absorbes la commission)
> - Business : ~35 000 FCFA → vendu à 29 900 FCFA
> - Enterprise : ~117 500 FCFA → vendu à 99 900 FCFA

---

## 🚀 ÉTAPE 1 : Créer un compte Chariow

1. Va sur **https://chariow.com**
2. Clique sur **"Get Started"** ou "Commencer"
3. Inscris-toi avec ton email professionnel
4. Vérifie ton email et complète ton profil
5. Ajoute les informations de ton entreprise :
   - Nom : **ChatCommerce CRM Africa**
   - Pays : Cameroun (ou ton pays)
   - Devise : **XAF** (Franc CFA)

---

## 🔑 ÉTAPE 2 : Obtenir tes clés API

1. Connecte-toi à ton dashboard Chariow
2. Va dans **Settings** (Paramètres) → **API Keys**
3. Clique **"Create new API key"**
4. Donne-lui un nom : `chatcommerce-crm-production`
5. Copie et sauvegarde ces 2 valeurs :
   - **Publishable Key** (pk_xxx) → pour le frontend
   - **Secret Key** (sk_xxx) → pour le backend

> ⚠️ **IMPORTANT** : La Secret Key ne doit JAMAIS être exposée dans le code frontend.
> Elle doit être dans les variables d'environnement du serveur uniquement.

6. Ajoute ces variables dans Vercel (Settings → Environment Variables) :

```
CHARIOW_PUBLISHABLE_KEY=pk_live_votre_cle_ici
CHARIOW_SECRET_KEY=sk_live_votre_cle_ici
CHARIOW_WEBHOOK_SECRET=whsec_votre_secret_webhook
```

---

## 🏪 ÉTAPE 3 : Créer les 3 produits (Packs d'abonnement)

Chaque pack sera un **produit digital** sur Chariow.

### Produit 1 : Pack Starter

1. Va dans **Products** → **Create Product**
2. Remplis les informations :

| Champ | Valeur |
|-------|--------|
| **Nom du produit** | ChatCommerce CRM — Pack Starter |
| **Description** | Pack de démarrage pour les petites entreprises. Inclut : 500 contacts, 3 membres d'équipe, 50 produits, 1 000 messages/mois, 3 automatisations, 2 agents Telegram, 100 réservations. |
| **Prix** | 2 000 |
| **Devise** | XAF |
| **Type** | Licence (Licence / Abonnement) |
| **Durée de licence** | 30 jours (mensuel) |
| **Image** | Logo ChatCommerce ou image de branding |

3. Clique **"Create Product"**
4. Note l'**ID du produit** (ex: `prod_abc123`)

### Produit 2 : Pack Business

1. Clique **"Create Product"** à nouveau
2. Remplis :

| Champ | Valeur |
|-------|--------|
| **Nom du produit** | ChatCommerce CRM — Pack Business |
| **Description** | Pack professionnel pour les entreprises en croissance. Inclut : 5 000 contacts, 10 membres, 500 produits, 10 000 messages/mois, 20 automatisations, 12 agents Telegram, campagnes Telegram Ads, livraisons avec chauffeurs, 50 campagnes marketing, 5 000 réservations. |
| **Prix** | 29 900 |
| **Devise** | XAF |
| **Type** | Licence (mensuel) |
| **Durée** | 30 jours |
| **Image** | Logo ChatCommerce |

3. Note l'**ID du produit** (ex: `prod_def456`)

### Produit 3 : Pack Enterprise

1. Clique **"Create Product"** à nouveau
2. Remplis :

| Champ | Valeur |
|-------|--------|
| **Nom du produit** | ChatCommerce CRM — Pack Enterprise |
| **Description** | Pack illimité pour les grandes entreprises et franchises. Contacts illimités, membres illimités, produits illimités, messages illimités, automatisations illimitées, agents Telegram illimités, campagnes illimitées, livraisons illimitées, support prioritaire 24/7, API complète. |
| **Prix** | 99 900 |
| **Devise** | XAF |
| **Type** | Licence (mensuel) |
| **Durée** | 30 jours |
| **Image** | Logo ChatCommerce |

3. Note l'**ID du produit** (ex: `prod_ghi789`)

---

## 🔗 ÉTAPE 4 : Configurer les Licences

Chariow permet de créer des **licences d'accès**.

1. Va dans **Licenses** (Licences)
2. Pour chaque produit créé, configure une licence :

### Licence Starter
- **Produit** : Pack Starter
- **Type** : Abonnement mensuel
- **Utilisateurs max** : 1 (une licence = une entreprise)
- **Renouvellement** : Automatique

### Licence Business
- **Produit** : Pack Business
- **Type** : Abonnement mensuel
- **Utilisateurs max** : 1
- **Renouvellement** : Automatique

### Licence Enterprise
- **Produit** : Pack Enterprise
- **Type** : Abonnement mensuel
- **Utilisateurs max** : 1
- **Renouvellement** : Automatique

---

## 🌐 ÉTAPE 5 : Configurer le Webhook

Le webhook permet à Chariow de notifier ton API quand un paiement est confirmé.

1. Va dans **Settings** → **Webhooks**
2. Clique **"Add Webhook"**
3. Configure :
   - **URL** : `https://alljob367-cyber-chatcommerce-crm-af.vercel.app/api/payments/chariow-webhook`
   - **Événements** : Coche `payment.completed`, `license.activated`, `license.expired`
   - **Secret** : Le même que `CHARIOW_WEBHOOK_SECRET` dans tes env vars

4. Chariow enverra un POST à cette URL à chaque événement.

---

## 🖥️ ÉTAPE 6 : Créer les pages de paiement

### Option A — Via Chariow Checkout (Recommandé)

Utilise les **Checkout Links** de Chariow. Pour chaque produit :

1. Va dans **Products** → sélectionne ton produit
2. Clique **"Get Checkout Link"**
3. Tu obtiens un URL comme : `https://pay.chariow.com/checkout/prod_abc123`
4. Utilise ces liens dans ton CRM pour rediriger vers le paiement

### Option B — Via API intégrée (Avancé)

Pour une intégration complète dans ton dashboard :

1. Le frontend appelle ton API backend pour créer une session de paiement
2. Ton backend appelle l'API Chariow pour générer un checkout
3. Le client est redirigé vers Chariow pour payer
4. Chariow notifie ton webhook après le paiement
5. Ton webhook active le plan

---

## 📊 ÉTAPE 7 : Tableau de bord Chariow

Une fois tes produits créés, tu peux suivre dans le dashboard Chariow :

- **Ventes** : Nombre d'abonnements vendus par pack
- **Revenus** : Chiffre d'affaires par période
- **Clients** : Liste des entreprises abonnées
- **Licences actives** : Licences en cours
- **Taux de conversion** : Visites → Achats

---

## ✅ Checklist de Mise en Production

- [ ] Compte Chariow créé et vérifié
- [ ] Clés API obtenues (Publishable + Secret)
- [ ] Variables d'env configurées sur Vercel
- [ ] 3 produits créés (Starter, Business, Enterprise)
- [ ] Prix configurés en XAF
- [ ] Licences configurées (mensuelles, auto-renouvellement)
- [ ] Webhook configuré et testé
- [ ] Pages de paiement accessibles
- [ ] Première vente test effectuée

---

## 🔧 Intégration API — À faire ensuite

Une fois les packs créés sur Chariow, la prochaine étape est d'intégrer l'API Chariow dans le code du CRM :

1. **Créer `/api/payments/chariow-webhook`** — Recevoir les notifications de paiement
2. **Modifier `/api/payments/route.ts`** — Rediriger vers Chariow Checkout au lieu du paiement manuel
3. **Modifier la page paiements** — Boutons "S'abonner" qui redirigent vers Chariow
4. **Gestion des licences** — Activer/désactiver les plans automatiquement

> 📌 Pour l'intégration code, dis-moi quand les packs sont créés sur Chariow et je ferai la connexion API complète.

---

## 📞 Liens utiles

- **Dashboard Chariow** : https://chariow.com/dashboard
- **Documentation API** : https://help.chariow.com/en/articles/259-developer-documentation-and-api
- **Gestion des clés API** : https://help.chariow.com/en/collections/169-api-keys
- **Créer des produits** : https://help.chariow.com/en/articles/191-manage-your-products-and-sales
- **Licences** : https://chariow.com/en/licenses
- **Tarification Chariow** : https://chariow.com/en/pricing
