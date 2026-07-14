# -*- coding: utf-8 -*-
"""
Report: Recherche Concurrentielle CRM en Afrique & Plan de Lancement
Body PDF (ReportLab) — Cover is merged separately.
"""
import os, sys, hashlib
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm, inch
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, Image
)
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfgen import canvas

# ━━ Font Registration ━━
FONT_DIR = '/usr/share/fonts'
pdfmetrics.registerFont(TTFont('FreeSerif', f'{FONT_DIR}/truetype/freefont/FreeSerif.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Bold', f'{FONT_DIR}/truetype/freefont/FreeSerifBold.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-Italic', f'{FONT_DIR}/truetype/freefont/FreeSerifItalic.ttf'))
pdfmetrics.registerFont(TTFont('FreeSerif-BoldItalic', f'{FONT_DIR}/truetype/freefont/FreeSerifBoldItalic.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'))
pdfmetrics.registerFont(TTFont('NotoSerifSC-Bold', f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DejaVuSans', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('FreeSerif', normal='FreeSerif', bold='FreeSerif-Bold',
                    italic='FreeSerif-Italic', boldItalic='FreeSerif-BoldItalic')
registerFontFamily('NotoSerifSC', normal='NotoSerifSC', bold='NotoSerifSC-Bold')

# ━━ Cascade Palette ━━
PAGE_BG       = colors.HexColor('#f0f0ee')
SECTION_BG    = colors.HexColor('#f2f2f1')
CARD_BG       = colors.HexColor('#eeedeb')
TABLE_STRIPE  = colors.HexColor('#f3f3f1')
HEADER_FILL   = colors.HexColor('#5e563b')
COVER_BLOCK   = colors.HexColor('#6b6248')
BORDER        = colors.HexColor('#cac6bb')
ICON          = colors.HexColor('#7e6f44')
ACCENT        = colors.HexColor('#8f7422')
ACCENT_2      = colors.HexColor('#50a8c5')
TEXT_PRIMARY   = colors.HexColor('#1a1917')
TEXT_MUTED     = colors.HexColor('#908e87')
SEM_SUCCESS   = colors.HexColor('#479b63')
SEM_WARNING   = colors.HexColor('#9a814f')
SEM_ERROR     = colors.HexColor('#98433b')
SEM_INFO      = colors.HexColor('#527292')

TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE

# ━━ Styles ━━
styles = getSampleStyleSheet()

style_h1 = ParagraphStyle(
    'CustomH1', fontName='FreeSerif-Bold', fontSize=20, leading=26,
    textColor=TEXT_PRIMARY, spaceBefore=18, spaceAfter=10,
    alignment=TA_LEFT
)
style_h2 = ParagraphStyle(
    'CustomH2', fontName='FreeSerif-Bold', fontSize=14, leading=20,
    textColor=HEADER_FILL, spaceBefore=14, spaceAfter=8,
    alignment=TA_LEFT
)
style_h3 = ParagraphStyle(
    'CustomH3', fontName='FreeSerif-Bold', fontSize=12, leading=17,
    textColor=ICON, spaceBefore=10, spaceAfter=6,
    alignment=TA_LEFT
)
style_body = ParagraphStyle(
    'CustomBody', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6,
    alignment=TA_JUSTIFY
)
style_body_left = ParagraphStyle(
    'CustomBodyLeft', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=6,
    alignment=TA_LEFT
)
style_bullet = ParagraphStyle(
    'CustomBullet', fontName='FreeSerif', fontSize=10.5, leading=17,
    textColor=TEXT_PRIMARY, spaceBefore=2, spaceAfter=4,
    leftIndent=20, bulletIndent=8, alignment=TA_LEFT
)
style_caption = ParagraphStyle(
    'CustomCaption', fontName='FreeSerif-Italic', fontSize=9, leading=13,
    textColor=TEXT_MUTED, spaceBefore=3, spaceAfter=6,
    alignment=TA_CENTER
)
style_callout = ParagraphStyle(
    'CustomCallout', fontName='FreeSerif-Bold', fontSize=11, leading=17,
    textColor=ACCENT, spaceBefore=6, spaceAfter=6,
    leftIndent=12, borderWidth=2, borderColor=ACCENT,
    borderPadding=6, alignment=TA_LEFT
)

# TOC Styles
toc_level0 = ParagraphStyle(
    'TOC0', fontName='FreeSerif-Bold', fontSize=12, leading=20,
    leftIndent=0, textColor=TEXT_PRIMARY
)
toc_level1 = ParagraphStyle(
    'TOC1', fontName='FreeSerif', fontSize=10.5, leading=18,
    leftIndent=20, textColor=TEXT_MUTED
)

# ━━ TocDocTemplate ━━
class TocDocTemplate(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if hasattr(flowable, 'bookmark_name'):
            level = getattr(flowable, 'bookmark_level', 0)
            text = getattr(flowable, 'bookmark_text', '')
            key = getattr(flowable, 'bookmark_key', '')
            self.notify('TOCEntry', (level, text, self.page, key))

def add_heading(text, style, level=0):
    key = f'h_{hashlib.md5(text.encode()).hexdigest()[:8]}'
    p = Paragraph(f'<a name="{key}"/>{text}', style)
    p.bookmark_name = key
    p.bookmark_level = level
    p.bookmark_text = text
    p.bookmark_key = key
    return p

# ━━ Helper Functions ━━
def hr():
    return HRFlowable(width='85%', thickness=0.5, color=BORDER, spaceBefore=6, spaceAfter=6)

def make_table(headers, rows, col_widths=None):
    avail = A4[0] - 2*inch
    if col_widths is None:
        n = len(headers)
        col_widths = [avail / n] * n
    else:
        total = sum(col_widths)
        col_widths = [w * avail / total for w in col_widths]

    header_row = [Paragraph(f'<b>{h}</b>', ParagraphStyle(
        'TH', fontName='FreeSerif-Bold', fontSize=9.5, leading=13,
        textColor=TABLE_HEADER_TEXT, alignment=TA_CENTER
    )) for h in headers]

    data = [header_row]
    for row in rows:
        data.append([Paragraph(str(c), ParagraphStyle(
            'TD', fontName='FreeSerif', fontSize=9, leading=13,
            textColor=TEXT_PRIMARY, alignment=TA_LEFT
        )) for c in row])

    t = Table(data, colWidths=col_widths, hAlign='CENTER')
    style_cmds = [
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('FONTNAME', (0, 0), (-1, 0), 'FreeSerif-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]
    for i in range(1, len(data)):
        bg = TABLE_ROW_EVEN if i % 2 == 1 else TABLE_ROW_ODD
        style_cmds.append(('BACKGROUND', (0, i), (-1, i), bg))
    t.setStyle(TableStyle(style_cmds))
    return t

# ━━ Page Number ━━
def page_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont('FreeSerif', 8)
    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.drawRightString(A4[0] - inch, 0.5*inch,
        f'{doc.page}')
    canvas_obj.drawString(inch, 0.5*inch,
        'Recherche Concurrentielle CRM Afrique - Juillet 2026')
    canvas_obj.restoreState()

# ━━ BUILD ━━
OUTPUT = '/home/z/my-project/scripts/body_crm_africa.pdf'
doc = TocDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=inch, rightMargin=inch,
    topMargin=inch, bottomMargin=inch,
    title='Recherche Concurrentielle CRM en Afrique et Plan de Lancement',
    author='Z.ai', creator='Z.ai',
    subject='Analyse strategique du marche CRM en Afrique'
)

story = []

# ── TABLE OF CONTENTS ──
toc = TableOfContents()
toc.levelStyles = [toc_level0, toc_level1]
story.append(Paragraph('<b>Table des matieres</b>', ParagraphStyle(
    'TOCTitle', fontName='FreeSerif-Bold', fontSize=22, leading=28,
    textColor=TEXT_PRIMARY, spaceBefore=0, spaceAfter=18, alignment=TA_LEFT
)))
story.append(toc)
story.append(PageBreak())

# ══════════════════════════════════════════════════════════════
# CHAPITRE 1 : Vue d'ensemble du marche CRM en Afrique
# ══════════════════════════════════════════════════════════════
story.append(add_heading('<b>Chapitre 1 : Vue d\'ensemble du marche CRM en Afrique</b>', style_h1, 0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>1.1 Etat actuel du marche mondial du CRM</b>', style_h2, 1))
story.append(Paragraph(
    'Le marche mondial des logiciels de gestion de la relation client (CRM) a atteint une valorisation de 79,6 milliards de dollars americains en 2025, selon Grand View Research. Les projections indiquent une croissance soutenue avec un taux de croissance annuel compose (TCRAM) de 9,3% entre 2026 et 2033, portant le marche a 161,3 milliards de dollars. Cette expansion est tiree par la transformation numerique acceleree des entreprises, l\'adoption croissante des solutions cloud et l\'integration de l\'intelligence artificielle dans les plateformes CRM. Le segment Moyen-Orient et Afrique affiche le taux de croissance le plus eleve au monde, avec un TCRAM de 15,4% sur la periode 2025-2030, signe d\'un potentiel considerable encore largement sous-exploite.',
    style_body
))
story.append(Paragraph(
    'Les leaders mondiaux du CRM maintiennent une domination solide sur le marche. Salesforce reste le numero un incontestable avec environ 23 a 26% de parts de marche, suivie par Adobe, HubSpot, Oracle et Microsoft Dynamics. Les dix premiers fournisseurs representent ensemble 54,2% du marche total, laissant une part significative aux acteurs de niche et aux solutions regionalisees. Cette concentration du marche au niveau mondial contraste fortement avec la situation en Afrique, ou les acteurs locaux et regionaux gagnent progressivement du terrain grace a une meilleure comprehension des specificites du marche.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>1.2 Specificites du marche africain</b>', style_h2, 1))
story.append(Paragraph(
    'Le marche africain du CRM se distingue par plusieurs caracteristiques fondamentales qui le differencient des marches matures d\'Europe et d\'Amerique du Nord. Premierement, l\'adoption du CRM en Afrique est fortement correele a la penetration du mobile. Avec plus de 540 millions d\'utilisateurs de telephones mobiles en Afrique subsaharienne et une penetration d\'Internet mobile de 27% en 2023 (Brookings Institution), les solutions CRM doivent imperativement etre concues avec une approche mobile-first. Les utilisateurs africains interagissent davantage avec leurs outils professionnels via des smartphones que via des ordinateurs de bureau, ce qui impose des interfaces legeres, rapides et adaptees aux connexions a faible debit.',
    style_body
))
story.append(Paragraph(
    'Deuxiemement, le tissu economique africain est domine par les PME, qui representent plus de 90% des entreprises et environ 60% de l\'emploi sur le continent. Ces entreprises ont des besoins specifiques en matiere de CRM : simplicite d\'utilisation, cout accessible, integration avec les outils de paiement locaux (mobile money), et capacite a fonctionner dans des environnements ou la connectivite peut etre intermittente. Les grandes entreprises representent 60,3% de l\'adoption du CRM en 2025, mais les PME progressent a un rythme impressionnant de 24,8% de TCRAM, selon Mordor Intelligence, suggerant un basculement progressif vers une adoption de masse.',
    style_body
))
story.append(Paragraph(
    'Troisiemement, l\'ecosysteme de paiement africain est particulier avec la preponderance du mobile money. Le marche du mobile money en Afrique etait evalue a 9,18 milliards de dollars en 2025 et devrait atteindre 67,18 milliards d\'ici 2034, avec un TCRAM exceptionnel de 25,3%. Plus de 1 300 milliards de dollars ont transite par des portefeuilles mobiles en Afrique en 2025, dont 498 milliards pour la seule Afrique de l\'Ouest. Cette realite fait du mobile money non pas une option mais une necessite pour toute solution CRM souhaiteant penetrer le marche africain. Orange Money et MTN Mobile Money dominent le paysage, avec une initiative d\'interoperabilite paneafricaine (Mowali) qui ouvre de nouvelles possibilites d\'integration.',
    style_body
))

# Key metrics table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Indicateur', 'Valeur', 'Source'],
    [
        ['Taille du marche CRM mondial (2025)', '79,6 milliards USD', 'Grand View Research'],
        ['TCRAM CRM Moyen-Orient et Afrique', '15,4% (2025-2030)', 'Grand View Research'],
        ['Marche Mobile Money Afrique (2025)', '9,18 milliards USD', 'IMARC Group'],
        ['Projection Mobile Money Afrique (2034)', '67,18 milliards USD', 'IMARC Group'],
        ['TCRAM Mobile Money Afrique', '25,3% (2026-2034)', 'IMARC Group'],
        ['Contribution mobile au PIB africain (2025)', '240 milliards USD (7,8% du PIB)', 'GSMA'],
        ['Transformation numerique Afrique (2025)', '30,24 milliards USD', 'Mordor Intelligence'],
        ['Adoption CRM grandes entreprises Afrique', '60,3% (2025)', 'Mordor Intelligence'],
        ['TCRAM adoption CRM par les PME', '24,8%', 'Mordor Intelligence'],
    ],
    [0.40, 0.35, 0.25]
))
story.append(Paragraph('Tableau 1 : Indicateurs cles du marche CRM et digital en Afrique', style_caption))
story.append(Spacer(1, 18))

story.append(add_heading('<b>1.3 Dynamiques regionales : focus sur l\'Afrique Centrale et francophone</b>', style_h2, 1))
story.append(Paragraph(
    'L\'Afrique Centrale et francophone represente un marche emergent pour les solutions CRM, avec des dynamiques propres qui meritent une attention particuliere. Le Cameroun, en tant que porte d\'entree de la region CEMAC (Communaite Economique et Monetaire de l\'Afrique Centrale), concentre une part significative de l\'activite economique de la sous-region. Avec une population de plus de 28 millions d\'habitants, un PIB de 45 milliards de dollars et un ecosysteme entrepreneurial dynamique, le Cameroun offre un terrain fertile pour le deploiement de solutions CRM ciblees. Les secteurs des telecommunications, de la banque, de l\'immobilier et du commerce general sont les plus demandeurs d\'outils de gestion de la relation client.',
    style_body
))
story.append(Paragraph(
    'Le Congo-Brazzaville, le Gabon et la Guinee Equatoriale completent le paysage de la zone CEMAC avec des marches plus modestes mais des besoins croissants en digitalisation. L\'integration economique de la sous-region, facilitee par l\'utilisation du Franc CFA (XAF) comme monnaie commune, simplifie les strategies de tarification et de paiement. Orange Money et MTN Mobile Money sont les deux operateurs de paiement mobile dominants dans l\'ensemble de la zone, couvrant ensemble plus de 80% de la population adulte. L\'interoperabilite grandissante entre ces reseaux, avec l\'initiative Mowali portee par Orange et MTN, facilite les transactions transfrontalieres et renforce l\'attractivite du marche pour les solutions SaaS integrees.',
    style_body
))

# ══════════════════════════════════════════════════════════════
# CHAPITRE 2 : Analyse concurrentielle approfondie
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 24))
story.append(add_heading('<b>Chapitre 2 : Analyse concurrentielle approfondie</b>', style_h1, 0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>2.1 Segmentation du paysage concurrentiel</b>', style_h2, 1))
story.append(Paragraph(
    'Le paysage concurrentiel des solutions CRM en Afrique peut etre segmente en trois categories distinctes : les geants mondiaux, les acteurs africains specialises, et les solutions generiques adaptees. Chaque categorie presente des avantages et des inconvenients specifiques en termes de fonctionnalites, de tarification, d\'adaptation locale et de support. Comprendre cette segmentation est essentiel pour identifier les opportunites de differenciation et positionner efficacement une nouvelle solution sur le marche. L\'analyse qui suit examine en profondeur les principaux acteurs de chaque segment, leurs forces et faiblesses, et leur pertinence pour le marche de l\'Afrique Centrale francophone.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>2.2 Les geants mondiaux du CRM</b>', style_h2, 1))

story.append(add_heading('<b>2.2.1 Salesforce</b>', style_h3, 1))
story.append(Paragraph(
    'Salesforce demeure le leader incontestable du marche mondial du CRM, avec environ 23 a 26% de parts de marche et une reconnaissance comme numero un par IDC pour la douzieme annee consecutive. La plateforme offre une suite complete incluant la gestion des ventes (Sales Cloud), du service client (Service Cloud), du marketing (Marketing Cloud) et de l\'analytique (Einstein Analytics). Salesforce a initie des efforts d\'expansion en Afrique, notamment en Afrique du Sud et au Nigeria, avec des partenariats locaux et des centres de donnees regionaux. Cependant, plusieurs facteurs limitent sa penetration en Afrique Centrale : un cout prohibitif pour les PME (les forfaits debutent a 25 USD/utilisateur/mois, hors taxes et adaptation), une complexite de mise en oeuvre necessitant des consultants certifies, et une absence d\'integration native avec les solutions de paiement mobile money locales. De plus, l\'interface est principalement en anglais, ce qui constitue une barriere linguistique pour les marches francophones.',
    style_body
))

story.append(add_heading('<b>2.2.2 HubSpot</b>', style_h3, 1))
story.append(Paragraph(
    'HubSpot s\'est positionne comme la solution CRM la plus populaire aupres des PME grace a son modele freemium attractif et a son interface intuitive. La version gratuite de HubSpot offre des fonctionnalites de base pour la gestion des contacts, le suivi des pipelines de vente et le marketing par email, ce qui la rend particulierement attractive pour les entreprises en phase de demarrage. En Afrique, HubSpot est frequemment recommande comme premier CRM grace a sa simplicite de configuration et sa flexibilite de prix. Neanmoins, les limitations deviennent evidentes lorsque les entreprises africaines veulent passer a l\'echelle : les forfaits payants (Starter a 20 USD/mois, Professional a 890 USD/mois, Enterprise a 3 600 USD/mois) sont libelles en dollars americains et ne prennent pas en compte les realites economiques locales. L\'absence d\'integration native avec Orange Money et MTN Mobile Money oblige les entreprises a recourir a des solutions tierces couteuses, et le support client est principalement anglophone avec des fuseaux horaires defavorables.',
    style_body
))

story.append(add_heading('<b>2.2.3 Zoho CRM</b>', style_h3, 1))
story.append(Paragraph(
    'Zoho CRM se distingue par son rapport qualite-prix agressif, avec des forfaits debutant a 14 USD/utilisateur/mois et une version gratuite pour jusqu\'a 3 utilisateurs. La plateforme offre un ecosysteme complet de plus de 50 applications couvrant la vente, le marketing, le support, la comptabilite et la collaboration. Zoho a fait des efforts significatifs pour s\'adapter aux marches emergents, avec des data centres en Inde et en Europe, et un support multilingue incluant le francais. En Afrique, Zoho est particulierement populaire aupres des entreprises de taille moyenne qui cherchent un bon equilibre entre fonctionnalites et cout. Cependant, comme ses concurrents mondiaux, Zoho manque d\'integrations natives avec les ecosystemes de paiement mobile africains, et son model de prix en dollars americains reste un frein pour les PME de l\'Afrique Centrale ou les budgets informatiques sont exprimes en FCFA.',
    style_body
))

story.append(add_heading('<b>2.2.4 Microsoft Dynamics 365 et Oracle CX</b>', style_h3, 1))
story.append(Paragraph(
    'Microsoft Dynamics 365 et Oracle CX complete le panorama des acteurs mondiaux. Dynamics 365 beneficie d\'un ecosysteme Office 365 largement deploye en Afrique, ce qui facilite l\'adoption dans les grandes entreprises et les administrations. Oracle CX, de son cote, cible principalement les grandes organisations avec des besoins complexes en analytique et en personnalisation. Ces deux solutions partagent les memes limitations que Salesforce et HubSpot sur le marche africain : des prix eleves, une complexite de mise en oeuvre, et un manque d\'adaptation aux specificites locales. Leur presence en Afrique Centrale et francophone reste marginale, concentree principalement sur les filiales de multinationales et les grandes banques.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>2.3 Les acteurs africains specialises</b>', style_h2, 1))

story.append(add_heading('<b>2.3.1 CRM Africa</b>', style_h3, 1))
story.append(Paragraph(
    'CRM Africa se positionne comme le CRM "fait en Afrique, pour l\'Afrique". La plateforme combine la gestion de la relation client avec la gestion de projets, la facturation et l\'integration M-PESA pour les paiements. Son modele "gratuit pour toujours" pour jusqu\'a 10 utilisateurs represente une proposition de valeur extremement competitive pour les PME africaines. CRM Africa a compris que le succes en Afrique passe par l\'integration des paiements locaux et la simplification des processus. Cependant, la plateforme reste principalement orientee vers l\'Afrique de l\'Est (Kenya) et l\'Afrique du Sud, avec une presence limitee en Afrique Centrale et francophone. L\'integration M-PESA ne couvre pas les marches Orange Money et MTN Mobile Money qui dominent l\'Afrique Centrale, et l\'interface n\'est pas disponible en francais.',
    style_body
))

story.append(add_heading('<b>2.3.2 The Buzz CRM</b>', style_h3, 1))
story.append(Paragraph(
    'The Buzz CRM se positionne comme une plateforme CRM premium destinee aux entreprises de services de luxe. La solution offre une boite de reception unifiee, une IA vocale, des automatisations avancees et un focus particulier sur l\'experience client haut de gamme. Le positionnement de The Buzz CRM est clairement oriente vers un segment de niche : les entreprises de services premium (salons de beaute, cliniques esthetiques, hotels de luxe, cabinets juridiques). Cette specialisation lui permet de proposer des fonctionnalites tres adaptees a son marche cible, mais limite son adresse a un segment restreint du marche global du CRM en Afrique. La tarification est superieure a la moyenne, ce qui la place en concurrence indirecte avec les solutions mondiales plutot qu\'avec les acteurs locaux grand public.',
    style_body
))

story.append(add_heading('<b>2.3.3 Autres acteurs notables</b>', style_h3, 1))
story.append(Paragraph(
    'Plusieurs autres acteurs meritent d\'etre mentionnes dans le paysage concurrentiel africain. Trembi offre une solution CRM legere populaire dans les marches est-africains, avec un accent sur la simplicite et le prix abordable. EngageBay, une alternative indienne, propose un CRM gratuit avec des fonctionnalites de marketing et de service client, qui a gagne en popularite aupres des startups africaines grace a sa generosite en termes de fonctionnalites gratuites. Pipedrive, bien qu\'etant un acteur europeen (estonien), a penetre plusieurs marches africains grace a son interface intuitive centree sur le pipeline de ventes et ses integrations avec WhatsApp Business, un canal de communication incontournable en Afrique. BaseCloud, actif en Afrique du Sud, se differencie par son integration avec WhatsApp Business et les outils comptables Sage et Xero, repondant a un besoin reel de coherence ecosystemique.',
    style_body
))

# Competitor comparison table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Acteur', 'Type', 'Prix (debut)', 'Mobile Money', 'Francophone', 'PME Afrique'],
    [
        ['Salesforce', 'Mondial', '25 USD/mois', 'Non', 'Partiel', 'Faible'],
        ['HubSpot', 'Mondial', 'Gratuit / 20 USD', 'Non', 'Non', 'Moyen'],
        ['Zoho CRM', 'Mondial', 'Gratuit / 14 USD', 'Non', 'Oui', 'Bon'],
        ['Microsoft Dynamics', 'Mondial', '65 USD/mois', 'Non', 'Oui', 'Faible'],
        ['Pipedrive', 'Europeen', '14 USD/mois', 'Non', 'Non', 'Moyen'],
        ['CRM Africa', 'Africain', 'Gratuit (10 users)', 'M-PESA', 'Non', 'Tres bon'],
        ['The Buzz CRM', 'Africain', 'Premium', 'Non', 'Non', 'Niche'],
        ['EngageBay', 'Indien', 'Gratuit', 'Non', 'Non', 'Bon'],
    ],
    [0.17, 0.12, 0.18, 0.17, 0.14, 0.22]
))
story.append(Paragraph('Tableau 2 : Comparatif des principaux concurrents CRM sur le marche africain', style_caption))
story.append(Spacer(1, 18))

story.append(add_heading('<b>2.4 Analyse SWOT des concurrents sur le marche africain</b>', style_h2, 1))
story.append(Paragraph(
    'L\'analyse des forces et faiblesses de la concurrence revele des failles strategiques majeures que peut exploiter un nouvel entrant. Le premier constat est l\'absence quasi-totale d\'integration native avec les solutions de paiement mobile money en Afrique Centrale. Aucun des acteurs mondiaux (Salesforce, HubSpot, Zoho, Microsoft) ne propose d\'integration directe avec Orange Money ou MTN Mobile Money, obligeant les entreprises a recourir a des developpements sur mesure couteux ou a des intermediaires de paiement tiers. Deuxiemement, la barriere linguistique est un frein sous-estime : la majorite des CRM sont concus en anglais en premier lieu, avec des traductions francaises souvent incompletes ou mal adaptees au contexte africain francophone. Troisiemement, le modele de tarification en dollars americains est deconnecte des realites economiques locales, ou les budgets sont exprimes en FCFA et les fluctuations de change peuvent augmenter significativement les couts.',
    style_body
))
story.append(Paragraph(
    'Un deuxieme constat concerne l\'inadaptation des interfaces et des processus aux pratiques commerciales africaines. Les CRM mondiaux sont concus pour des cycles de vente structures avec des processus de qualification standardises (BANT, MEDDIC), qui ne correspondent pas toujours aux relations commerciales en Afrique ou le personnel, la recommandation et la negociation informelle jouent un role central. Les fonctionnalites de gestion des contacts doivent integrer les specificites locales : numeros de telephone avec indicatifs pays, gestion multidevise (FCFA, USD, EUR), prise en compte des fuseaux horaires multiples, et suivi des interactions via WhatsApp qui reste le canal de communication predominant. Ces lacunes representent autant d\'opportunites de differenciation pour un CRM concu specifiquement pour l\'Afrique Centrale francophone.',
    style_body
))

# ══════════════════════════════════════════════════════════════
# CHAPITRE 3 : Le marche du Mobile Money en Afrique
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 24))
story.append(add_heading('<b>Chapitre 3 : Le marche du Mobile Money en Afrique</b>', style_h1, 0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>3.1 Etat des lieux et chiffres cles</b>', style_h2, 1))
story.append(Paragraph(
    'Le mobile money est devenu la colonne vertebrale de l\'economie numerique africaine, transformant fondamentalement la facon dont les particuliers et les entreprises effectuent des transactions financieres. En 2025, le marche du mobile money en Afrique a ete evalue a 9,18 milliards de dollars, avec des projections de croissance spectaculaire a 67,18 milliards d\'ici 2034, representant un TCRAM de 25,3% selon IMARC Group. Plus de 1 300 milliards de dollars ont transite par des portefeuilles mobiles africains en 2025, un chiffre qui temoigne de la maturite et de l\'ampleur de ce marche. L\'Afrique de l\'Ouest a represente a elle seule 498 milliards de dollars de transactions, tandis que les marches d\'Afrique de l\'Est et d\'Afrique Centrale connaissent des taux de croissance encore plus rapides.',
    style_body
))
story.append(Paragraph(
    'Le GSMA rapporte que dans les marches africains ou le mobile money est disponible, un adulte sur quatre est desormais un utilisateur actif. L\'urbanisation croissante, la baisse des couts de transaction et l\'expansion de l\'interoperabilite entre operateurs contribuent a cette adoption massive. L\'initiative Mowali, lancee conjointement par Orange et MTN, represente un tournant majeur en permettant l\'interoperabilite des paiements mobiles a l\'echelle paneafricaine. Cette avancee technologique ouvre de nouvelles possibilites pour les fournisseurs de SaaS comme les solutions CRM, qui peuvent desormais integrer des paiements transfrontalieres sans negocier des partenariats separement avec chaque operateur.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>3.2 Orange Money et MTN Mobile Money : les duopoles nationaux</b>', style_h2, 1))
story.append(Paragraph(
    'Le paysage du mobile money en Afrique Centrale et de l\'Ouest francophone est domine par deux acteurs majeurs : Orange Money (groupe Orange) et MTN Mobile Money (groupe MTN). Ces deux operateurs telecom cumulent plus de 80% des parts de marche dans la majorite des pays de la zone CEMAC et de l\'UEMOA. Orange Money beneficie de la presence historique du groupe Orange en Afrique francophone, avec des filiales dans plus de 20 pays africains et une base de clients mobile money depassant les 70 millions d\'utilisateurs actifs. MTN Mobile Money, de son cote, est le leader inconteste en Afrique de l\'Est et du Sud, avec une presence croissante en Afrique de l\'Ouest et Centrale, notamment au Cameroun ou les deux operateurs se livrent une concurrence feroce.',
    style_body
))
story.append(Paragraph(
    'Orange Money et MTN Mobile Money ont tous deux lance des API de paiement (Orange Money Web Payment API et MTN MoMo API) qui permettent aux marchands et aux fournisseurs de services d\'integrer le paiement mobile directement dans leurs applications web et mobiles. Ces API offrent des fonctionnalites de collecte de paiements, de remboursements et de verification de transactions, ce qui les rend particulierement adaptees a l\'integration dans des solutions SaaS comme les CRM. Pour un CRM cible sur l\'Afrique Centrale, l\'integration de ces deux API est non negligeable : elle permet aux entreprises de facturer leurs abonnements CRM directement via mobile money, eliminant ainsi la barriere du paiement par carte bancaire qui touche moins de 10% de la population adulte dans la region.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>3.3 Opportunites d\'integration CRM - Mobile Money</b>', style_h2, 1))
story.append(Paragraph(
    'L\'integration du mobile money dans une solution CRM ouvre des possibilites strategiques considérables pour les entreprises africaines. Premierement, elle permet d\'automatiser le processus de facturation et de recouvrement : les abonnements CRM peuvent etre preleves automatiquement via Orange Money ou MTN Mobile Money, reduisant les delais de paiement et les couts administratifs. Deuxiemement, elle enrichit les donnees client en associant chaque transaction a un profil CRM, offrant une vue a 360 degres de la relation client incluant l\'historique des paiements. Troisiemement, elle facilite la monetisation des services a valeur ajoutee (rapports avances, support prioritaire, modules supplementaires) via des micro-transactions mobile money, un modele particulierement adapte aux PME africaines qui preferent les paiements incrementaux aux engagements annuels importants.',
    style_body
))
story.append(Paragraph(
    'Le modele de paiement manuel par reference de transaction, tel qu\'implemente dans notre CRM (ou l\'utilisateur effectue un paiement mobile money puis soumet la reference de transaction pour validation administrative), represente une approche pragmatique qui s\'adapte parfaitement aux realites du marche. Ce modele evite la complexite technique de l\'integration API directe tout en offrant une experience utilisateur fluide. A moyen terme, l\'evolution vers une integration API complete (via Orange Money Web Payment et MTN MoMo API) permettra d\'automatiser davantage le processus et d\'offrir des paiements en temps reel, une fonctionnalite que aucun concurrent actuel ne propose de maniere native sur le marche de l\'Afrique Centrale.',
    style_body
))

# ══════════════════════════════════════════════════════════════
# CHAPITRE 4 : Previsions et tendances du marche
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 24))
story.append(add_heading('<b>Chapitre 4 : Previsions et tendances du marche</b>', style_h1, 0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>4.1 Previsions de croissance du marche CRM en Afrique</b>', style_h2, 1))
story.append(Paragraph(
    'Les previsions de croissance du marche CRM en Afrique sont parmi les plus optimistes au monde, portees par une conjonction de facteurs favorables. Le TCRAM de 15,4% pour la region Moyen-Orient et Afrique (Grand View Research) est significativement superieur a la moyenne mondiale de 9,3%, refletant le potentiel de rattrapage du continent. Le marche de la transformation numerique en Afrique, evalue a 22,67 milliards de dollars en 2024, devrait atteindre 45,76 milliards d\'ici 2029 (Research and Markets), creeant un ecosysteme favorable a l\'adoption des solutions CRM. Les technologies mobiles ont contribue a hauteur de 240 milliards de dollars au PIB africain en 2025, soit 7,8% du PIB continental, selon le GSMA, soulignant l\'importance strategique du secteur mobile comme catalyseur de la transformation numerique des entreprises.',
    style_body
))

# Projections table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Annee', 'CRM Monde (Mds USD)', 'CRM MEA (estimation)', 'Mobile Money Afrique (Mds USD)'],
    [
        ['2025', '79,6', '3,2', '9,18'],
        ['2026', '86,4', '3,7', '11,5'],
        ['2027', '94,5', '4,3', '14,4'],
        ['2028', '103,3', '4,9', '18,0'],
        ['2029', '112,9', '5,7', '22,6'],
        ['2030', '123,4', '6,6', '28,3'],
        ['2032 (p.)', '146,0', '8,8', '44,0'],
        ['2034 (p.)', '161,3', '11,5', '67,2'],
    ],
    [0.15, 0.28, 0.28, 0.29]
))
story.append(Paragraph('Tableau 3 : Projections de croissance du marche CRM et Mobile Money en Afrique (estimations)', style_caption))
story.append(Spacer(1, 18))

story.append(add_heading('<b>4.2 Tendances technologiques majeures</b>', style_h2, 1))
story.append(Paragraph(
    'Plusieurs tendances technologiques vont transformer le marche du CRM en Afrique au cours des prochaines annees. L\'intelligence artificielle generative est en train de passer d\'une fonctionnalite premium a une commodite, avec des capacites d\'automatisation des interactions client, de prediction de churn et de personnalisation des offres qui deviendront des attentes standard de la part des utilisateurs. La transition de l\'automatisation reactive a l\'automatisation autonome, mise en evidence par Technavio comme tendance majeure 2025-2030, va permettre aux PME africaines d\'automatiser des processus jusqu\'alors reserves aux grandes entreprises equipees d\'equipes CRM dediees.',
    style_body
))
story.append(Paragraph(
    'L\'integration native de WhatsApp Business comme canal de communication CRM va s\'accelerer, WhatsApp etant l\'application la plus utilisee en Afrique avec plus de 200 millions d\'utilisateurs sur le continent. Les CRM qui offriront une integration bidirectionnelle complete avec WhatsApp (envoi de messages, reception de reponses, suivi automatique des interactions dans le pipeline CRM) auront un avantage competitif decisif. Par ailleurs, l\'informatique en nuage (cloud computing) continue de democratise l\'acces aux solutions CRM en eliminant le besoin d\'infrastructure locale, un facteur particulierement important en Afrique ou les couts d\'infrastructure sont eleves et la fiabilite du reseau electrique reste un defi pour de nombreuses entreprises.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>4.3 Facteurs de risque et incertitudes</b>', style_h2, 1))
story.append(Paragraph(
    'Malgre les perspectives favorables, plusieurs facteurs de risque doivent etre pris en compte dans toute strategie de penetration du marche CRM en Afrique. La volatilite des devises africaines face au dollar americain et a l\'euro peut affecter significativement la rentabilite des solutions SaaS tarifees en devises etrangeres. L\'instabilite politique et reglementaire dans certains pays de la region CEMAC peut ralentir l\'adoption des solutions cloud et creer des incertitudes pour les investisseurs et les entreprises. Les infrastructures de telecommunications, bien qu\'en amelioration constante, restent insuffisantes dans certaines zones rurales et semi-urbaines, limitant la portee des solutions cloud native.',
    style_body
))
story.append(Paragraph(
    'La concurrence accrue des acteurs mondiaux qui investissent de plus en plus en Afrique (Salesforce a ouvert des bureaux au Nigeria et en Afrique du Sud, HubSpot a lance des programmes partenaires en Afrique) represents une menace a moyen terme. De plus, le phenomene des SaaS africains qui "calent" entre 10 000 et 30 000 dollars de revenus mensuels recorrents (MRR), comme le souligne une analyse recente publiee sur LinkedIn, illustre la difficulte de passer du stade de l\'adoption initiale a l\'echelle sur le continent. Ce plafonnement est souvent du a un deficit de stratgie go-to-market adaptee et a une dependance excessive au bouche-a-oreille au detriment de canaux d\'acquisition structurels et reproductibles.',
    style_body
))

# ══════════════════════════════════════════════════════════════
# CHAPITRE 5 : Plan de lancement complet
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 24))
story.append(add_heading('<b>Chapitre 5 : Plan de lancement complet</b>', style_h1, 0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>5.1 Phase 1 : Pre-lancement (Mois 1-3)</b>', style_h2, 1))
story.append(Paragraph(
    'La phase de pre-lancement est cruciale pour poser les fondations solides d\'une penetration reussie du marche. Cette phase de trois mois se concentre sur la finalisation du produit, la validation sur le terrain et la preparation des canaux de distribution. La priorite absolue est d\'obtenir un produit minimum viable (MVP) parfaitement fonctionnel, teste avec des utilisateurs reels dans le contexte camerounais, et accompagne d\'une documentation complete en francais. Durant cette phase, il est essentiel de constituer un groupe de 10 a 15 entreprises beta-testeuses reparties dans les secteurs cles (telecommunications, banque, immobilier, commerce, transport) afin de recueillir des retours qualitatifs sur l\'utilisation reelle du CRM dans un environnement de production.',
    style_body
))
story.append(Paragraph(
    'Les activites cles de cette phase incluent la finalisation de l\'integration du paiement mobile money (Orange Money et MTN Mobile Money), la traduction complete de l\'interface en francais avec adaptation au contexte camerounais (terminologie locale, formats de numeros de telephone, references au FCFA), la mise en place d\'une infrastructure d\'hebergement fiable (serveur dedie avec Caddy comme reverse proxy, certificat SSL, sauvegardes automatiques), et la creation d\'un site web de presentation en francais avec un tunnel de conversion clair (inscription gratuite, demonstration en ligne, prise de contact). Il est egalement recommande de produire des supports de communication adaptes : videos de demonstration courtes (2-3 minutes) en francais, fiches techniques par secteur d\'activite, et etudes de cas basees sur les retours des beta-testeurs.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>5.2 Phase 2 : Lancement initial (Mois 4-6)</b>', style_h2, 1))
story.append(Paragraph(
    'Le lancement initial cible le marche camerounais avec une strategie de penetration agresstive basee sur le freemium et le marketing digital. L\'objectif est d\'atteindre 100 entreprises inscrites et 20 entreprises payantes a la fin du sixieme mois. Le plan tarifaire en FCFA (5 000 FCFA/mois pour le plan Starter, 29 900 FCFA/mois pour le plan Business, 99 900 FCFA/mois pour le plan Enterprise) est un avantage competitif determinant, car il elimine la barriere du change et s\'aligne sur les budgets locaux. La tarification en FCFA avec paiement via mobile money (Orange Money et MTN Mobile Money) est une proposition de valeur unique sur le marche : aucun concurrent ne propose actuellement un paiement aussi simple et localise.',
    style_body
))
story.append(Paragraph(
    'Les canaux d\'acquisition prioritaires pour cette phase sont les suivants. Le marketing digital cible sur les reseaux sociaux (Facebook, Instagram, LinkedIn), avec un accent sur les groupes d\'entrepreneurs camerounais et les communautes professionnelles en ligne. Les partenariats avec les incubateurs et accelerateurs d\'entreprises (Activspaces, Cameroun Startup Ecosystem, Bantu Hub) pour acceder a un flux regulier de startups en croissance. La participation aux salons professionnels et evenements economiques (Forum Economique du Cameroun, salons de l\'immobilier, congres des telecommunications) pour la visibilite de marque et la demonstration en face-a-face. Le marketing de contenu avec la publication reguliere d\'articles de blog en francais sur les thematiques CRM, gestion d\'entreprise et transformation numerique en Afrique. Enfin, le programme de parrainage offrant un mois gratuit pour chaque nouvelle entreprise recrutee par un utilisateur existant.',
    style_body
))

# Launch timeline table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Phase', 'Periode', 'Objectifs cles', 'KPI'],
    [
        ['Pre-lancement', 'Mois 1-3', 'MVP, beta-test, infrastructure', '15 beta-testeurs, 90% uptime'],
        ['Lancement initial', 'Mois 4-6', 'Penetration marche camerounais', '100 inscrites, 20 payantes'],
        ['Consolidation', 'Mois 7-9', 'Retention, optimisation produit', '80% retention, 50 payantes'],
        ['Expansion regionale', 'Mois 10-12', 'Congo, Gabon, RCA', '200 inscrites, 100 payantes'],
        ['Scale-up', 'Mois 13-24', 'Afrique francophone ete ndue', '1 000 inscrites, 500 payantes'],
    ],
    [0.15, 0.13, 0.40, 0.32]
))
story.append(Paragraph('Tableau 4 : Calendrier de lancement et indicateurs de performance (KPI)', style_caption))
story.append(Spacer(1, 18))

story.append(add_heading('<b>5.3 Phase 3 : Consolidation et expansion (Mois 7-12)</b>', style_h2, 1))
story.append(Paragraph(
    'La troisieme phase se concentre sur la consolidation de la base installee au Cameroun et le debut de l\'expansion regionale vers les autres marches de la zone CEMAC (Congo-Brazzaville, Gabon, Guinee Equatoriale, Tchad, RCA). L\'objectif est d\'atteindre 200 entreprises inscrites et 100 entreprises payantes a la fin de la premiere annee, avec un taux de retention mensuel superieur a 80%. La consolidation passe par l\'amelioration continue du produit basee sur les retours des utilisateurs, l\'ajout de fonctionnalites demandees (rapports avances, tableaux de bord personnalises, integration WhatsApp Business), et la mise en place d\'un support client reactif disponible en francais via WhatsApp, email et telephone.',
    style_body
))
story.append(Paragraph(
    'L\'expansion regionale necessite une adaptation du produit et de la strategie marketing a chaque marche cible. Bien que les pays de la zone CEMAC partagent la meme monnaie (FCFA) et des similitudes culturelles, chaque pays a ses propres specificites en matiere de reglementation, de paysage concurrentiel et de canaux de distribution. Le modele de partenaire local est recommande pour cette phase : identifier et former des partenaires commerciaux dans chaque pays cible, qui seront charges de la prospection, de la demonstration et du suivi des clients locaux en echange d\'une commission sur les abonnements. Ce modele hybride (direct au Cameroun + partenaires dans les autres pays) permet de combiner le controle qualite du marche domestique avec la rapidite d\'expansion a l\'international.',
    style_body
))

story.append(Spacer(1, 12))
story.append(add_heading('<b>5.4 Phase 4 : Scale-up et levée de fonds (Mois 13-24)</b>', style_h2, 1))
story.append(Paragraph(
    'La quatrieme phase vise l\'echelle a l\'echelle de l\'Afrique francophone ete ndue (Cote d\'Ivoire, Senegal, Mali, Burkina Faso, Benin, Togo, Niger) et la preparation d\'une levee de fonds de pre-seed ou seed pour accelerer la croissance. L\'objectif est d\'atteindre 1 000 entreprises inscrites et 500 entreprises payantes a la fin de la deuxieme annee, generant un revenu mensuel recorrent (MRR) de 5 a 15 millions de FCFA. La levee de fonds sera facilitee par des metriques solides : taux de retention, cout d\'acquisition client (CAC), valeur vie client (LTV), et croissance mois sur mois du MRR.',
    style_body
))
story.append(Paragraph(
    'Les investisseurs cibles pour cette levee de fonds sont les fonds d\'investissement specialises dans l\'Afrique (Partech Africa, Novastar Ventures, LoftyInc, GreenHouse Capital), les accelerateurs avec des programmes africains (Y Combinator, Techstars, Antler, Startup Wise Guys), et les business angels africains et internationaux interesses par les opportunites du marche SaaS africain. La preparation du pitch deck et des projections financieres doit mettre en avant les avantages competitifs uniques : paiement en FCFA via mobile money, interface 100% en francais, adaptation aux pratiques commerciales africaines, et modele de tarification accessible aux PME. Les projections financieres pour les 24 premiers mois doivent montrer un chemin clair vers la rentabilite, avec un point mort estime entre le 18eme et le 24eme mois selon le rythme d\'acquisition.',
    style_body
))

# ══════════════════════════════════════════════════════════════
# CHAPITRE 6 : Recommandations strategiques
# ══════════════════════════════════════════════════════════════
story.append(Spacer(1, 24))
story.append(add_heading('<b>Chapitre 6 : Recommandations strategiques</b>', style_h1, 0))
story.append(Spacer(1, 6))

story.append(add_heading('<b>6.1 Avantages competitifs a valoriser</b>', style_h2, 1))
story.append(Paragraph(
    'L\'analyse approfondie du paysage concurrentiel et du marche permet d\'identifier cinq avantages competitifs majeurs a valoriser pour penetrer efficacement le marche du CRM en Afrique Centrale et francophone. Le premier avantage est le paiement en FCFA via Orange Money et MTN Mobile Money, une fonctionnalite qu\'aucun concurrent ne propose de maniere native. Ce differenciateur elimine la barriere du paiement par carte bancaire et du change devise, deux des principaux freins a l\'adoption des solutions SaaS en Afrique. Le deuxieme avantage est l\'interface 100% en francais, adaptee au contexte africain francophone avec la terminologie locale, les formats de donnees specifiques et les references culturelles appropriees.',
    style_body
))
story.append(Paragraph(
    'Le troisieme avantage est la tarification en FCFA alignee sur les budgets locaux, avec des plans accessibles (5 000 FCFA pour le Starter) qui permettent aux plus petites entreprises de debuter avec un CRM sans risque financier significatif. Le quatrieme avantage est l\'adaptation aux pratiques commerciales africaines : gestion des relations basees sur le personnel et la recommandation, integration de WhatsApp comme canal de communication principal, et suivi des paiements en liquide et mobile money. Le cinquieme avantage est la legerete et la rapidite de l\'application, concue pour fonctionner sur des connexions a faible debit et des appareils de gamme moyenne, une necessite absolue sur le marche africain ou la qualite du reseau Internet reste variable.',
    style_body
))

# SWOT Table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Dimension', 'Elements'],
    [
        ['Forces', 'Paiement Mobile Money natif, interface francaise, tarification FCFA, legerete, adaptation locale'],
        ['Faiblesses', 'Marque inconnue, equipe limitee, dependance infrastructure locale, absence de levée de fonds'],
        ['Opportunites', 'Marche en forte croissance (15,4%), faible pénétration CRM actuelle, interoperabilite Mowali, demande PME'],
        ['Menaces', 'Entree de Salesforce/HubSpot, instabilite reglementaire, volatilite FCFA, concurrence CRM Africa'],
    ],
    [0.18, 0.82]
))
story.append(Paragraph('Tableau 5 : Matrice SWOT pour le lancement du CRM en Afrique Centrale', style_caption))
story.append(Spacer(1, 18))

story.append(add_heading('<b>6.2 Positionnement recommande</b>', style_h2, 1))
story.append(Paragraph(
    'Le positionnement recommande est celui du "CRM africain de reference pour les PME francophones", avec une promesse de marque claire : "Le CRM qui parle votre langue, accepte votre monnaie, et comprend votre commerce". Ce positionnement cible deliberement le segment des PME africaines francophones de 5 a 50 employes, un segment sous-desservi par les acteurs mondiaux (trop chers, pas adaptes) et par les acteurs locaux (trop concentres sur d\'autres regions). La strategie de prix doit rester agresstive avec un rapport qualite-prix imbattable : le plan Starter a 5 000 FCFA/mois (environ 7,6 EUR) est 3 a 5 fois moins cher que les solutions mondiales les moins cheres, tout en offrant les fonctionnalites essentielles dont les PME ont reellement besoin.',
    style_body
))

story.append(add_heading('<b>6.3 Indicateurs de suivi et de performance</b>', style_h2, 1))
story.append(Paragraph(
    'Le suivi de la performance doit s\'appuyer sur un tableau de bord d\'indicateurs cles structure autour de quatre axes. Le premier axe est l\'acquisition : nombre d\'inscriptions nouvelles par mois, cout d\'acquisition client (CAC), taux de conversion essai gratuit vers payant, et provenance des utilisateurs (organique, partenaires, reseaux sociaux, evenements). Le deuxieme axe est l\'engagement : nombre d\'utilisateurs actifs quotidiens et mensuels, nombre de contacts crees par entreprise, nombre de transactions de paiement traitees, et frequence d\'utilisation des differentes fonctionnalites du CRM. Le troisieme axe est la retention : taux de churn mensuel, revenu mensuel recorrent (MRR), taux d\'expansion (revenus supplementaires par upsell), et Net Promoter Score (NPS). Le quatrieme axe est la rentabilite : marge brute par abonnement, cout de support par client, ratio LTV/CAC cible superieur a 3, et date prevue du point mort.',
    style_body
))

# KPI table
story.append(Spacer(1, 18))
story.append(make_table(
    ['Indicateur', 'Mois 6', 'Mois 12', 'Mois 24'],
    [
        ['Entreprises inscrites', '100', '200', '1 000'],
        ['Entreprises payantes', '20', '100', '500'],
        ['Taux de retention', '75%', '80%', '85%'],
        ['MRR (FCFA)', '500 000', '3 000 000', '10 000 000'],
        ['CAC (FCFA)', '15 000', '10 000', '8 000'],
        ['NPS', '30', '45', '55'],
        ['Support (heures reponse)', '< 24h', '< 12h', '< 4h'],
    ],
    [0.30, 0.20, 0.20, 0.30]
))
story.append(Paragraph('Tableau 6 : Objectifs d\'indicateurs de performance par phase', style_caption))
story.append(Spacer(1, 18))

story.append(add_heading('<b>6.4 Feuille de route technologique</b>', style_h2, 1))
story.append(Paragraph(
    'La feuille de route technologique doit s\'articuler autour de trois horizons temporels. A court terme (0-6 mois), les priorites sont la stabilisation de la plateforme existante, l\'optimisation des performances, la mise en place du monitoring et des alertes, et l\'automatisation du processus de validation des paiements mobile money. A moyen terme (6-12 mois), les developpements cles incluent l\'integration API directe avec Orange Money Web Payment et MTN MoMo API pour les paiements automatiques, l\'ajout d\'un module de rapports et tableaux de bord avances, l\'integration WhatsApp Business bidirectionnelle, et le developpement d\'une application mobile progressive (PWA) pour un acces hors ligne. A long terme (12-24 mois), la vision inclut l\'integration de l\'intelligence artificielle pour la prediction de churn et la recommandation d\'actions commerciales, le support multi-pays avec adaptation reglementaire automatique, et l\'ouverture d\'une API publique pour permettre a des developpeurs tiers de creer des integrations et des extensions.',
    style_body
))

# ━━ BUILD DOCUMENT ━━
doc.multiBuild(story, onLaterPages=page_footer, onFirstPage=page_footer)
print(f'Body PDF generated: {OUTPUT}')