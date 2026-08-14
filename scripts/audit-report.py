#!/usr/bin/env python3
"""
ChatCommerce CRM Africa — Audit Final Report
Generates a comprehensive PDF audit report.
"""

import os
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.graphics.shapes import Drawing, Rect, String, Line
from reportlab.graphics import renderPDF

# ── Font Registration ──
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSansSC-Bold', f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Inter', f'{FONT_DIR}/truetype/liberation/LiberationSans-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSansBold', f'{FONT_DIR}/truetype/dejavu/DejaVuSans-Bold.ttf'))

registerFontFamily('NotoSansSC', normal='NotoSansSC', bold='NotoSansSC-Bold')
registerFontFamily('DejaVuSans', normal='DejaVuSans', bold='DejaVuSansBold')

# ── Cascade Palette (Dark Theme) ──
PAGE_BG       = colors.HexColor('#0b0b0a')
SECTION_BG    = colors.HexColor('#1a1917')
CARD_BG       = colors.HexColor('#1f1e1b')
TABLE_STRIPE  = colors.HexColor('#1b1a16')
HEADER_FILL   = colors.HexColor('#48412d')
COVER_BLOCK   = colors.HexColor('#4c452f')
BORDER        = colors.HexColor('#60573c')
ICON          = colors.HexColor('#b8aa81')
ACCENT        = colors.HexColor('#e2c469')
ACCENT_2      = colors.HexColor('#5da5bd')
TEXT_PRIMARY   = colors.HexColor('#e2e1df')
TEXT_MUTED     = colors.HexColor('#8c8982')
SEM_SUCCESS   = colors.HexColor('#81bd95')
SEM_WARNING   = colors.HexColor('#b79b61')
SEM_ERROR     = colors.HexColor('#af6f69')
SEM_INFO      = colors.HexColor('#799ec3')

# Severity colors
CRIT_COLOR    = colors.HexColor('#e74c3c')
HIGH_COLOR    = colors.HexColor('#e67e22')
MED_COLOR     = colors.HexColor('#f1c40f')
LOW_COLOR     = colors.HexColor('#3498db')

# ── Page Setup ──
PAGE_W, PAGE_H = A4
LEFT_M = 22 * mm
RIGHT_M = 22 * mm
TOP_M = 18 * mm
BOT_M = 22 * mm
CONTENT_W = PAGE_W - LEFT_M - RIGHT_M

# ── Styles ──
styles = getSampleStyleSheet()

style_title = ParagraphStyle('AuditTitle', fontName='DejaVuSans', fontSize=28, leading=34, textColor=ACCENT, spaceAfter=6*mm)
style_h1 = ParagraphStyle('H1', fontName='DejaVuSansBold', fontSize=18, leading=24, textColor=ACCENT, spaceBefore=10*mm, spaceAfter=5*mm)
style_h2 = ParagraphStyle('H2', fontName='DejaVuSansBold', fontSize=14, leading=19, textColor=ICON, spaceBefore=7*mm, spaceAfter=3*mm)
style_h3 = ParagraphStyle('H3', fontName='DejaVuSansBold', fontSize=11, leading=15, textColor=TEXT_PRIMARY, spaceBefore=4*mm, spaceAfter=2*mm)
style_body = ParagraphStyle('Body', fontName='NotoSansSC', fontSize=9.5, leading=15, textColor=TEXT_PRIMARY, alignment=TA_JUSTIFY, spaceAfter=2.5*mm)
style_body_sm = ParagraphStyle('BodySm', fontName='NotoSansSC', fontSize=8.5, leading=13, textColor=TEXT_MUTED, alignment=TA_LEFT, spaceAfter=2*mm)
style_bullet = ParagraphStyle('Bullet', fontName='NotoSansSC', fontSize=9, leading=14, textColor=TEXT_PRIMARY, leftIndent=10*mm, bulletIndent=5*mm, spaceAfter=1.5*mm)
style_label = ParagraphStyle('Label', fontName='DejaVuSansBold', fontSize=8, leading=11, textColor=ACCENT, spaceAfter=1*mm)
style_score_num = ParagraphStyle('ScoreNum', fontName='DejaVuSansBold', fontSize=36, leading=40, textColor=ACCENT, alignment=TA_CENTER)
style_score_label = ParagraphStyle('ScoreLabel', fontName='NotoSansSC', fontSize=9, leading=12, textColor=TEXT_MUTED, alignment=TA_CENTER)
style_footer = ParagraphStyle('Footer', fontName='NotoSansSC', fontSize=7, leading=10, textColor=TEXT_MUTED, alignment=TA_CENTER)
style_crit = ParagraphStyle('Crit', fontName='DejaVuSansBold', fontSize=9, leading=13, textColor=CRIT_COLOR, spaceAfter=1.5*mm)
style_high = ParagraphStyle('High', fontName='DejaVuSansBold', fontSize=9, leading=13, textColor=HIGH_COLOR, spaceAfter=1.5*mm)
style_med = ParagraphStyle('Med', fontName='DejaVuSansBold', fontSize=9, leading=13, textColor=MED_COLOR, spaceAfter=1.5*mm)
style_low = ParagraphStyle('Low', fontName='DejaVuSansBold', fontSize=9, leading=13, textColor=LOW_COLOR, spaceAfter=1.5*mm)
style_code = ParagraphStyle('Code', fontName='DejaVuSans', fontSize=8, leading=11, textColor=SEM_WARNING, backColor=colors.HexColor('#151412'), leftIndent=5*mm, spaceAfter=2*mm)

# ── Helper Functions ──
def section_line():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceBefore=2*mm, spaceAfter=2*mm)

def severity_badge(sev):
    s_map = {'CRITIQUE': CRIT_COLOR, 'HAUTE': HIGH_COLOR, 'MOYENNE': MED_COLOR, 'BASSE': LOW_COLOR}
    c = s_map.get(sev, TEXT_MUTED)
    return Paragraph(f'<font color="{c.hexval()}">{sev}</font>', ParagraphStyle('Badge', fontName='DejaVuSansBold', fontSize=8, leading=11, textColor=c))

def finding_row(sev, id_num, title, desc):
    s_map = {'CRITIQUE': CRIT_COLOR, 'HAUTE': HIGH_COLOR, 'MOYENNE': MED_COLOR, 'BASSE': LOW_COLOR}
    c = s_map.get(sev, TEXT_MUTED)
    return [
        Paragraph(f'<b>{id_num}</b>', ParagraphStyle('fc', fontName='DejaVuSans', fontSize=8, textColor=ACCENT, alignment=TA_CENTER)),
        Paragraph(f'<font color="{c.hexval()}"><b>{sev}</b></font>', ParagraphStyle('fs', fontName='DejaVuSans', fontSize=8, textColor=c, alignment=TA_CENTER)),
        Paragraph(title, ParagraphStyle('ft', fontName='NotoSansSC', fontSize=8.5, leading=12, textColor=TEXT_PRIMARY)),
        Paragraph(desc, ParagraphStyle('fd', fontName='NotoSansSC', fontSize=8, leading=11, textColor=TEXT_MUTED)),
    ]

def stat_card(label, value, note, c=ACCENT):
    return [
        [Paragraph(f'<font size="24" color="{c.hexval()}"><b>{value}</b></font>', ParagraphStyle('sv', fontName='DejaVuSansBold', fontSize=24, leading=28, textColor=c, alignment=TA_CENTER)),
         Paragraph(label, ParagraphStyle('sl', fontName='NotoSansSC', fontSize=8, leading=11, textColor=TEXT_MUTED, alignment=TA_CENTER))],
        [Paragraph(note, ParagraphStyle('sn', fontName='NotoSansSC', fontSize=7, leading=10, textColor=TEXT_MUTED, alignment=TA_CENTER)), ''],
    ]

def draw_cover_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Accent line
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(3)
    canvas.line(LEFT_M, PAGE_H - 60*mm, PAGE_W - RIGHT_M, PAGE_H - 60*mm)
    # Bottom bar
    canvas.setFillColor(COVER_BLOCK)
    canvas.rect(0, 0, PAGE_W, 30*mm, fill=1, stroke=0)
    canvas.restoreState()

def draw_page_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Header line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(LEFT_M, PAGE_H - TOP_M + 5*mm, PAGE_W - RIGHT_M, PAGE_H - TOP_M + 5*mm)
    # Footer
    canvas.setFont('NotoSansSC', 7)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawCentredString(PAGE_W / 2, 12*mm, f"ChatCommerce CRM Africa - Audit Final - Page {doc.page}")
    canvas.drawString(LEFT_M, 12*mm, "Confidentiel")
    canvas.drawRightString(PAGE_W - RIGHT_M, 12*mm, datetime.now().strftime("%d/%m/%Y"))
    canvas.restoreState()

# ── Build Document ──
OUTPUT_PATH = '/home/z/my-project/download/ChatCommerce-CRM-Audit-Final.pdf'
os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=LEFT_M, rightMargin=RIGHT_M,
    topMargin=TOP_M, bottomMargin=BOT_M,
)

story = []

# ══════════════════════════════════════════════════════
# COVER PAGE
# ══════════════════════════════════════════════════════
story.append(Spacer(1, 30*mm))
story.append(Paragraph("AUDIT FINAL", style_title))
story.append(Paragraph("ChatCommerce CRM Africa", ParagraphStyle('Subtitle', fontName='DejaVuSans', fontSize=16, leading=22, textColor=TEXT_MUTED, spaceAfter=8*mm)))
story.append(section_line())
story.append(Paragraph("Analyse complete de securite, architecture, base de donnees et frontend", style_body))
story.append(Spacer(1, 15*mm))

# Project info table
info_data = [
    ['Projet', 'ChatCommerce CRM Africa'],
    ['Technologies', 'Next.js 16, Prisma, PostgreSQL (Neon), Vercel'],
    ['Models DB', '24 models, 45+ relations, 36 indexes'],
    ['Routes API', '46 endpoints, 9 279 lignes'],
    ['Components', '28 pages, 51 shadcn/ui primitives'],
    ['Date Audit', datetime.now().strftime('%d/%m/%Y')],
    ['Environnement', 'Production (Vercel + Neon DB)'],
]
info_table = Table(info_data, colWidths=[40*mm, CONTENT_W - 40*mm])
info_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (0, -1), 'DejaVuSansBold'),
    ('FONTNAME', (1, 0), (1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('TEXTCOLOR', (0, 0), (0, -1), ACCENT),
    ('TEXTCOLOR', (1, 0), (1, -1), TEXT_PRIMARY),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4*mm),
    ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
    ('LINEBELOW', (0, 0), (-1, -2), 0.3, BORDER),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(info_table)
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ══════════════════════════════════════════════════════
story.append(Paragraph("TABLE DES MATIERES", style_h1))
story.append(section_line())

toc_items = [
    ("1.", "Note Globale et Scores", ""),
    ("2.", "Architecture et Structure du Projet", ""),
    ("3.", "Securite - Vulnabilites Critiques", ""),
    ("4.", "Securite - Vulnabilites Hautes", ""),
    ("5.", "Securite - Vulnabilites Moyennes et Basses", ""),
    ("6.", "Base de Donnees - Schema et Integrite", ""),
    ("7.", "API - Routes et Logique Metier", ""),
    ("8.", "Frontend - Composants et Experience Utilisateur", ""),
    ("9.", "Performance et Deploiement", ""),
    ("10.", "Plan d'Action Prioritaire", ""),
    ("11.", "Verdict Final", ""),
]
for num, title, _ in toc_items:
    story.append(Paragraph(f'<font color="{ACCENT.hexval()}">{num}</font>  {title}', ParagraphStyle('toc', fontName='NotoSansSC', fontSize=11, leading=20, textColor=TEXT_PRIMARY, leftIndent=5*mm)))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 1. NOTE GLOBALE
# ══════════════════════════════════════════════════════
story.append(Paragraph("1. Note Globale et Scores", style_h1))
story.append(section_line())

story.append(Paragraph(
    "ChatCommerce CRM Africa est une plateforme SaaS multi-tenant destinee aux entreprises camerounaises et africaines. "
    "Elle combine la gestion de contacts, leads, commandes, factures, campagnes marketing, et surtout un systeme complet "
    "d'agents Telegram bases sur l'IA. L'application est construite avec Next.js 16, Prisma ORM, PostgreSQL heberge sur Neon, "
    "et deployee sur Vercel. Malgre une couverture fonctionnelle impressionnante, l'audit revele des vulnerabilites de securite "
    "critiques qui doivent etre traitees avant une adoption en production a grande echelle. Le code montre une bonne maitrise "
    "de l'ecosysteme React/Next.js et une architecture globalement coherente, mais souffre de decisions de securite temoignaires "
    "d'un developpement rapide sans revue formelle. Les sections suivantes detaillent chaque domaine analyse avec des severites "
    "attribuees selon l'impact potentiel sur la securite, la stabilite et la maintenabilite du systeme.",
    style_body))

story.append(Spacer(1, 5*mm))

# Score cards
score_data = [
    [Paragraph('<font color="#e74c3c"><b>4.0 / 10</b></font>', style_score_num),
     Paragraph('<font color="#e67e22"><b>5.5 / 10</b></font>', style_score_num),
     Paragraph('<font color="#b79b61"><b>6.0 / 10</b></font>', style_score_num),
     Paragraph('<font color="#81bd95"><b>7.0 / 10</b></font>', style_score_num),
     Paragraph('<font color="#799ec3"><b>6.5 / 10</b></font>', style_score_num)],
    [Paragraph('Securite', style_score_label),
     Paragraph('Architecture', style_score_label),
     Paragraph('Base de Donnees', style_score_label),
     Paragraph('Frontend / UX', style_score_label),
     Paragraph('Performance', style_score_label)],
]
cw = CONTENT_W / 5
score_table = Table(score_data, colWidths=[cw]*5, rowHeights=[18*mm, 8*mm])
score_table.setStyle(TableStyle([
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BOX', (0, 0), (0, -1), 0.5, BORDER),
    ('BOX', (1, 0), (1, -1), 0.5, BORDER),
    ('BOX', (2, 0), (2, -1), 0.5, BORDER),
    ('BOX', (3, 0), (3, -1), 0.5, BORDER),
    ('BOX', (4, 0), (4, -1), 0.5, BORDER),
    ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
    ('TOPPADDING', (0, 0), (-1, 0), 4*mm),
    ('BOTTOMPADDING', (0, -1), (-1, -1), 3*mm),
]))
story.append(score_table)

story.append(Spacer(1, 5*mm))
story.append(Paragraph(
    '<font color="#e2c469"><b>NOTE GLOBALE : 5.5 / 10</b></font> - Le projet est fonctionnel et impressionnant en termes de couverture. '
    'Il necessite des corrections de securite majeures avant une mise en production serieuse.',
    style_body))

# Summary stats
story.append(Spacer(1, 3*mm))
summary_items = [
    [Paragraph('<b>17</b>', ParagraphStyle('sn2', fontName='DejaVuSansBold', fontSize=14, textColor=CRIT_COLOR, alignment=TA_CENTER)),
     Paragraph('<b>5</b>', ParagraphStyle('sn2', fontName='DejaVuSansBold', fontSize=14, textColor=HIGH_COLOR, alignment=TA_CENTER)),
     Paragraph('<b>5</b>', ParagraphStyle('sn2', fontName='DejaVuSansBold', fontSize=14, textColor=MED_COLOR, alignment=TA_CENTER)),
     Paragraph('<b>3</b>', ParagraphStyle('sn2', fontName='DejaVuSansBold', fontSize=14, textColor=LOW_COLOR, alignment=TA_CENTER)),
     Paragraph('<b>4</b>', ParagraphStyle('sn2', fontName='DejaVuSansBold', fontSize=14, textColor=ACCENT, alignment=TA_CENTER)),
     Paragraph('<b>5</b>', ParagraphStyle('sn2', fontName='DejaVuSansBold', fontSize=14, textColor=SEM_INFO, alignment=TA_CENTER))],
    [Paragraph('Critiques', style_score_label),
     Paragraph('Hautes', style_score_label),
     Paragraph('Moyennes', style_score_label),
     Paragraph('Basses', style_score_label),
     Paragraph('Points Forts', style_score_label),
     Paragraph('Recommandations', style_score_label)],
]
cw6 = CONTENT_W / 6
sum_table = Table(summary_items, colWidths=[cw6]*6, rowHeights=[14*mm, 7*mm])
sum_table.setStyle(TableStyle([
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
    ('BOX', (0, 0), (0, -1), 0.3, BORDER),
    ('BOX', (1, 0), (1, -1), 0.3, BORDER),
    ('BOX', (2, 0), (2, -1), 0.3, BORDER),
    ('BOX', (3, 0), (3, -1), 0.3, BORDER),
    ('BOX', (4, 0), (4, -1), 0.3, BORDER),
    ('BOX', (5, 0), (5, -1), 0.3, BORDER),
    ('TOPPADDING', (0, 0), (-1, 0), 2*mm),
]))
story.append(sum_table)
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 2. ARCHITECTURE
# ══════════════════════════════════════════════════════
story.append(Paragraph("2. Architecture et Structure du Projet", style_h1))
story.append(section_line())

story.append(Paragraph("2.1 Vue d'Ensemble Technique", style_h2))
story.append(Paragraph(
    "Le projet utilise une architecture monolithique modulaire deployee comme application Next.js serverless sur Vercel. "
    "Le choix de Next.js 16 avec le routeur App Router est moderne et performant. L'application fonctionne en mode SPA "
    "(Single Page Application) avec un seul fichier page.tsx qui route vers les composants via un store Zustand stockant "
    "la page courante. Ce pattern evite les transitions de page completes mais contourne le systeme de routing de Next.js, "
    "eliminant les avantages du SSR (Server-Side Rendering) et du code-splitting automatique. La base de donnees PostgreSQL "
    "est hebergee sur Neon avec un pooler de connexion, et Prisma ORM gere toutes les interactions avec la base de donnees "
    "de maniere type-safe. L'authentification JWT avec la bibliotheque jose (HS256) est correctement implementee en production "
    "avec un secret JWT obligatoire. L'architecture multi-tenant est bien respectee : toutes les donnees sont scopees par "
    "companyId, avec 24 models Prisma et plus de 45 relations.", style_body))

story.append(Paragraph("2.2 Stack Technologique", style_h2))
tech_data = [
    ['Categorie', 'Technologie', 'Version', 'Appreciation'],
    ['Framework', 'Next.js', '16.1.1', 'Excellent - Derniere version'],
    ['Langage', 'TypeScript', '5.x', 'Bon - Strict partiel (noImplicitAny: false)'],
    ['ORM', 'Prisma', '6.11.1', 'Excellent - Type-safe, migrations'],
    ['Base de donnees', 'PostgreSQL (Neon)', 'Serverless', 'Bon - Pooled connections'],
    ['UI', 'shadcn/ui + Radix', 'Dernier', 'Excellent - Accessible, composeable'],
    ['State', 'Zustand', '5.0.6', 'Bon - Simple, efficace'],
    ['Style', 'Tailwind CSS', 'v4', 'Excellent - Derniere version'],
    ['Auth', 'jose (JWT)', '6.2.3', 'Correct - Mais fallback dev risque'],
    ['Deploiement', 'Vercel CLI', '59.0.0', 'Bon - CI/CD automatise'],
    ['Paiement', 'Chariow', 'Integre', 'Correct - Webhook handle'],
    ['IA', 'Mistral / OpenRouter', 'Integre', 'Bon - Multi-fournisseur'],
]
tech_table = Table(tech_data, colWidths=[30*mm, 38*mm, 28*mm, CONTENT_W - 96*mm])
tech_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSansBold'),
    ('FONTNAME', (0, 1), (-1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, -1), 8),
    ('TEXTCOLOR', (0, 0), (-1, 0), ACCENT),
    ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, TABLE_STRIPE]),
    ('ALIGN', (2, 0), (2, -1), 'CENTER'),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('TOPPADDING', (0, 0), (-1, -1), 2.5*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5*mm),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(tech_table)

story.append(Paragraph("2.3 Points Forts Architecturaux", style_h2))
strengths = [
    "Multi-tenant bien implemente avec isolation par companyId sur toutes les queries",
    "Systeme de plans et limites (starter/pro/business/enterprise) avec enforcement via plan-limits.ts",
    "Telegram bot system complet : 9 routes API, 12 types d'agents preconfigures, IA integree",
    "Delivery tracking avec gestion de chauffeurs et coordonnees GPS",
    "PWA-ready avec manifest.json et service worker",
    "Dark mode complet via next-themes et variables CSS oklch",
    "Systeme de notifications temps reel via SSE (Server-Sent Events)",
    "Middleware JWT centralise avec bypass pour routes publiques",
]
for s in strengths:
    story.append(Paragraph(f'<font color="{SEM_SUCCESS.hexval()}">+</font> {s}', style_bullet))

story.append(Paragraph("2.4 Faiblesses Architecturales", style_h2))
weaknesses = [
    "Pattern SPA monolithique : un seul page.tsx pour toute l'app, pas de code-splitting, pas de SSR",
    "4 composants megacomposants (> 1300 lignes) dont telegram-page.tsx a 2086 lignes",
    "Role checks melanges : company_admin = business user MAIS aussi utilise pour les checks admin globaux",
    "ID admin en dur 'admin-hardcoded-001' present dans 10 fichiers source (front + back)",
    "Pas de systeme de routing Next.js : impossible de faire des liens directs vers une page",
    "Pas de tests unitaires, d'integration ou e2e detectes dans le projet",
    "Variables d'environnement non configurees dans .env local (seulement SQLite fallback)",
]
for w in weaknesses:
    story.append(Paragraph(f'<font color="{SEM_ERROR.hexval()}">-</font> {w}', style_bullet))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 3. SECURITE - CRITIQUES
# ══════════════════════════════════════════════════════
story.append(Paragraph("3. Securite - Vulnabilites Critiques", style_h1))
story.append(section_line())

story.append(Paragraph(
    "Les vulnerabilites critiques identifiees representent des risques immediats et significatifs pour la securite "
    "des donnees des utilisateurs et l'integrite du systeme. Elles doivent etre corrigees en priorite absolue avant "
    "toute mise en production a grande echelle. Chaque vulnerabilite est documentee avec sa localisation precise, "
    "l'impact potentiel, et la correction recommandee.", style_body))

# C1
story.append(Paragraph("C1 - Mot de passe admin en dur dans le code source", style_crit))
story.append(Paragraph(
    "Le mot de passe de l'administrateur est directement ecrit dans le code source de l'application, accessible a quiconque "
    "a acces au depot Git ou au code deploye. La constante ADMIN_PASSWORD dans src/app/api/auth/route.ts contient la valeur "
    "'Admin@2024' comme fallback si la variable d'environnement ADMIN_PASSWORD n'est pas definie. Le compte admin hardcore "
    "avec l'ID 'admin-hardcoded-001' contourne entierement la base de donnee et obtient automatiquement le role company_admin "
    "et le plan enterprise. Cela signifie que n'importe quel developpeur ou attaquant ayant acces au code source peut se connecter "
    "en tant qu'administrateur avec des privileges complets.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/app/api/auth/route.ts:13 | src/app/api/auth/change-password/route.ts:31', style_code))
story.append(Paragraph(
    "La correction consiste a exiger absolument que ADMIN_PASSWORD soit defini comme variable d'environnement en production, "
    "et a supprimer completement le fallback en dur. De plus, il faudrait envisager de migrer le compte admin hardcore vers "
    "la base de donnees pour un controle centralise des credentials, et imposer la double authentification (2FA) pour ce compte.",
    style_body))

story.append(Spacer(1, 3*mm))
# C2
story.append(Paragraph("C2 - Endpoint seed-demo protege par une cle en dur", style_crit))
story.append(Paragraph(
    "L'endpoint /api/seed-demo est protege uniquement par un header HTTP 'x-admin-key' avec la valeur en dur 'demo-seed-2024'. "
    "Cette valeur est publiquement devinable et permet a quiconque de decouvrir la route d'injecter des donnees de demonstration "
    "dans la base de donnees. Bien que le matcher du middleware bloque techniquement cette route, la cle secrete trivial est un "
    "anti-pattern de securite grave. Si le matcher est modifie ou si un bug expose la route, toute la base de donnees peut etre "
    "corrompue avec des donnees de test.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/app/api/seed-demo/route.ts:7', style_code))

story.append(Spacer(1, 3*mm))
# C3
story.append(Paragraph("C3 - Token de bot Telegram expose dans les parametres URL", style_crit))
story.append(Paragraph(
    "Le webhook Telegram transmet le token du bot comme parametre de query URL (?token=XXX). Ce token apparait dans les logs "
    "du serveur, les logs de Vercel, l'historique du navigateur si teste manuellement, les logs CDN/proxy, et les outils de "
    "surveillance reseau. Un attaquant qui obtient un de ces logs peut pirater tous les bots Telegram des entreprises clientes. "
    "Le token ne devrait jamais etre dans l'URL ou la query string. Telegram supporte le secret_token dans setWebhook pour "
    "valider l'origine des requetes, ce qui eliminerait le besoin de transmettre le token dans l'URL.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/app/api/telegram/webhook/route.ts:186', style_code))

story.append(Spacer(1, 3*mm))
# C4
story.append(Paragraph("C4 - Route cron automations ouverte en mode developpement", style_crit))
story.append(Paragraph(
    "La route /api/cron/automations ne verifie aucune authentification lorsque NODE_ENV est different de 'production'. "
    "Si le deploiement tourne accidentellement en mode developpement (ce qui est courant avec les deploiements mal configures), "
    "n'importe qui peut declencher toutes les automations marketing (campagnes WhatsApp, SMS, emails) sans aucune authentification. "
    "Le CRON_SECRET peut ne pas etre defini dans les environnements de staging, rendant la protection inexistante.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/app/api/cron/automations/route.ts:20', style_code))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 4. SECURITE - HAUTES
# ══════════════════════════════════════════════════════
story.append(Paragraph("4. Securite - Vulnabilites Hautes", style_h1))
story.append(section_line())

story.append(Paragraph(
    "Les vulnerabilites de severite haute n'ont pas un impact immediat aussi devastateur que les critiques, mais elles exposent "
    "le systeme a des risques significatifs qui pourraient etre exploites dans des scenarios d'attaque specifiques.", style_body))

# H1
story.append(Paragraph("H1 - Rate limiting en memoire uniquement (inefficace en production)", style_high))
story.append(Paragraph(
    "Tous les rate limiting (login 5 req/60s, inscription 10 req/h, OTP 5 req/h) sont implementes en memoire vive avec un "
    "dictionnaire JavaScript. Sur Vercel serverless, chaque invocation de fonction tourne dans un processus separe. Un attaquant "
    "peut donc brute-forcer les mots de passe avec des tentatives illimitees en production car chaque requete arrive dans une "
    "instance differente du serveur. Le code contient d'ailleurs un avertissement : 'DB rate limiting not implemented - using "
    "in-memory fallback'. La solution est d'implementer le rate limiting avec Upstash Redis ou Vercel KV qui persistent les "
    "compteurs entre les invocations serverless.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/lib/security.ts:100-146', style_code))

story.append(Spacer(1, 3*mm))
# H2
story.append(Paragraph("H2 - Matcher middleware incomplet pour les routes publiques", style_high))
story.append(Paragraph(
    "Le matcher du middleware utilise le pattern /api/((?!auth|seed).*) qui exclut uniquement auth et seed. Les routes publiques "
    "telles que /api/cron, /api/chariow/webhook, /api/telegram/webhook sont dans PUBLIC_PATHS mais le matcher ne les exclut pas. "
    "Chacune de ces routes effectue sa propre verification d'authentification, mais si une route oublie d'appeler verifyToken(), "
    "il n'y a pas de filet de securite au niveau du middleware. La correction recommandee est de mettre a jour le matcher pour "
    "exclure explicitement toutes les routes publiques, ou a l'inverse, de verifier toutes les routes non-exclues par defaut.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/middleware.ts:76-81', style_code))

story.append(Spacer(1, 3*mm))
# H3
story.append(Paragraph("H3 - Hachage SHA-256 legacy pour mots de passe", style_high))
story.append(Paragraph(
    "La fonction verifyPassword supporte un format legacy SHA-256 avec un simple salt. SHA-256 sans key-stretching est "
    "vulnerable aux attaques par force brute GPU (millions de hashes/seconde contre environ 10 000 pour bcrypt). Si des mots de passe "
    "utilisateurs sont encore dans ce format, ils sont extremement exposes. Le code supporte ce format pour la migration mais ne "
    "force pas la migration automatique vers bcrypt lors d'une connexion reussie avec un hash SHA-256.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/lib/auth.ts:30-33', style_code))

story.append(Spacer(1, 3*mm))
# H4
story.append(Paragraph("H4 - Token Telegram expose a tous les utilisateurs authentifies", style_high))
story.append(Paragraph(
    "La requete GET /api/telegram/agents selectionne le champ token pour tous les utilisateurs. Bien qu'il soit supprime pour "
    "les non-admins via un .map() manuel, cette approche est fragile. Si le code change ou si une erreur survient avant le "
    "stripping, les tokens Telegram complets fuient vers n'importe quel utilisateur y compris les viewers. La correction est "
    "de ne jamais selectionner le token dans la requete Prisma pour les non-admins, plutot que de le selectionner puis le supprimer.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/app/api/telegram/agents/route.ts:28', style_code))

story.append(Spacer(1, 3*mm))
# H5
story.append(Paragraph("H5 - 2FA non enforcee pour le compte admin hardcore", style_high))
story.append(Paragraph(
    "Le login du compte admin hardcore ne verifie ni n'impose la 2FA. Si un utilisateur admin en base de donnees a la 2FA "
    "activee, le compte admin-hardcoded-001 peut toujours se connecter avec seulement email + mot de passe, ignorant "
    "completement toute protection 2FA. Cela rend la double authentification inutile pour l'administrateur le plus sensible.", style_body))
story.append(Paragraph('<b>Fichier :</b> src/app/api/auth/route.ts:102-122', style_code))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 5. SECURITE - MOYENNES ET BASSES
# ══════════════════════════════════════════════════════
story.append(Paragraph("5. Securite - Vulnabilites Moyennes et Basses", style_h1))
story.append(section_line())

# M findings
story.append(Paragraph("5.1 Vulnabilites Moyennes", style_h2))

m_findings = [
    ("M1 - Headers de securite manquants dans le middleware",
     "Le middleware effectue la verification JWT mais n'ajoute aucun header de securite (X-Frame-Options, "
     "X-Content-Type-Options, Content-Security-Policy, HSTS, Referrer-Policy, X-XSS-Protection). Ces headers protegent "
     "contre le clickjacking, le MIME sniffing et les injections XSS. Note : next.config.ts ajoute certains headers mais "
     "pas via le middleware pour les routes API."),
    ("M2 - CORS wildcard sur le endpoint SSE",
     "Le endpoint /api/notifications/stream retourne Access-Control-Allow-Origin: * qui permet a n'importe quel site "
     "malveillant de se connecter au flux de notifications si un token valide est obtenu via XSS."),
    ("M3 - Mots de passe temporaires non transmis par canal securise",
     "L'API de gestion des membres genere des mots de passe temporaires (format CcA-XXXXXXXXXX) mais n'a aucun code "
     "pour les envoyer par email. Le mot de passe est stocke (hashe) en base mais jamais communique au nouveau membre."),
    ("M4 - Webhook Telegram sans validation de signature",
     "Le endpoint webhook ne verifie pas que la requete provient reellement de Telegram. Il n'y a pas de validation "
     "du secret_token. N'importe qui qui decouvre l'URL du webhook peut envoyer des faux messages."),
    ("M5 - Cle JWT dev fallback previsible",
     "Si la production tourne accidentellement en mode non-production, tous les JWT peuvent etre forges avec la cle "
     "publiquement connue 'chatcommerce-dev-only-fallback-key-2024', accordant un acces complet."),
]
for title, desc in m_findings:
    story.append(Paragraph(title, style_med))
    story.append(Paragraph(desc, style_body_sm))

story.append(Paragraph("5.2 Vulnabilites Basses", style_h2))

l_findings = [
    ("L1 - Pas de protection CSRF",
     "L'API s'appuie uniquement sur les Bearer tokens, ce qui protege naturellement contre CSRF. Cependant, les routes "
     "d'authentification acceptent des POST sans token CSRF."),
    ("L2 - Codes de backup 2FA non rate-limited",
     "Les endpoints 2FA n'ont pas de rate limiting explicite. Un attaquant avec un token de session valide pourrait "
     "brute-forcer le code TOTP a 6 chiffres (1 million de combinaisons) sans etre bloque."),
    ("L3 - Logs verbeux exposant des details internes",
     "Des logs console.log dans le code de production exposent des donnees de session, des userId, companyId, et des "
     "corps de requetes. Ces logs apparaissent dans Vercel Logs et pourraient fuiter des informations sensibles."),
]
for title, desc in l_findings:
    story.append(Paragraph(title, style_low))
    story.append(Paragraph(desc, style_body_sm))

# Full findings table
story.append(Paragraph("5.3 Tableau Recapitulatif des Vulnerabilites", style_h2))
findings_header = [
    Paragraph('<b>ID</b>', ParagraphStyle('fh', fontName='DejaVuSansBold', fontSize=7.5, textColor=ACCENT, alignment=TA_CENTER)),
    Paragraph('<b>Severite</b>', ParagraphStyle('fh', fontName='DejaVuSansBold', fontSize=7.5, textColor=ACCENT, alignment=TA_CENTER)),
    Paragraph('<b>Titre</b>', ParagraphStyle('fh', fontName='DejaVuSansBold', fontSize=7.5, textColor=ACCENT, alignment=TA_CENTER)),
    Paragraph('<b>Impact</b>', ParagraphStyle('fh', fontName='DejaVuSansBold', fontSize=7.5, textColor=ACCENT, alignment=TA_CENTER)),
]
all_findings = [
    finding_row('CRITIQUE', 'C1', 'Mot de passe admin en dur', 'Prise de controle admin totale'),
    finding_row('CRITIQUE', 'C2', 'Seed-demo cle en dur', 'Injection de donnees demo'),
    finding_row('CRITIQUE', 'C3', 'Token Telegram dans URL', 'Piratage de tous les bots'),
    finding_row('CRITIQUE', 'C4', 'Cron ouvert en dev', 'Declenchement arbitraire automations'),
    finding_row('HAUTE', 'H1', 'Rate limiting memoire', 'Brute-force illimite en prod'),
    finding_row('HAUTE', 'H2', 'Matcher middleware', 'Routes sans filet de securite'),
    finding_row('HAUTE', 'H3', 'SHA-256 legacy', 'Cracking GPU des mots de passe'),
    finding_row('HAUTE', 'H4', 'Token Telegram leak', 'Exposition des tokens bot'),
    finding_row('HAUTE', 'H5', '2FA admin bypassee', '2FA inutile pour admin'),
    finding_row('MOYENNE', 'M1', 'Headers securite', 'Clickjacking, XSS'),
    finding_row('MOYENNE', 'M2', 'CORS wildcard SSE', 'Leak notifications via XSS'),
    finding_row('MOYENNE', 'M3', 'Mdp temporaire non envoye', 'Invitations inutilisables'),
    finding_row('MOYENNE', 'M4', 'Webhook sans signature', 'Messages Telegram spoofes'),
    finding_row('MOYENNE', 'M5', 'JWT dev fallback', 'Forging JWT si mode dev'),
    finding_row('BASSE', 'L1', 'Pas de CSRF', 'Attenuation naturelle par JWT'),
    finding_row('BASSE', 'L2', '2FA non rate-limited', 'Brute-force TOTP possible'),
    finding_row('BASSE', 'L3', 'Logs verbeux', 'Leak info dans logs Vercel'),
]
findings_table = Table([findings_header] + all_findings, colWidths=[12*mm, 18*mm, CONTENT_W*0.38, CONTENT_W - 30*mm - CONTENT_W*0.38])
findings_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, TABLE_STRIPE]),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('TOPPADDING', (0, 0), (-1, -1), 1.5*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5*mm),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(findings_table)
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 6. BASE DE DONNEES
# ══════════════════════════════════════════════════════
story.append(Paragraph("6. Base de Donnees - Schema et Integrite", style_h1))
story.append(section_line())

story.append(Paragraph(
    "Le schema Prisma comporte 24 models avec plus de 45 relations explicites et 36 indexes. La conception multi-tenant est "
    "globalement bonne avec le modele Company comme hub central. Cependant, plusieurs problemes de conception meritent "
    "d'etre releves pour la maintenabilite et l'integrite des donnees a long terme.", style_body))

story.append(Paragraph("6.1 Statistiques du Schema", style_h2))
db_stats = [
    ['Metrique', 'Valeur', 'Appreciation'],
    ['Models Prisma', '24', 'Bonne couverture fonctionnelle'],
    ['Relations explicites', '45+', 'Architecture bien connectee'],
    ['Indexes @@index', '36', 'Bon pour les performances de lecture'],
    ['Uniques @@unique', '4', 'Peut etre renforce'],
    ['Cascade deletes', '4', 'Risque de perte de donnees'],
    ['Champs JSON', '7 types', 'Pas type-safe, difficile a valider'],
    ['Champs Float (financier)', '8+', 'Erreur d\'arrondi possible'],
    ['Soft delete', '0', 'Suppression definitive irreversible'],
    ['updatedAt manquant', '5 models', 'Pas de suivi modification'],
]
db_table = Table(db_stats, colWidths=[40*mm, 25*mm, CONTENT_W - 65*mm])
db_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSansBold'),
    ('FONTNAME', (0, 1), (-1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, -1), 8.5),
    ('TEXTCOLOR', (0, 0), (-1, 0), ACCENT),
    ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, TABLE_STRIPE]),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('TOPPADDING', (0, 0), (-1, -1), 2.5*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5*mm),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(db_table)

story.append(Paragraph("6.2 Problemes Identifies", style_h2))
db_issues = [
    "Champs financiers en Float : Product.price, Order.subtotal, Order.tax, Order.total, Invoice.amount, Payment.amount "
    "utilisent Float au lieu de Decimal. Cela peut entrainer des erreurs d'arrondi sur les montants financiers. Par exemple, "
    "14900 FCFA x 3 = 44700.0000001 au lieu de 44700. Les TODOs dans le schema reconnaissent ce probleme mais la migration "
    "n'a pas ete effectuee.",
    "Pas de soft delete : La suppression de donnees est definitive (hard delete). Pour une application CRM qui gere des donnees "
    "client sensibles, il faudrait un pattern de soft delete avec un champ deletedAt et des filtres pour exclure les enregistrements "
    "supprimes. La perte accidentelle de donnees est irreversible.",
    "JSON non type : notificationSettings, paymentSettings, openHours, aiConfig, filter, targetAudience, location sont stockes "
    "comme chaines JSON brutes sans validation de schema. Il n'y a pas de Zod ou de type Prisma pour valider la structure. "
    "Cela rend la maintenance difficile et les bugs silencieux possibles.",
    "Champs updatedAt manquants : Message, BusinessService, TelegramBooking et RateLimitLog n'ont pas de champ updatedAt, "
    "rendant impossible le suivi de la derniere modification sans parser les logs ou ajouter des triggers manuels.",
    "Pas de contraintes de cle etrangere pour la multi-tenancy : Les relations utilisent companyId comme scope mais il n'y a pas "
    "de contrainte database-level pour garantir que les enregistrements appartiennent bien a leur company. C'est fait au niveau "
    "de l'application (dans chaque query Prisma), ce qui est suffisant mais risque des erreurs si un oublie se produit.",
]
for issue in db_issues:
    story.append(Paragraph(f'<font color="{SEM_ERROR.hexval()}">!</font> {issue}', style_bullet))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 7. API ROUTES
# ══════════════════════════════════════════════════════
story.append(Paragraph("7. API - Routes et Logique Metier", style_h1))
story.append(section_line())

story.append(Paragraph(
    "L'API comporte 46 fichiers de route couvrant 14 domaines fonctionnels pour un total d'environ 9 279 lignes de code. "
    "La couverture d'authentification est bonne avec verifyToken present dans toutes les routes. La logique metier est globalement "
    "correcte mais presente des incoherences dans les checks de roles et la gestion des erreurs.", style_body))

story.append(Paragraph("7.1 Couverture par Domaine", style_h2))
api_domains = [
    ['Domaine', 'Routes', 'Lignes', 'Complexite'],
    ['Telegram', '9', '2 060', 'Haute - IA, webhooks, bots'],
    ['Livraisons', '5', '1 221', 'Haute - GPS, statuts multiples'],
    ['Dashboard/Reports/AI', '6', '1 142', 'Moyenne - Agregations SQL'],
    ['Authentification', '4', '854', 'Moyenne - JWT, 2FA, OTP'],
    ['Company/Admin', '3', '856', 'Moyenne - Multi-tenant'],
    ['Campagnes', '2', '498', 'Moyenne - Segmentation'],
    ['Chariow Paiement', '2', '510', 'Moyenne - Webhook callback'],
    ['Paiements Mobile', '3', '350', 'Moyenne - Orange/MTN Money'],
    ['Commandes', '1', '282', 'Basse - CRUD standard'],
    ['Contacts/Leads', '3', '361', 'Basse - CRUD standard'],
    ['Conversations', '2', '201', 'Basse - Chat inbox'],
    ['Produits', '2', '211', 'Basse - Catalogue CRUD'],
    ['Automations/Cron', '4', '148', 'Basse - Declencheurs'],
]
api_table = Table(api_domains, colWidths=[38*mm, 18*mm, 18*mm, CONTENT_W - 74*mm])
api_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSansBold'),
    ('FONTNAME', (0, 1), (-1, -1), 'NotoSansSC'),
    ('FONTSIZE', (0, 0), (-1, -1), 8),
    ('TEXTCOLOR', (0, 0), (-1, 0), ACCENT),
    ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, TABLE_STRIPE]),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('ALIGN', (1, 0), (2, -1), 'CENTER'),
    ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(api_table)

story.append(Paragraph("7.2 Problemes de Logique Metier", style_h2))
api_issues = [
    "Incoherence des checks de roles : isAdmin est defini comme company_admin || super_admin dans les routes API, "
    "ce qui confond les gestionnaires d'entreprise avec les administrateurs systeme. Un business user company_admin "
    "a le meme acces qu'un super_admin dans la plupart des routes, sauf pour le Global Token. Le ID en dur 'admin-hardcoded-001' "
    "est la seule veriable distinction pour les operations systeme.",
    "Erreurs silencieuses dans le frontend : 8 composants (leads, products, orders, inbox, contacts, automations, drivers, deliveries) "
    "avalent les erreurs avec .catch(console.error) sans montrer aucun feedback utilisateur. L'utilisateur ne sait pas si "
    "l'action a echoue.",
    "Suppression d'agents reservee aux admins : Les business users company_admin peuvent creer des agents mais ne peuvent pas "
    "les supprimer via l'API DELETE (403). Le frontend ne montre pas l'erreur car saveAgent ne lisait pas le message d'erreur "
    "(corrige recemment).",
    "Services CRUD admin-only : La creation et suppression de services pour un agent Telegram sont reservees aux admins. "
    "Les business users ne peuvent pas gerer les services de leurs propres agents.",
    "Pas de validation Zod pour les inputs API : La plupart des routes utilisent des checks manuels (if !name || !token) au "
    "lieu d'un schema Zod centralise. Cela rend la validation incomplete et difficile a maintenir.",
]
for issue in api_issues:
    story.append(Paragraph(f'<font color="{SEM_WARNING.hexval()}">!</font> {issue}', style_bullet))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 8. FRONTEND
# ══════════════════════════════════════════════════════
story.append(Paragraph("8. Frontend - Composants et Experience Utilisateur", style_h1))
story.append(section_line())

story.append(Paragraph(
    "Le frontend est construit avec 28 composants pages et 51 primitives shadcn/ui pour un total d'environ 14 500 lignes "
    "de code applicatif. L'experience utilisateur est globalement bonne avec un dark mode complet, un design responsive sur "
    "25/28 pages, et des indicateurs de chargement sur 20/21 pages. Cependant, plusieurs problemes significatifs affectent "
    "la qualite, la maintenabilite et l'accessibilite.", style_body))

story.append(Paragraph("8.1 Megacomposants - Probleme Principal", style_h2))
story.append(Paragraph(
    "Quatre composants depassent 1 300 lignes, ce qui constitue un anti-pattern majeur de maintenance. Le plus gros, "
    "telegram-page.tsx avec 2 086 lignes, contient environ 20 hooks useState, 15 fonctions callback, 4 dialogues inline, "
    "2 onglets, et tout le CRUD pour agents, services, reservations, config IA, token global, et webhook. Ce composant "
    "devrait etre decompose en au moins 6 sous-composants : AgentList, AgentForm, AgentConfigDialog, BookingManager, "
    "ServiceManager, et GlobalTokenCard. La meme recommandation s'applique a settings-page.tsx (1 791 lignes), "
    "auth-page.tsx (1 472 lignes qui combine page marketing, login et inscription), et admin-page.tsx (1 347 lignes).", style_body))

story.append(Paragraph("8.2 Erreurs Silencieuses", style_h2))
story.append(Paragraph(
    "Huit composants avalent les erreurs API sans aucun feedback utilisateur. Les fetch echouent silencieusement et "
    "seul console.error est appele. Les pages affectees sont : leads-page, products-page, orders-page, inbox-page, "
    "contacts-page, automations-page, drivers-page et deliveries-page. L'utilisateur ne voit ni toast, ni message, "
    "ni indicateur visuel que quelque chose a echoue. La correction est d'ajouter des toasts.error dans chaque catch.", style_body))

story.append(Paragraph("8.3 Accessibilite", style_h2))
story.append(Paragraph(
    "L'accessibilite est quasi inexistante. Seuls 2 fichiers (sidebar et notification-bell) ont des attributs aria-label "
    "et aria-expanded. La majorite des boutons icon-only n'ont pas de labels accessibles. Les elements interactifs custom "
    "comme les cartes d'agent utilisent div onClick au lieu de button. Il n'y a pas de gestion du focus apres ouverture "
    "ou fermeture de dialogues, pas de regions aria-live pour le contenu dynamique, et seulement 1 utilisation de sr-only. "
    "Le site ne serait pas conforme WCAG 2.1 AA.", style_body))

story.append(Paragraph("8.4 Incoherences Visuelles", style_h2))
story.append(Paragraph(
    "La page Telegram est la seule page qui n'utilise pas le composant Header partage, ce qui signifie pas de toggle de "
    "theme, pas de recherche, pas de notifications. La page auth combine trois vues distinctes (marketing, login, inscription) "
    "dans un seul composant de 1 472 lignes. products-page.tsx utilise des balises img brutes au lieu du composant "
    "Image de Next.js, ignorant l'optimisation d'images. Les boites de dialogue natives confirm() sont utilisees dans "
    "4 composants et ne respectent pas le dark mode.", style_body))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 9. PERFORMANCE
# ══════════════════════════════════════════════════════
story.append(Paragraph("9. Performance et Deploiement", style_h1))
story.append(section_line())

story.append(Paragraph("9.1 Performance", style_h2))
perf_items = [
    "Build reussi en 50 secondes sur Vercel (Turbopack + cache). Taille de upload 706.7 KB. Pas de fichiers statiques "
    "volumineux. Le lazy loading des pages n'est pas utilise car c'est une SPA, ce qui signifie que tout le JavaScript "
    "des 28 pages est charge des le premier hit. Un decoupage par route avec Next.js dynamic imports reduirait "
    "significativement le temps de chargement initial.",
    "La base de donnees Neon avec pooler de connexion est bien configuree pour le serverless. Cependant, il n'y a pas "
    "de mise en cache des requetes frequentes (dashboard stats, plan limits). Chaque page load declenche plusieurs "
    "requetes database qui pourraient etre mise en cache avec React Query ou un cache LRU.",
    "Le Telegram webhook handler effectue jusqu'a 4 requetes database par message recu (find agent, find services, "
    "create booking, update stats). Pour un bot populaire, cela pourrait devenir un goulot d'etranglement. "
    "L'ajout d'un cache en memoire pour les configs d'agent serait benefique.",
    "Pas de monitoring ou d'alerting configure. Il n'y a pas de Sentry, DataDog, ou equivalent pour tracer les "
    "erreurs en production. Les erreurs sont seulement visibles dans les logs Vercel qui ont une retention limitee.",
]
for item in perf_items:
    story.append(Paragraph(f'<font color="{SEM_INFO.hexval()}">></font> {item}', style_bullet))

story.append(Paragraph("9.2 Deploiement", style_h2))
deploy_items = [
    "Le deploiement est fait via Vercel CLI avec un token personnel encode en dur dans la commande de deploiement. "
    "Le token Vercel '(token supprime)' est visible dans l'historique "
    "des commandes et les logs. Il devrait etre stocke dans les secrets du CI/CD ou dans un fichier .env non versionne.",
    "Le fichier .env local pointe vers SQLite (file:./db/custom.db) au lieu de PostgreSQL Neon, ce qui signifie que "
    "le developpement local ne reflete pas l'environnement de production. JWT_SECRET et toutes les autres variables "
    "d'environnement ne sont pas configurees, forçant le fallback en dur.",
    "Le middleware genere un avertissement : 'The middleware file convention is deprecated. Please use proxy instead.' "
    "La migration vers le nouveau systeme proxy de Next.js 16 n'a pas ete effectuee et constitue une dette technique.",
]
for item in deploy_items:
    story.append(Paragraph(f'<font color="{SEM_WARNING.hexval()}">!</font> {item}', style_bullet))

story.append(Paragraph("9.3 Dependances", style_h2))
story.append(Paragraph(
    "Le projet utilise 37 dependances de production et 12 de dev. La plupart sont a jour. Cependant, next-auth est "
    "installee mais non utilisee (auth JWT custom est a la place). @mdxeditor/editor et react-syntax-highlighter sont "
    "installees mais leur utilisation n'est pas claire. ws (WebSocket) est installe pour le mini-service Telegram "
    "mais pas pour l'app principale. Un audit des dependances inutilisees reduirait la taille du build.", style_body))
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 10. PLAN D'ACTION
# ══════════════════════════════════════════════════════
story.append(Paragraph("10. Plan d'Action Prioritaire", style_h1))
story.append(section_line())

story.append(Paragraph(
    "Ce plan d'action priorise les corrections par urgence et impact. Les actions critiques doivent etre menees immediatement, "
    "suivies des actions a court terme (1-2 semaines), moyen terme (1-2 mois) et long terme (3-6 mois). Chaque action est "
    "estimee en effort pour aider a la planification.", style_body))

story.append(Paragraph("Phase 1 : Corrections Immediates (0-3 jours)", style_h2))
p1_items = [
    ["Supprimer le fallback du mot de passe admin en dur", "4h", "CRITIQUE"],
    ["Implementer le rate limiting avec Upstash Redis", "8h", "CRITIQUE"],
    ["Ajouter les headers de securite dans le middleware", "2h", "HAUTE"],
    ["Migrer le token Telegram du query param vers un header", "4h", "CRITIQUE"],
    ["Corriger les 8 composants avec erreurs silencieuses", "4h", "HAUTE"],
    ["Enlever la verification dev-only dans les crons", "1h", "CRITIQUE"],
]
p1_table = Table(
    [['Action', 'Effort', 'Priorite']] + [[Paragraph(r[0], style_body_sm), Paragraph(r[1], ParagraphStyle('e', fontName='DejaVuSans', fontSize=8, textColor=ACCENT, alignment=TA_CENTER)), Paragraph(r[2], ParagraphStyle('p', fontName='DejaVuSansBold', fontSize=8, textColor=CRIT_COLOR, alignment=TA_CENTER))] for r in p1_items],
    colWidths=[CONTENT_W - 25*mm, 15*mm, 10*mm]
)
p1_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSansBold'),
    ('FONTSIZE', (0, 0), (-1, 0), 8),
    ('TEXTCOLOR', (0, 0), (-1, 0), ACCENT),
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, TABLE_STRIPE]),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(p1_table)

story.append(Paragraph("Phase 2 : Court Terme (1-2 semaines)", style_h2))
p2_items = [
    ["Migrer les Float financiers vers Decimal dans Prisma", "12h", "HAUTE"],
    ["Migrer les mots de passe SHA-256 vers bcrypt", "6h", "HAUTE"],
    ["Ajouter la validation de signature Telegram webhook", "3h", "MOYENNE"],
    ["De-composer telegram-page.tsx en sous-composants", "16h", "HAUTE"],
    ["Implementer l'envoi d'emails pour mots de passe temporaires", "8h", "MOYENNE"],
    ["Ajouter un monitoring d'erreurs (Sentry ou equivalent)", "4h", "MOYENNE"],
    ["Migrer le middleware vers le nouveau systeme proxy", "6h", "MOYENNE"],
]
p2_table = Table(
    [['Action', 'Effort', 'Priorite']] + [[Paragraph(r[0], style_body_sm), Paragraph(r[1], ParagraphStyle('e2', fontName='DejaVuSans', fontSize=8, textColor=ACCENT, alignment=TA_CENTER)), Paragraph(r[2], ParagraphStyle('p2', fontName='DejaVuSansBold', fontSize=8, textColor=HIGH_COLOR, alignment=TA_CENTER))] for r in p2_items],
    colWidths=[CONTENT_W - 25*mm, 15*mm, 10*mm]
)
p2_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSansBold'),
    ('FONTSIZE', (0, 0), (-1, 0), 8),
    ('TEXTCOLOR', (0, 0), (-1, 0), ACCENT),
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, TABLE_STRIPE]),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(p2_table)

story.append(Paragraph("Phase 3 : Moyen et Long Terme (1-6 mois)", style_h2))
p3_items = [
    ["Implementer le soft delete pattern sur les models cles", "16h", "MOYENNE"],
    ["Ajouter la validation Zod sur toutes les inputs API", "20h", "MOYENNE"],
    ["Migrer vers Next.js file-system routing (SSR)", "40h", "BASSE"],
    ["Ajouter des tests unitaires et d'integration", "60h", "BASSE"],
    ["Ameliorer l'accessibilite (WCAG 2.1 AA)", "30h", "BASSE"],
    ["Implementer la mise en cache des requetes frequentes", "12h", "BASSE"],
    ["Nettoyer les dependances inutilisees (next-auth, ws, etc.)", "2h", "BASSE"],
]
p3_table = Table(
    [['Action', 'Effort', 'Priorite']] + [[Paragraph(r[0], style_body_sm), Paragraph(r[1], ParagraphStyle('e3', fontName='DejaVuSans', fontSize=8, textColor=ACCENT, alignment=TA_CENTER)), Paragraph(r[2], ParagraphStyle('p3', fontName='DejaVuSansBold', fontSize=8, textColor=MED_COLOR, alignment=TA_CENTER))] for r in p3_items],
    colWidths=[CONTENT_W - 25*mm, 15*mm, 10*mm]
)
p3_table.setStyle(TableStyle([
    ('FONTNAME', (0, 0), (-1, 0), 'DejaVuSansBold'),
    ('FONTSIZE', (0, 0), (-1, 0), 8),
    ('TEXTCOLOR', (0, 0), (-1, 0), ACCENT),
    ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, TABLE_STRIPE]),
    ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
    ('TOPPADDING', (0, 0), (-1, -1), 2*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 2*mm),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
]))
story.append(p3_table)
story.append(PageBreak())

# ══════════════════════════════════════════════════════
# 11. VERDICT FINAL
# ══════════════════════════════════════════════════════
story.append(Paragraph("11. Verdict Final", style_h1))
story.append(section_line())

story.append(Paragraph(
    "ChatCommerce CRM Africa est un projet ambitieux et fonctionnellement riche. La couverture des fonctionnalites CRM "
    "est impressionnante pour un projet de cette envergure : gestion de contacts, leads, conversations WhatsApp, produits, "
    "commandes, factures, campagnes marketing, automations, livraisons avec suivi GPS, et surtout un systeme complet de "
    "12 agents Telegram avec IA integree. L'architecture technique est moderne et globalement coherente, avec un bon choix "
    "de stack (Next.js 16, Prisma, PostgreSQL, shadcn/ui, Tailwind v4). Le systeme de multi-tenancy est bien implemente "
    "et les 4 plans de tarification sont correctement geres.", style_body))

story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    '<font color="#e74c3c"><b>CEPENDANT</b></font>, le projet souffre de vulnerabilites de securite critiques qui rendent '
    'le deploiement en production dangereux sans corrections prealables. Le mot de passe admin en dur, le rate limiting '
    'inefficace, le token Telegram dans les URLs et les cles secrtes en dur sont des failles qui pourraient etre exploitees '
    'rapidement par un attaquant motive. La confiance excessive dans les checks cote client (role depuis localStorage) et '
    'la confusion entre company_admin (business user) et super_admin (system admin) creent des risques de privilege escalation.', style_body))

story.append(Spacer(1, 3*mm))
story.append(Paragraph(
    "Le verdict est nuance. Sur le plan fonctionnel, le projet merite un <font color='#81bd95'><b>7/10</b></font> pour "
    "sa couverture et son ambition. Sur le plan securite, il merite un <font color='#e74c3c'><b>4/10</b></font> en l'etat. "
    "Avec les corrections de la Phase 1 (estimees a 23 heures de travail), la note de securite pourrait monter a "
    "<font color='#b79b61'><b>7/10</b></font>. La note globale ponderee est de "
    "<font color='#e2c469'><b>5.5 / 10</b></font>.", style_body))

story.append(Spacer(1, 5*mm))

# Final verdict box
verdict_data = [
    [Paragraph('<font color="#e2c469" size="20"><b>VERDICT : 5.5 / 10</b></font>', ParagraphStyle('verdict', fontName='DejaVuSansBold', fontSize=20, leading=26, textColor=ACCENT, alignment=TA_CENTER))],
    [Paragraph(
        '<font color="#81bd95">FONCTIONNELLEMENT IMPRESSIONNANT</font> - La couverture CRM et Telegram est remarquable.<br/>'
        '<font color="#e74c3c">SECURITE INSUFFISANTE</font> - 4 vulnerabilites critiques doivent etre corrigees immediatement.<br/>'
        '<font color="#b79b61">MAINTENABILITE A AMELIORER</font> - Megacomposants, erreurs silencieuses, accessibilite.<br/>'
        '<font color="#799ec3">POTENTIEL ELEVE</font> - Avec les corrections recommandees, ce CRM peut etre production-ready.',
        ParagraphStyle('verdict_body', fontName='NotoSansSC', fontSize=9.5, leading=16, textColor=TEXT_PRIMARY, alignment=TA_CENTER))],
]
verdict_table = Table(verdict_data, colWidths=[CONTENT_W])
verdict_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
    ('BOX', (0, 0), (-1, -1), 1, ACCENT),
    ('TOPPADDING', (0, 0), (-1, -1), 5*mm),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5*mm),
    ('LEFTPADDING', (0, 0), (-1, -1), 5*mm),
    ('RIGHTPADDING', (0, 0), (-1, -1), 5*mm),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
]))
story.append(verdict_table)

story.append(Spacer(1, 8*mm))
story.append(Paragraph(
    "Recommandation finale : Corriger les 6 actions de la Phase 1 immediatement (estime : 23h). Poursuivre avec les actions "
    "de Phase 2 dans les 2 semaines suivantes. Le projet a un potentiel reel et une couverture fonctionnelle qui le distingue. "
    "Avec les corrections de securite et de maintenabilite recommandees, ChatCommerce CRM Africa peut devenir une plateforme "
    "CRM competitve pour le marche africain.", style_body))

# ── Build PDF ──
doc.build(story, onFirstPage=draw_cover_bg, onLaterPages=draw_page_bg)
print(f"PDF generated: {OUTPUT_PATH}")
print(f"Size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")
