// ============================================================
// MOTEUR D'EXECUTION DES AUTOMATISATIONS — ChatCommerce CRM Africa
// ============================================================
// Ce module contient toute la logique de déclenchement et
// d'exécution des automatisations : bienvenue, panier abandonné,
// réactivation et programmées.
// ============================================================

import { db } from "@/lib/db";

// Marqueur inséré dans le corps des messages système d'automatisation
// pour éviter les doublons. Format : [auto:{type}:{automationId}]
const AUTOMATION_MARKER_PREFIX = "[auto:";

/**
 * Génère un marqueur unique pour une automatisation donnée.
 * Exemple : [auto:welcome:clx123abc]
 */
function automationMarker(type: string, automationId: string): string {
  return `${AUTOMATION_MARKER_PREFIX}${type}:${automationId}]`;
}

/**
 * Remplace les variables du modèle par leurs valeurs réelles.
 * Variables supportées : {contact_name}, {company_name}
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\{${key}\}`, "g"), value);
  }
  return rendered;
}

/**
 * Crée un message système dans une conversation pour une automatisation.
 * Le corps contient le marqueur de suivi pour éviter les envois multiples.
 */
export async function createAutomationMessage(
  conversationId: string,
  content: string,
  automationType: string,
  automationId: string
): Promise<string | null> {
  try {
    const marker = automationMarker(automationType, automationId);
    const fullBody = `${marker}\n${content}`;

    const message = await db.message.create({
      data: {
        conversationId,
        body: fullBody,
        direction: "outbound",
        type: "text",
        senderType: "system",
      },
    });

    // Mettre à jour la conversation avec le dernier message
    await db.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.slice(0, 200),
        lastMessageAt: new Date(),
      },
    });

    return message.id;
  } catch (error) {
    console.error(
      `[Automatisation] Erreur lors de la création du message pour la conversation ${conversationId}:`,
      error
    );
    return null;
  }
}

/**
 * Vérifie si une automatisation spécifique a déjà été envoyée
 * dans une conversation en cherchant le marqueur dans l'historique.
 */
async function hasAutomationBeenSent(
  conversationId: string,
  automationType: string,
  automationId: string
): Promise<boolean> {
  const marker = automationMarker(automationType, automationId);
  const count = await db.message.count({
    where: {
      conversationId,
      senderType: "system",
      body: { startsWith: marker },
    },
  });
  return count > 0;
}

/**
 * Vérifie si une automatisation de type donné a été envoyée dans les dernières X heures
 * pour une conversation (utile pour les relances de panier abandonné).
 */
async function hasRecentAutomationMessage(
  conversationId: string,
  withinHours: number
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const count = await db.message.count({
    where: {
      conversationId,
      senderType: "system",
      body: { startsWith: AUTOMATION_MARKER_PREFIX },
      createdAt: { gte: since },
    },
  });
  return count > 0;
}

// ============================================================
// AUTOMATISATIONS DE BIENVENUE
// ============================================================

interface AutomationResult {
  automationId: string;
  automationName: string;
  type: string;
  conversationId: string;
  contactName: string;
  success: boolean;
  error?: string;
}

/**
 * Traite les automatisations de bienvenue pour une entreprise.
 * - Cherche les conversations créées dans les 5 dernières minutes avec le statut "new"
 * - Vérifie qu'aucun message de bienvenue n'a déjà été envoyé
 * - Envoie le message template avec les variables remplacées
 */
export async function processWelcomeAutomations(
  companyId: string
): Promise<AutomationResult[]> {
  const results: AutomationResult[] = [];

  try {
    // Récupérer les automatisations de bienvenue actives
    const automations = await db.automation.findMany({
      where: {
        companyId,
        type: "welcome",
        trigger: "conversation_created",
        isActive: true,
      },
    });

    if (automations.length === 0) return results;

    // Récupérer les informations de l'entreprise
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company) return results;

    // Chercher les conversations récentes (créées dans les 5 dernières minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentConversations = await db.conversation.findMany({
      where: {
        companyId,
        status: "new",
        createdAt: { gte: fiveMinutesAgo },
      },
      include: { contact: { select: { name: true } } },
    });

    for (const conversation of recentConversations) {
      for (const automation of automations) {
        try {
          // Vérifier si cette automatisation a déjà été envoyée
          const alreadySent = await hasAutomationBeenSent(
            conversation.id,
            "welcome",
            automation.id
          );
          if (alreadySent) continue;

          // Remplir le modèle avec les variables
          const content = renderTemplate(automation.messageTemplate, {
            contact_name: conversation.contact.name,
            company_name: company.name,
          });

          // Envoyer le message
          const messageId = await createAutomationMessage(
            conversation.id,
            content,
            "welcome",
            automation.id
          );

          results.push({
            automationId: automation.id,
            automationName: automation.name,
            type: "welcome",
            conversationId: conversation.id,
            contactName: conversation.contact.name,
            success: messageId !== null,
          });
        } catch (error) {
          console.error(
            `[Automatisation Bienvenue] Erreur pour la conversation ${conversation.id}:`,
            error
          );
          results.push({
            automationId: automation.id,
            automationName: automation.name,
            type: "welcome",
            conversationId: conversation.id,
            contactName: conversation.contact.name,
            success: false,
            error: error instanceof Error ? error.message : "Erreur inconnue",
          });
        }
      }
    }
  } catch (error) {
    console.error(
      `[Automatisation Bienvenue] Erreur globale pour l'entreprise ${companyId}:`,
      error
    );
  }

  return results;
}

// ============================================================
// AUTOMATISATIONS PANIER ABANDONNÉ
// ============================================================

/**
 * Traite les automatisations de panier abandonné pour une entreprise.
 * - Cherche les commandes avec statut="pending" ET paymentStatus="pending"
 *   créées depuis plus de 2 heures
 * - Vérifie qu'aucun message d'automatisation n'a été envoyé dans les 24h
 * - Envoie le message dans la conversation associée au contact de la commande
 */
export async function processAbandonedOrderAutomations(
  companyId: string
): Promise<AutomationResult[]> {
  const results: AutomationResult[] = [];

  try {
    // Récupérer les automatisations de panier abandonné actives
    const automations = await db.automation.findMany({
      where: {
        companyId,
        type: "abandoned_order",
        isActive: true,
      },
    });

    if (automations.length === 0) return results;

    // Récupérer les informations de l'entreprise
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company) return results;

    // Chercher les commandes abandonnées (créées depuis plus de 2 heures, pas encore payées)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const abandonedOrders = await db.order.findMany({
      where: {
        companyId,
        status: "pending",
        paymentStatus: "pending",
        createdAt: { lte: twoHoursAgo },
      },
      include: {
        contact: { select: { name: true } },
      },
    });

    for (const order of abandonedOrders) {
      // Trouver la conversation associée au contact de cette commande
      const conversation = await db.conversation.findFirst({
        where: {
          companyId,
          contactId: order.contactId,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!conversation) continue;

      // Vérifier qu'aucun message d'automatisation n'a été envoyé dans les 24h
      const recentAutomation = await hasRecentAutomationMessage(
        conversation.id,
        24
      );
      if (recentAutomation) continue;

      for (const automation of automations) {
        try {
          // Vérifier si cette automatisation spécifique a déjà été envoyée pour cette conversation
          const alreadySent = await hasAutomationBeenSent(
            conversation.id,
            "abandoned_order",
            automation.id
          );
          if (alreadySent) continue;

          // Remplir le modèle
          const content = renderTemplate(automation.messageTemplate, {
            contact_name: order.contact.name,
            company_name: company.name,
          });

          // Envoyer le message
          const messageId = await createAutomationMessage(
            conversation.id,
            content,
            "abandoned_order",
            automation.id
          );

          results.push({
            automationId: automation.id,
            automationName: automation.name,
            type: "abandoned_order",
            conversationId: conversation.id,
            contactName: order.contact.name,
            success: messageId !== null,
          });
        } catch (error) {
          console.error(
            `[Automatisation Panier Abandonné] Erreur pour la commande ${order.id}:`,
            error
          );
          results.push({
            automationId: automation.id,
            automationName: automation.name,
            type: "abandoned_order",
            conversationId: conversation.id,
            contactName: order.contact.name,
            success: false,
            error: error instanceof Error ? error.message : "Erreur inconnue",
          });
        }
      }
    }
  } catch (error) {
    console.error(
      `[Automatisation Panier Abandonné] Erreur globale pour l'entreprise ${companyId}:`,
      error
    );
  }

  return results;
}

// ============================================================
// AUTOMATISATIONS DE RÉACTIVATION
// ============================================================

/**
 * Traite les automatisations de réactivation pour une entreprise.
 * - Cherche les conversations où lastMessageAt est entre 24h et 7 jours
 * - Le statut ne doit pas être "closed"
 * - Vérifie qu'aucun message de réactivation n'a été envoyé dans les 24h
 * - Envoie le message de réactivation
 */
export async function processReactivationAutomations(
  companyId: string
): Promise<AutomationResult[]> {
  const results: AutomationResult[] = [];

  try {
    // Récupérer les automatisations de réactivation actives
    const automations = await db.automation.findMany({
      where: {
        companyId,
        type: "reactivation",
        isActive: true,
      },
    });

    if (automations.length === 0) return results;

    // Récupérer les informations de l'entreprise
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company) return results;

    // Chercher les conversations inactives depuis au moins 24h mais moins de 7 jours
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const inactiveConversations = await db.conversation.findMany({
      where: {
        companyId,
        status: { not: "closed" },
        lastMessageAt: {
          lte: twentyFourHoursAgo,
          gte: sevenDaysAgo,
        },
      },
      include: { contact: { select: { name: true } } },
    });

    for (const conversation of inactiveConversations) {
      // Vérifier qu'aucun message de réactivation n'a été envoyé dans les 24h
      const recentAutomation = await hasRecentAutomationMessage(
        conversation.id,
        24
      );
      if (recentAutomation) continue;

      for (const automation of automations) {
        try {
          // Vérifier si cette automatisation spécifique a déjà été envoyée
          const alreadySent = await hasAutomationBeenSent(
            conversation.id,
            "reactivation",
            automation.id
          );
          if (alreadySent) continue;

          // Appliquer le filtre si défini
          if (automation.filter) {
            try {
              const filter = JSON.parse(automation.filter) as Record<string, unknown>;
              if (filter.minMessages) {
                const msgCount = await db.message.count({
                  where: { conversationId: conversation.id },
                });
                if (msgCount < Number(filter.minMessages)) continue;
              }
            } catch {
              // Filtre invalide : on l'ignore
            }
          }

          // Remplir le modèle
          const content = renderTemplate(automation.messageTemplate, {
            contact_name: conversation.contact.name,
            company_name: company.name,
          });

          // Envoyer le message
          const messageId = await createAutomationMessage(
            conversation.id,
            content,
            "reactivation",
            automation.id
          );

          results.push({
            automationId: automation.id,
            automationName: automation.name,
            type: "reactivation",
            conversationId: conversation.id,
            contactName: conversation.contact.name,
            success: messageId !== null,
          });
        } catch (error) {
          console.error(
            `[Automatisation Réactivation] Erreur pour la conversation ${conversation.id}:`,
            error
          );
          results.push({
            automationId: automation.id,
            automationName: automation.name,
            type: "reactivation",
            conversationId: conversation.id,
            contactName: conversation.contact.name,
            success: false,
            error: error instanceof Error ? error.message : "Erreur inconnue",
          });
        }
      }
    }
  } catch (error) {
    console.error(
      `[Automatisation Réactivation] Erreur globale pour l'entreprise ${companyId}:`,
      error
    );
  }

  return results;
}

// ============================================================
// AUTOMATISATIONS PROGRAMMÉES
// ============================================================

/**
 * Traite les automatisations programmées pour une entreprise.
 * - Récupère les automatisations avec delayMinutes > 0
 * - Pour les conversations récentes (new), déclenche après delayMinutes depuis la création
 * - Pour les conversations existantes, déclenche après delayMinutes depuis le dernier message
 * - Vérifie qu'aucun message n'a déjà été envoyé pour cette automatisation
 */
export async function processScheduledAutomations(
  companyId: string
): Promise<AutomationResult[]> {
  const results: AutomationResult[] = [];

  try {
    // Récupérer les automatisations programmées actives avec un délai
    const automations = await db.automation.findMany({
      where: {
        companyId,
        type: "scheduled",
        isActive: true,
        delayMinutes: { gt: 0 },
      },
    });

    if (automations.length === 0) return results;

    // Récupérer les informations de l'entreprise
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    if (!company) return results;

    for (const automation of automations) {
      try {
        // Calculer la fenêtre de temps pour chercher les conversations éligibles
        // On cherche les conversations créées il y a entre (delayMinutes) et (delayMinutes + 1) minutes
        // Cela permet de rattraper les passages de cron
        const delayMs = automation.delayMinutes * 60 * 1000;
        const windowStart = new Date(Date.now() - delayMs - 60 * 1000);
        const windowEnd = new Date(Date.now() - delayMs + 60 * 1000);

        // Conversations récentes (statut "new") éligibles au délai
        const eligibleNewConversations = await db.conversation.findMany({
          where: {
            companyId,
            status: "new",
            createdAt: { gte: windowStart, lte: windowEnd },
          },
          include: { contact: { select: { name: true } } },
        });

        // Conversations existantes avec un dernier message dans la fenêtre de délai
        const eligibleExistingConversations = await db.conversation.findMany({
          where: {
            companyId,
            status: { not: "closed" },
            lastMessageAt: { gte: windowStart, lte: windowEnd },
            createdAt: { lt: windowStart },
          },
          include: { contact: { select: { name: true } } },
        });

        const allEligible = [
          ...eligibleNewConversations,
          ...eligibleExistingConversations,
        ];

        for (const conversation of allEligible) {
          try {
            // Vérifier si cette automatisation a déjà été envoyée
            const alreadySent = await hasAutomationBeenSent(
              conversation.id,
              "scheduled",
              automation.id
            );
            if (alreadySent) continue;

            // Appliquer le filtre si défini
            if (automation.filter) {
              try {
                const filter = JSON.parse(automation.filter) as Record<string, unknown>;
                if (filter.status && filter.status !== conversation.status) continue;
              } catch {
                // Filtre invalide : on l'ignore
              }
            }

            // Remplir le modèle
            const content = renderTemplate(automation.messageTemplate, {
              contact_name: conversation.contact.name,
              company_name: company.name,
            });

            // Envoyer le message
            const messageId = await createAutomationMessage(
              conversation.id,
              content,
              "scheduled",
              automation.id
            );

            results.push({
              automationId: automation.id,
              automationName: automation.name,
              type: "scheduled",
              conversationId: conversation.id,
              contactName: conversation.contact.name,
              success: messageId !== null,
            });
          } catch (error) {
            console.error(
              `[Automatisation Programmée] Erreur pour la conversation ${conversation.id}:`,
              error
            );
            results.push({
              automationId: automation.id,
              automationName: automation.name,
              type: "scheduled",
              conversationId: conversation.id,
              contactName: conversation.contact.name,
              success: false,
              error: error instanceof Error ? error.message : "Erreur inconnue",
            });
          }
        }
      } catch (error) {
        console.error(
          `[Automatisation Programmée] Erreur pour l'automatisation ${automation.id}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      `[Automatisation Programmée] Erreur globale pour l'entreprise ${companyId}:`,
      error
    );
  }

  return results;
}

// ============================================================
// POINTE D'ENTRÉE PRINCIPALE
// ============================================================

export interface ExecutionReport {
  success: boolean;
  executed: number;
  details: {
    companyId: string;
    companyName: string;
    results: AutomationResult[];
  }[];
  errors: string[];
  durationMs: number;
}

/**
 * Execute automations for a SINGLE company.
 * Used by the client-side trigger (when a user is logged in).
 */
export async function executeAutomationsForCompany(companyId: string): Promise<ExecutionReport> {
  const startTime = Date.now();
  const details: ExecutionReport["details"] = [];
  const errors: string[] = [];
  let totalExecuted = 0;

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!company) {
      return { success: false, executed: 0, details: [], errors: ["Entreprise introuvable"], durationMs: 0 };
    }

    try {
      const companyResults: AutomationResult[] = [];

      const welcomeResults = await processWelcomeAutomations(company.id);
      companyResults.push(...welcomeResults);

      const abandonedResults = await processAbandonedOrderAutomations(company.id);
      companyResults.push(...abandonedResults);

      const reactivationResults = await processReactivationAutomations(company.id);
      companyResults.push(...reactivationResults);

      const scheduledResults = await processScheduledAutomations(company.id);
      companyResults.push(...scheduledResults);

      const successCount = companyResults.filter((r) => r.success).length;
      totalExecuted += successCount;

      if (companyResults.length > 0) {
        details.push({
          companyId: company.id,
          companyName: company.name,
          results: companyResults,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
      errors.push(`Entreprise ${company.name} (${company.id}): ${errorMsg}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
    errors.push(`Erreur globale: ${errorMsg}`);
  }

  const durationMs = Date.now() - startTime;

  return {
    success: errors.length === 0,
    executed: totalExecuted,
    details,
    errors,
    durationMs,
  };
}

/**
 * Fonction principale appelée par le cron chaque minute.
 * Parcourt toutes les entreprises actives et exécute
 * les automatisations correspondantes pour chacune d'elles.
 */
export async function executeAutomations(): Promise<ExecutionReport> {
  const startTime = Date.now();
  const details: ExecutionReport["details"] = [];
  const errors: string[] = [];
  let totalExecuted = 0;

  try {
    const companies = await db.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    for (const company of companies) {
      const report = await executeAutomationsForCompany(company.id);
      totalExecuted += report.executed;
      details.push(...report.details);
      errors.push(...report.errors);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
    errors.push(`Erreur globale: ${errorMsg}`);
  }

  const durationMs = Date.now() - startTime;

  console.log(
    `[Automatisation] Exécution terminée en ${durationMs}ms — ${totalExecuted} message(s) envoyé(s), ${errors.length} erreur(s)`
  );

  return {
    success: errors.length === 0,
    executed: totalExecuted,
    details,
    errors,
    durationMs,
  };
}
