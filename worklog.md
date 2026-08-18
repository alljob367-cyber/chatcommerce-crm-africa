---
Task ID: 1
Agent: Main Agent
Task: Supprimer config API client + intégrer WhatsApp ElevenLabs

Work Log:
- Consulté la documentation ElevenLabs WhatsApp (elevenlabs.io/docs/eleven-agents/whatsapp)
- Analyze le code existant: les routes API utilisaient deja process.env.ELEVENLABS_API_KEY (cote serveur)
- Ajoute les fonctions WhatsApp API dans src/lib/elevenlabs.ts: listWhatsAppAccounts, getWhatsAppAccount, updateWhatsAppAccount, deleteWhatsAppAccount, sendWhatsAppMessage, callWhatsApp
- Ajoute whatsappAccountId et whatsappEnabled au modele ElevenLabsAgent dans prisma/schema.prisma
- Cree /api/elevenlabs/whatsapp/route.ts (GET: lister comptes, POST: envoyer message/appel)
- Cree /api/elevenlabs/whatsapp/[id]/route.ts (GET/PATCH/DELETE: gestion comptes + assignation agents)
- Reecrit elevenlabs-page.tsx: supprime l'avertissement de cle API, ajoute section WhatsApp, assignation agent <-> numero
- Build Next.js reussi sans erreur
- Cree chatcommerce-crm-africa-v3.zip (49 Mo)

Stage Summary:
- Les clients ne voient AUCUNE config API - tout est gere cote serveur via ELEVENLABS_API_KEY
- Section WhatsApp dans le dashboard: liste les comptes importes, assigne/dissocie des agents
- Les agents peuvent etre connectes a WhatsApp directement depuis l'interface
- Fichier: /home/z/my-project/download/chatcommerce-crm-africa-v3.zip
