const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  SectionType, TableOfContents, TableLayoutType,
} = require("docx");

// ─── Constants ───
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// GO-1 Graphite Orange palette for cover
const P = {
  bg: "1A2330", accent: "D4875A", titleColor: "FFFFFF",
  subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078",
};
// Table colors (darkened/desaturated for white-page tables)
const t = {
  headerBg: "D4875A", headerText: "FFFFFF",
  accentLine: "D4875A", innerLine: "DDD0C8", surface: "F8F0EB",
};

// ─── Helpers ───
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: "1A2330", font: { ascii: "Times New Roman" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: "1A2330", font: { ascii: "Times New Roman" } })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: "1A2330", font: { ascii: "Times New Roman" } })],
  });
}
function body(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: [new TextRun({ text, size: 24, color: "000000", font: { ascii: "Times New Roman" } })],
  });
}
function caption(text) {
  return new Paragraph({
    spacing: { before: 60, after: 120, line: 312 },
    children: [new TextRun({ text, italics: true, size: 21, color: "606060", font: { ascii: "Times New Roman" } })],
  });
}
function emptyPara() {
  return new Paragraph({ spacing: { line: 312 }, children: [new TextRun({ text: "", size: 2 })] });
}

function makeTable(headers, rows) {
  const colW = Math.floor(100 / headers.length);
  const hRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map(h => new TableCell({
      width: { size: colW, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: t.headerBg },
      borders: noBorders,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, color: t.headerText, font: { ascii: "Times New Roman" } })] })],
    })),
  });
  const dRows = rows.map((r, idx) => new TableRow({
    cantSplit: true,
    children: r.map(cell => new TableCell({
      width: { size: colW, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? t.surface : "FFFFFF" },
      borders: noBorders,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21, color: "000000", font: { ascii: "Times New Roman" } })] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: t.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: t.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [hRow, ...dRows],
  });
}

// ─── Cover R4 ───
function buildCoverR4(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR;

  // French text: Latin chars ~pt*11 twips wide each
  function estimateWidth(text, pt) {
    let w = 0;
    for (const ch of text) { w += (ch.charCodeAt(0) > 127) ? pt * 20 : pt * 11; }
    return w;
  }
  // Try decreasing font size until title fits in <=3 lines
  let titlePt = 38;
  let titleLines;
  while (titlePt >= 26) {
    const maxW = availableWidth;
    if (estimateWidth(config.title, titlePt) <= maxW) { titleLines = [config.title]; break; }
    // Split on spaces
    const words = config.title.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (estimateWidth(test, titlePt) > maxW && cur) { lines.push(cur); cur = w; }
      else { cur = test; }
    }
    if (cur) lines.push(cur);
    if (lines.length <= 3) { titleLines = lines; break; }
    titlePt -= 2;
  }
  if (!titleLines || titleLines.length === 0) { titleLines = [config.title]; titlePt = 26; }
  const titleSize = titlePt * 2;

  const contentEst = titleLines.length * (titlePt * 23 + 200) + (config.subtitle ? (12 * 23 + 200) : 0);
  const UPPER_H = Math.max(7500, contentEst + 1500 + 800);
  const topSpacing = Math.max(UPPER_H - contentEst - 280 - 800, 400);

  const upperBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: UPPER_H, rule: "exact" },
      children: [new TableCell({
        shading: { fill: P.bg }, borders: noBorders,
        verticalAlign: "top",
        margins: { left: padL, right: padR },
        children: [
          new Paragraph({ spacing: { before: topSpacing } }),
          config.englishLabel ? new Paragraph({
            spacing: { after: 500 },
            children: [new TextRun({ text: config.englishLabel, size: 18, color: P.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
          }) : null,
          ...titleLines.map((line, i) => new Paragraph({
            spacing: { after: i < titleLines.length - 1 ? 100 : 200, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: line, size: titleSize, bold: true, color: P.titleColor, font: { ascii: "Arial" } })],
          })),
          config.subtitle ? new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, font: { ascii: "Arial" } })],
          }) : null,
        ].filter(Boolean),
      })],
    })],
  });

  const divider = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 60, rule: "exact" },
      children: [new TableCell({ borders: noBorders, shading: { fill: P.accent }, children: [emptyPara()] })],
    })],
  });

  const lowerContent = [
    new Paragraph({ spacing: { before: 800 } }),
    ...(config.metaLines || []).map(line => new Paragraph({
      indent: { left: padL }, spacing: { after: 100 },
      children: [new TextRun({ text: line, size: 28, color: P.metaColor, font: { ascii: "Arial" } })],
    })),
    new Paragraph({ spacing: { before: 2000 } }),
    new Paragraph({
      indent: { left: padL },
      children: [
        new TextRun({ text: config.footerLeft || "", size: 22, color: "909090", font: { ascii: "Arial" } }),
        new TextRun({ text: "          " }),
        new TextRun({ text: config.footerRight || "", size: 22, color: "909090", font: { ascii: "Arial" } }),
      ],
    }),
  ];

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { fill: "FFFFFF" }, borders: noBorders, verticalAlign: "top",
        children: [upperBlock, divider, ...lowerContent],
      })],
    })],
  })];
}

// ─── Footers / Headers ───
function makeFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "808080", font: { ascii: "Calibri" } })],
    })],
  });
}
function makeHeader(title) {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, size: 18, color: "808080", font: { ascii: "Calibri" } })],
    })],
  });
}

// ─── MAIN ───
async function main() {
  const coverConfig = {
    title: "Business Plan : WhatsApp CRM pour PME Africaines",
    englishLabel: "BUSINESS PLAN",
    subtitle: "Automatiser la relation client via WhatsApp en Afrique francophone",
    metaLines: [
      "Projet de creation de SaaS",
      "Marche cible : Afrique francophone",
      "Juin 2026",
    ],
    footerLeft: "Document confidentiel",
    footerRight: "v1.0",
  };

  const pgSize = { width: 11906, height: 16838 };
  const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: { ascii: "Times New Roman" }, size: 24, color: "000000" },
          paragraph: { spacing: { line: 312 } },
        },
        heading1: {
          run: { font: { ascii: "Times New Roman" }, size: 32, bold: true, color: "1A2330" },
          paragraph: { spacing: { before: 360, after: 160, line: 312 } },
        },
        heading2: {
          run: { font: { ascii: "Times New Roman" }, size: 28, bold: true, color: "1A2330" },
          paragraph: { spacing: { before: 240, after: 120, line: 312 } },
        },
        heading3: {
          run: { font: { ascii: "Times New Roman" }, size: 24, bold: true, color: "1A2330" },
          paragraph: { spacing: { before: 200, after: 100, line: 312 } },
        },
      },
    },
    sections: [
      // ─── COVER ───
      {
        properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
        children: buildCoverR4(coverConfig),
      },
      // ─── TOC (Roman) ───
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
        },
        footers: { default: makeFooter() },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 480, after: 360 },
            children: [new TextRun({ text: "Table des matieres", bold: true, size: 32, font: { ascii: "Times New Roman" }, color: "1A2330" })],
          }),
          new TableOfContents("Table des matieres", { hyperlink: true, headingStyleRange: "1-3" }),
          new Paragraph({
            spacing: { before: 200 },
            children: [new TextRun({ text: "Note : Cette table des matieres est generee via des codes de champ. Pour mettre a jour les numeros de page, faites un clic droit sur la table et selectionnez \"Mettre a jour les champs\".", italics: true, size: 18, color: "888888", font: { ascii: "Times New Roman" } })],
          }),
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      // ─── BODY (Arabic from 1) ───
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
        },
        headers: { default: makeHeader("Business Plan - WhatsApp CRM Afrique") },
        footers: { default: makeFooter() },
        children: [

          // ═══ 1. RESUME EXECUTIF ═══
          h1("1. Resume executif"),
          body("Le present business plan decrit la creation d'une solution SaaS (Software as a Service) basee sur WhatsApp Business API, destinee aux petites et moyennes entreprises (PME) d'Afrique francophone. La solution, denommee provisoirement \"ChatCommerce CRM\", vise a transformer la facon dont les commercants, artisans et prestataires de services gerent leurs relations clients au quotidien, en s'appuyant sur le canal de communication le plus utilise sur le continent : WhatsApp."),
          body("L'Afrique francophone compte plus de 150 millions d'utilisateurs de WhatsApp, et la grande majorite des echanges commerciaux informels se deroulent deja sur cette plateforme. Cependant, ces echanges restent entierement manuels : les commercants perdent des commandes, oublient de repondre a des clients, et n'ont aucune visibilite sur leur activite commerciale. ChatCommerce CRM automatisera la gestion des commandes, les relances clients, le suivi des paiements Mobile Money, et fournira un tableau de bord web pour piloter l'activite."),
          body("Le marche cible est estime a plusieurs millions de PME en Afrique francophone (Senegal, Cote d'Ivoire, Cameroun, Mali, Burkina Faso, Guinee, Niger, Tchad, Benin, Togo, RCA, Congo, RDC, Madagascar). Le modele economique repose sur un abonnement freemium a 9-29 euros par mois, avec une commission optionnelle sur les transactions Mobile Money integrees. L'objectif est d'atteindre 500 clients payants d'ici 18 mois, generant un revenu mensuel recurrent (MRR) de 5 000 a 15 000 euros."),

          // ═══ 2. ETAT ACTUEL ET ANALYSE DU PROBLEME ═══
          h1("2. Etat actuel et analyse du probleme"),

          h2("2.1 Le contexte digital en Afrique francophone"),
          body("L'Afrique francophone connait une transformation numerique rapide depuis le milieu des annees 2010. Le taux de penetration mobile depasse 80% dans la plupart des pays de la region, et WhatsApp est devenu le canal de communication dominant, tant pour les echanges personnels que professionnels. Selon les donnees publiees par Meta, plus de 200 millions d'utilisateurs africains sont actifs sur WhatsApp chaque jour, ce qui en fait le continent le plus utilisateur de cette application au monde par rapport a sa population."),
          body("Le Mobile Money (Orange Money, MTN Mobile Money, Moov Money, Wave) a egalement transforme les habitudes de paiement. Au Senegal, Wave revendique plus de 10 millions d'utilisateurs actifs pour une population de 18 millions d'habitants. En Cote d'Ivoire, Orange Money depasse les 15 millions de comptes. Ces deux tendances concomitantes, WhatsApp omnipresent et Mobile Money universel, creent un terrain ideal pour une solution CRM integree qui eliminerait la fracture entre la communication client et le paiement."),

          h2("2.2 Le probleme : gestion manuelle et pertes de revenus"),
          body("Malgre cette maturite digitale, la realite quotidienne des PME africaines reste largement manuelle. Les commercants gerent leurs commandes via des messages WhatsApp individuels, sans catalogue structure ni suivi. Les problemes identifies sont multiples et se renforcent mutuellement pour creer un cercle vicieux de sous-performance commerciale."),
          body("Premierement, les pertes de commandes sont frequentes. Un commercant qui recoit 50 messages par jour sur WhatsApp ne peut pas tous les traiter efficacement. Des observations terrain menees au Senegal et en Cote d'Ivoire montrent que 20 a 35% des demandes clients restent sans reponse dans les 24 heures. Ce delai de reponse entraine directement un abandon d'achat, car le client se tourne vers un concurrent ou renonce a son achat."),
          body("Deuxiemement, l'absence de catalogue structure oblige les clients a demander systematiquement les prix et disponibilites, generant un volume de messages enorme et repetitif. Le commercant passe le plus clair de son temps a repondre aux memes questions au lieu de se concentrer sur la production, l'approvisionnement et la strategie commerciale."),
          body("Troisiemement, le suivi des paiements est chaotique. Lorsqu'un client annonce un paiement Mobile Money, le commercant doit manuellement verifier sa reception, ce qui cree des litiges et des retards. Il n'existe aucune reconciliation automatique entre les commandes et les paiements recus."),

          h2("2.3 Les solutions existantes et leurs limites"),
          body("Plusieurs solutions tentent d'addresser ce probleme, mais aucune n'est parfaitement adaptee au contexte africain francophone. Les CRM traditionnels (Salesforce, HubSpot, Zoho) sont concus pour des entreprises structurees avec des equipes de vente dediees, et leur prix (souvent plus de 50 euros par mois par utilisateur) les rend inaccessibles pour la majorite des PME africaines dont le chiffre d'affaires mensuel est souvent inferieur a 1 000 euros."),
          body("Des solutions africaines emergentes comme Wasoko, TradeDepot ou Chaka se concentrent principalement sur le B2B et la supply chain, pas sur la relation client directe via WhatsApp. Cote outils WhatsApp specifiques, Wati (Inde) et Glific (ONG) existent mais ne ciblent pas l'Afrique francophone et ne supportent pas nativement les solutions Mobile Money locales. Cette lacune represente une opportunite de marche significative pour une solution concue specifiquement pour ce contexte."),

          // ═══ 3. OBJECTIFS ET RESULTATS ATTENDUS ═══
          h1("3. Objectifs et resultats attendus"),

          h2("3.1 Vision a 18 mois"),
          body("L'objectif principal est de lancer un produit minimum viable (MVP) dans les 3 premiers mois, puis de le faire evoluer vers une solution complete en 18 mois. La vision se decompose en quatre phases distinctes, chacune avec des jalons mesurables et des indicateurs de performance clairs (KPI) permettant d'evaluer la progression et d'ajuster la strategie si necessaire."),
          body("La phase de validation (mois 1-2) vise a confirmer la demande reelle via des entretiens avec 50 commercants et un prototype fonctionnel teste par 10 boutiques pilotes. La phase MVP (mois 3-5) consistera a lancer une premiere version avec les fonctionnalites essentielles : catalogue WhatsApp, commandes automatisees et tableau de bord basique. La phase croissance (mois 6-12) ciblera 200 clients payants avec l'ajout du paiement Mobile Money integre et des relances automatisees. Enfin, la phase d'expansion (mois 13-18) visera 500 clients et l'ouverture a de nouveaux marches africains."),

          h2("3.2 Indicateurs cles de performance"),
          caption("Tableau 1 : Indicateurs de performance cles par phase"),
          makeTable(
            ["Phase", "Delai", "Clients payants", "MRR (euros)", "Taux de retention"],
            [
              ["Validation", "Mois 1-2", "0 (beta)", "0", "N/A"],
              ["MVP", "Mois 3-5", "50", "500 - 1 000", "> 70%"],
              ["Croissance", "Mois 6-12", "200", "2 000 - 6 000", "> 80%"],
              ["Expansion", "Mois 13-18", "500", "5 000 - 15 000", "> 85%"],
            ]
          ),
          body("Ces objectifs sont conservateurs et bases sur un taux de conversion de 5% des boutiques contactees en clients payants, ce qui est coherent avec les benchmarks observes dans des marches similaires en Asie du Sud-Est et en Amerique latine pour des solutions SaaS ciblant les PME."),

          // ═══ 4. CONCEPTION DE LA SOLUTION ═══
          h1("4. Conception de la solution"),

          h2("4.1 Architecture produit"),
          body("ChatCommerce CRM est concu comme une plateforme SaaS multi-tenant hebergee sur le cloud. L'architecture technique repose sur trois composants principaux qui communiquent via des API RESTful securisees. Le premier composant est le moteur WhatsApp, qui utilise l'API WhatsApp Business Cloud de Meta pour gerer l'envoi et la reception de messages de maniere programmatique. Le deuxieme est le backend metier, un serveur Node.js avec une base de donnees PostgreSQL qui gere les catalogues produits, les commandes, les profils clients et les regles d'automatisation. Le troisieme est le tableau de bord web, une interface React.js responsive permettant au commercant de piloter son activite depuis un ordinateur ou un smartphone."),

          h2("4.2 Fonctionnalites cles"),
          h3("4.2.1 Catalogue WhatsApp interactif"),
          body("Le commercant configure son catalogue de produits via le tableau de bord web (nom, prix, photo, description, categorie). Le client, en envoyant un message au numero WhatsApp de la boutique, recoit automatiquement le catalogue structure sous forme de boutons interactifs. Il peut parcourir les categories, consulter les details d'un produit, et passer commande directement dans la conversation WhatsApp, sans jamais quitter l'application. Cette approche elimine le besoin pour le client de telecharger une application supplementaire et s'appuie sur un canal qu'il utilise deja quotidiennement."),

          h3("4.2.2 Automatisation des commandes et relances"),
          body("Le systeme detecte automatiquement les intentions de commande dans les messages clients (via un systeme de mots-cles et de verification contextuelle) et genere une fiche de commande structuree avec les produits, quantites, prix unitaires et total. Des relances automatisees sont envoyees aux clients dont le paiement est en attente (a J+1, J+3 et J+7), et aux clients inactifs depuis 30 jours avec des offres personnalisees basees sur leur historique d'achat."),

          h3("4.2.3 Integration Mobile Money"),
          body("L'integration avec les APIs des operateurs Mobile Money (Orange Money, MTN Mobile Money, Wave) permet de generer des liens de paiement directement dans la conversation WhatsApp. Le client clique sur le lien, effectue le paiement dans son application Mobile Money, et le systeme confirme automatiquement la reception. Le tableau de bord affiche alors la commande comme payee, prete a l'expedition. Cette automatisation elimine les erreurs de reconciliation et accelere le cycle de vente."),

          h3("4.2.4 Tableau de bord analytique"),
          body("Le tableau de bord web offre une vue d'ensemble de l'activite commerciale : chiffre d'affaires quotidien, hebdomadaire et mensuel, produits les plus vendus, profil des clients (nouveaux vs recurrents), taux de reponse moyen, taux de conversion des commandes, et montants en attente de paiement. Ces donnees permettent au commercant de prendre des decisions eclairees sur l'approvisionnement, les promotions et la gestion de sa clientele."),

          h2("4.3 Stack technique"),
          caption("Tableau 2 : Stack technique du projet"),
          makeTable(
            ["Composant", "Technologie", "Justification"],
            [
              ["Backend API", "Node.js + Express", "Ecosysteme riche, performances elevees pour I/O asynchrone"],
              ["Base de donnees", "PostgreSQL", "Fiabilite, support JSON, scalabilite horizontale"],
              ["Frontend tableau de bord", "React.js + Tailwind CSS", "Interface reactive, composants reutilisables"],
              ["WhatsApp API", "Meta WhatsApp Business Cloud", "Officiel, fiable, supporte les messages interactifs"],
              ["Hebergement", "AWS / DigitalOcean", "Deploiement en Afrique du Sud ou Europe pour faible latence"],
              ["Paiements Mobile Money", "APIs Orange Money / MTN / Wave", "Integration native avec les operateurs cibles"],
              ["Authentification", "JWT + OAuth 2.0", "Securise, standard industriel"],
            ]
          ),

          // ═══ 5. FEUILLE DE ROUTE ET JALONS ═══
          h1("5. Feuille de route et jalons"),

          h2("5.1 Phase 1 : Validation (Mois 1-2)"),
          body("Cette phase est consacree a la validation du probleme et de la solution aupres du marche cible. L'equipe effectuera 50 entretiens semi-directifs avec des commercants et artisans dans au moins 2 pays (par exemple, le Senegal et la Cote d'Ivoire) pour comprendre en profondeur leurs pratiques actuelles, leurs frustratations et leur disposition a payer pour une solution de ce type. Un prototype non fonctionnel (mockups Figma) sera presente lors de ces entretiens pour recueillir des retours qualitatifs sur l'interface et les fonctionnalites proposees."),
          body("En parallele, 10 boutiques pilotes seront recrutees pour tester un prototype fonctionnel minimal (catalogue WhatsApp basique sans paiement). Ces boutiques seront choisies dans differents secteurs (alimentation, pret-a-porter, cosmetiques, pieces automobile, services) pour evaluer la versatilite de la solution. L'objectif est d'obtenir un taux de satisfaction superieur a 70% et des indications claires sur les fonctionnalites prioritaires a developper."),

          h2("5.2 Phase 2 : MVP (Mois 3-5)"),
          body("Le MVP integrera le catalogue WhatsApp interactif, la gestion des commandes basique et un tableau de bord web avec les metriques essentielles. L'accent sera mis sur la simplicite d'utilisation : l'inscription du commercant devra prendre moins de 10 minutes, et la configuration du catalogue ne devra pas necessiter de competences techniques. La strategie de lancement s'appuiera sur un modele de croissance organique : chaque commercant inscrit pourra inviter d'autres commercants via un lien de parrainage offrant un mois gratuit supplementaire."),

          h2("5.3 Phase 3 : Croissance (Mois 6-12)"),
          body("L'integration Mobile Money sera le catalyseur de la croissance. En permettant aux commercants de recevoir des paiements directement via WhatsApp, la solution devient indispensable a leur activite quotidienne. Le lancement s'etendra a 4 pays supplementaires (Cameroun, Mali, Burkina Faso, Guinee) avec une adaptation locale des integrations Mobile Money. Des partenariats avec des reseaux de commercants, des associations professionnelles et des incubateurs locaux seront developpes pour accelerer l'acquisition client."),

          h2("5.4 Phase 4 : Expansion (Mois 13-18)"),
          body("La derniere phase de ce plan prevoit l'expansion vers l'Afrique centrale et orientale francophone (RDC, Congo, Madagascar, Rwanda), l'ajout de fonctionnalites avancees (programmes de fidelite, campagnes marketing WhatsApp, analyse predictive des ventes), et la preparation d'une levee de fonds Serie A pour financer une croissance plus agressive. A ce stade, l'equipe devrait compter 8 a 12 personnes couvrant le developpement, le support client, le marketing et les partenariats commerciaux."),

          // ═══ 6. ETUDE DE MARCHE ET CONCURRENCE ═══
          h1("6. Etude de marche et concurrence"),

          h2("6.1 Taille du marche"),
          body("Le marche cible est l'ensemble des PME informelles et formelles en Afrique francophone qui utilisent WhatsApp pour communiquer avec leurs clients. Selon la Banque Mondiale, le secteur informel represente entre 50 et 80% du PIB dans les pays d'Afrique subsaharienne. En Afrique francophone, on estime a environ 30 millions le nombre de petites entreprises actives, dont une proportion significative utilise deja WhatsApp comme canal commercial. Meme en ciblant 1% de ce marche avec un abonnement moyen de 15 euros par mois, le revenu annuel potentiel depasse 50 millions d'euros, ce qui represente une opportunite substantielle pour un acteur bien positionne."),

          h2("6.2 Analyse concurrentielle"),
          caption("Tableau 3 : Comparaison des solutions concurrentes"),
          makeTable(
            ["Solution", "Prix", "WhatsApp natif", "Mobile Money", "Afrique FR"],
            [
              ["ChatCommerce CRM", "9-29 EUR/mois", "Oui, natif", "Oui, integre", "Cible principale"],
              ["Wati (Inde)", "15-80 USD/mois", "Oui", "Non", "Non adapte"],
              ["Glific (ONG)", "Gratuit (ONG)", "Oui", "Non", "Non commercial"],
              ["Zoho CRM", "10-45 EUR/mois", "Partiel", "Non", "Partiel"],
              ["HubSpot", "Gratuit - 450 EUR", "Via integrateur", "Non", "Non adapte"],
              ["Excel manuel", "Gratuit", "Non", "Non", "Oui, mais manuel"],
            ]
          ),
          body("L'analyse concurrentielle revele un espace vide specifique : aucune solution existante ne combine de maniere native la gestion CRM via WhatsApp, l'integration Mobile Money locale, et un positionnement tarifaire adapte aux PME africaines. ChatCommerce CRM se differencie par son approche \"WhatsApp-first\" (tout se passe dans WhatsApp, le client n'a rien a installer), son integration directe avec les operateurs Mobile Money locaux, et son prix accessible (inferieur a 30 euros pour la version complete)."),

          h2("6.3 Avantages competitifs"),
          body("Plusieurs barrieres a l'entree protegent le positionnement de ChatCommerce CRM. Premierement, les integrations avec les APIs Mobile Money de chaque operateur (Orange Money, MTN, Wave) necessitent des negociations commerciales, des certifications techniques et des delais de mise en production qui peuvent prendre 3 a 6 mois par operateur. Ce processus constitue une barriere a l'entree significative pour tout concurrent souhaitant reproduire la solution. Deuxiemement, la comprehension fine du contexte local (langues, habitudes commerciales, contraintes techniques comme la qualite du reseau internet) represente un avantage competiteur que seules les equipes locales peuvent acquerir. Troisiemement, les effets de reseau jouent en faveur du premier arrive : plus de commercants utilisent la solution, plus les clients s'habituent a commander via WhatsApp avec cette interface, ce qui renforce la valeur pour chaque nouveau commercant inscrit."),

          // ═══ 7. MODELE ECONOMIQUE ═══
          h1("7. Modele economique et projections financieres"),

          h2("7.1 Sources de revenus"),
          body("Le modele de revenus repose sur trois piliers complementaires. Le pilier principal est l'abonnement SaaS freemium : une version gratuite limitee (50 produits, 100 messages automatiques par mois) pour attirer les utilisateurs, et deux plans payants. Le plan \"Starter\" a 9 euros par mois inclut 500 produits, messages illimites et le tableau de bord basique. Le plan \"Pro\" a 29 euros par mois ajoute l'integration Mobile Money, les relances automatisees avancees, les rapports analytiques detailles et le support prioritaire."),
          body("Le deuxieme pilier est la commission sur les transactions Mobile Money, estimee entre 0,5% et 1% du montant de chaque paiement recu via la plateforme. Ce revenu est purement incremental et ne s'active que lorsque le commercant utilise l'integration paiement. Le troisieme pilier, a moyen terme, sera les services premium comme des campagnes marketing WhatsApp ciblees, des templates de messages optimises par IA, et des integrations avec des plateformes de livraison locale."),

          h2("7.2 Structure de prix"),
          caption("Tableau 4 : Structure de prix des abonnements"),
          makeTable(
            ["Fonctionnalite", "Gratuit", "Starter (9 EUR)", "Pro (29 EUR)"],
            [
              ["Nombre de produits", "50", "500", "Illimite"],
              ["Messages auto/mois", "100", "Illimite", "Illimite"],
              ["Tableau de bord", "Basique", "Complet", "Avance + export"],
              ["Paiement Mobile Money", "Non", "Non", "Oui, integre"],
              ["Relances automatiques", "Non", "Basiques", "Avancees"],
              ["Support", "Communaute", "Email (48h)", "Prioritaire (4h)"],
              ["Multi-utilisateurs", "Non", "Non", "Jusqu'a 5"],
            ]
          ),

          h2("7.3 Projections financieres sur 18 mois"),
          caption("Tableau 5 : Projections financieres recapitulatives"),
          makeTable(
            ["Indicateur", "Mois 6", "Mois 12", "Mois 18"],
            [
              ["Clients payants", "50", "200", "500"],
              ["MRR abonnements", "500 EUR", "2 200 EUR", "6 500 EUR"],
              ["MRR commissions", "0 EUR", "300 EUR", "1 500 EUR"],
              ["MRR total", "500 EUR", "2 500 EUR", "8 000 EUR"],
              ["Cout serveur/mois", "100 EUR", "350 EUR", "800 EUR"],
              ["Cout equipe/mois", "3 000 EUR", "6 000 EUR", "10 000 EUR"],
              ["Burn rate mensuel", "-2 600 EUR", "-3 850 EUR", "-2 800 EUR"],
              ["Croissance MRR", "N/A", "30% m/m", "15% m/m"],
            ]
          ),
          body("Le modele financier montre que la solution atteint le seuil de rentabilite operationnelle entre le mois 20 et 24, lorsque le MRR depasse les couts operatoires. La levee de fonds initiale de 50 000 a 80 000 euros (seed) est necessaire pour financer les 18 premiers mois d'operation, couvrant les salaires de l'equipe fondatrice (2-3 personnes), les couts d'infrastructure cloud, les frais d'integration Mobile Money et le budget marketing d'acquisition client."),

          // ═══ 8. ANALYSE DES RISQUES ═══
          h1("8. Analyse des risques et mitigation"),

          h2("8.1 Cartographie des risques"),
          body("Tout projet entrepreneurial en Afrique est soumis a des risques specifiques qu'il convient d'identifier et de mitiger proactivement. L'analyse ci-dessous recense les principaux risques associes au projet ChatCommerce CRM et propose pour chacun une strategie de mitigation concrete et evaluable."),

          caption("Tableau 6 : Matrice des risques et strategies de mitigation"),
          makeTable(
            ["Risque", "Probabilite", "Impact", "Mitigation"],
            [
              ["Dependance Meta/WhatsApp API", "Moyenne", "Eleve", "Diversifier avec SMS/USSD"],
              ["Changement tarification Meta", "Moyenne", "Moyen", "Modele multi-sources de revenus"],
              ["Adoption lente", "Elevee", "Eleve", "Onboarding accompagne, demos, parrainage"],
              ["Instabilite Mobile Money", "Moyenne", "Eleve", "Multi-operateurs, secours manuel"],
              ["Concurrence acteur etabli", "Moyenne", "Moyen", "First-mover, integrations locales"],
              ["Inflation / devaluation", "Elevee", "Moyen", "Tarification EUR, prepaye"],
              ["Reglementation donnees", "Faible", "Eleve", "RGPD + reglementations locales"],
              ["Recrutement technique", "Moyenne", "Moyen", "Remote-first, formations, universites"],
            ]
          ),

          h2("8.2 Risque principal : adoption par les commercants"),
          body("Le risque le plus critique est le risque d'adoption. Les commercants africains, en particulier dans le secteur informel, sont souvent reluctants a adopter de nouveaux outils numeriques, par manque de familiarite, par mefiance envers les solutions payantes, ou par simple habitude de travailler comme ils l'ont toujours fait. La strategie de mitigation repose sur trois axes."),
          body("Premierement, la simplicite absolue : l'inscription en moins de 10 minutes, pas de carte bancaire requise (paiement via Mobile Money), et une interface en francais avec un vocabulaire familier (pas de jargon technique). Deuxiemement, la demonstration de valeur immediate : lors de la premiere semaine d'essai gratuit, le commercant doit voir concretement le gain de temps et l'augmentation de ses ventes. Troisiemement, le bouche-a-oreille : les commercants africains sont fortement influences par les recommandations de leurs pairs, ce qui rend le parrainage et les temoignages video de commercants locaux particulierement efficaces comme levier d'acquisition."),

          // ═══ 9. BENEFICES ATTENDUS ═══
          h1("9. Benefices attendus et evaluation"),

          h2("9.1 Impact economique pour les PME"),
          body("Les benefices concrets pour les commercants utilisateurs sont mesurables et significatifs. En automatisant les reponses aux demandes frequentes (prix, disponibilites, horaires), le commercant gagne estime 2 a 4 heures par jour qu'il peut reinvestir dans son activite. En reduisant le delai de reponse de plusieurs heures a quelques secondes pour les demandes standards, le taux de conversion des commandes augmente de 20 a 40% selon les premiers retours du prototype. La gestion automatisee des relances de paiement reduit les impayes de 15 a 25%, ameliorant directement la tresorerie des petites entreprises."),

          h2("9.2 Impact macroeconomique"),
          body("Au-dela de l'impact individuel sur chaque PME, ChatCommerce CRM contribue a la formalisation progressive du commerce informel en Afrique francophone. En digitalisant les transactions et les catalogues, la solution genere des donnees qui peuvent etre utilisees par les commercants pour acceder au credit (historique de ventes comme justificatif de revenus), par les pouvoirs publics pour mieux comprendre l'economie reelle, et par les fournisseurs pour optimiser leurs chaines de distribution. A echelle, cette formalisation numerique peut contribuer a augmenter les recettes fiscales et a ameliorer la planification economique dans la region."),

          h2("9.3 Criteres d'evaluation du projet"),
          body("Le succes du projet sera evalue selon cinq criteres principaux, mesures a intervalles reguliers. Le premier critere est le nombre de clients payants actifs, avec un objectif de 500 a 18 mois. Le deuxieme est le taux de retention mensuel, cible a plus de 80%. Le troisieme est le Net Promoter Score (NPS), mesure trimestriellement via une enquete integree au tableau de bord, avec un objectif de NPS superieur a 40. Le quatrieme est le volume de transactions Mobile Money traitees via la plateforme, indicateur de l'adoption profonde de la solution. Le cinquieme est le revenu mensuel recurrent (MRR), qui doit suivre une trajectoire de croissance d'au moins 15% par mois pendant la phase de croissance."),

        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = "/home/z/my-project/download/Business_Plan_WhatsApp_CRM_Afrique.docx";
  fs.writeFileSync(outPath, buffer);
  console.log("Document generated: " + outPath);
}

main().catch(err => { console.error(err); process.exit(1); });