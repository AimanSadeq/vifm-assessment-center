from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor, white
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER

PRIMARY = HexColor("#010131")
ACCENT = HexColor("#5391D5")
LIGHT_BG = HexColor("#F4F6F8")
BORDER = HexColor("#DDE1E6")
TEXT = HexColor("#333333")
TEXT_LIGHT = HexColor("#666666")

output_path = r"C:\Users\AimanSadeq\OneDrive - Virginia Institute of Finance\VIFM ASSESSMENT CENTER\VIFM_AC_Portal_Production_Checklist.pdf"

s_title = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=22, textColor=white, alignment=TA_CENTER)
s_subtitle = ParagraphStyle("subtitle", fontName="Helvetica", fontSize=12, textColor=ACCENT, alignment=TA_CENTER)
s_date = ParagraphStyle("date", fontName="Helvetica", fontSize=10, textColor=HexColor("#8899bb"), alignment=TA_CENTER)
s_phase = ParagraphStyle("phase", fontName="Helvetica-Bold", fontSize=13, textColor=PRIMARY, spaceBefore=14, spaceAfter=2)
s_meta = ParagraphStyle("meta", fontName="Helvetica", fontSize=8, textColor=TEXT_LIGHT, spaceAfter=6)
s_item = ParagraphStyle("item", fontName="Helvetica", fontSize=9, textColor=TEXT, leading=13)
s_cb = ParagraphStyle("cb", fontName="Helvetica", fontSize=12, textColor=ACCENT)
s_notes = ParagraphStyle("notes", fontName="Helvetica-Bold", fontSize=11, textColor=PRIMARY, spaceBefore=18, spaceAfter=6)

phases = [
    ("PHASE A: DESIGN FINALIZATION", "Owner: VIFM Team  |  Timeline: 1-2 weeks", [
        "Walk through Admin portal - create engagement, add candidates, assign assessors",
        "Walk through Assessor portal - observe, rate, integrate, wash-up",
        "Walk through Candidate portal - welcome, consent, assessments, report",
        "Walk through Client portal - dashboard, engagements, reports, analytics",
        "Review and finalize all 33 competency descriptions",
        "Review Arabic translations with a native Arabic speaker",
        "Generate PDF report - print and review for client-readiness",
        "Add real exercise content - briefings, timing, role player guides",
        "Test the gamified process maps on all 4 portals",
        "Test mobile responsiveness on phone and tablet",
        "Flag any UI/UX changes for developer",
    ]),
    ("PHASE B: AUTHENTICATION & SECURITY", "Owner: Developer  |  Timeline: 1-2 days", [
        "Set AUTH_ENABLED = true in src/middleware.ts",
        "Create admin user in Supabase Dashboard > Authentication",
        "Insert admin profile in profiles table with role: admin",
        "Switch all pages from createServiceClient() to createClient()",
        "Uncomment auth guards in API routes (PDF reports, consent)",
        "Wire getClientOrgId() to read from authenticated session",
        "Test login flow - email/password and magic link",
        "Test logout flow on all 4 portals",
        "Verify RLS policies - each role sees only their own data",
        "Verify cross-client data isolation",
    ]),
    ("PHASE C: DEPLOYMENT", "Owner: Developer  |  Timeline: 30 minutes", [
        "Connect GitHub repo to Vercel",
        "Set all environment variables in Vercel project settings",
        "Deploy to production",
        "Configure custom domain (e.g., ac.vifm.ae)",
        "Verify SSL certificate is active",
        "Test all pages on production URL",
        "Verify PDF report generation works on production",
    ]),
    ("PHASE D: INTEGRATION SETUP", "Owner: Both  |  Timeline: 1-2 hours", [
        "Create SendGrid or Resend account for transactional emails",
        "Add EMAIL_PROVIDER and EMAIL_API_KEY to environment",
        "Test candidate invitation email",
        "Get Anthropic API key from console.anthropic.com (optional)",
        "Add ANTHROPIC_API_KEY to environment (optional)",
        "Test AI observation classifier (optional)",
        "Create Daily.co account for video conferencing (optional)",
        "Add DAILY_API_KEY to environment (optional)",
        "Run RPC migration (00005) in Supabase SQL Editor",
    ]),
    ("PHASE E: PILOT ASSESSMENT CENTER", "Owner: VIFM Team  |  Timeline: 1 day", [
        "Create a real engagement with actual client and competencies",
        "Add real candidate names and emails",
        "Create assessor accounts for your team",
        "Configure exercises with real briefing content",
        "Run a pilot observation session with one assessor",
        "Complete ratings for all competencies",
        "Fill integration worksheets",
        "Run a wash-up session - test Realtime collaboration",
        "Finalize OAR with recommendation",
        "Generate and review the final PDF report",
        "Share report with a colleague for feedback",
        "Collect assessor feedback - What is missing? What is confusing?",
    ]),
    ("PHASE F: GO LIVE", "Owner: VIFM Team  |  Timeline: Ongoing", [
        "Send first real client engagement",
        "Monitor ICC scores after first wash-up",
        "Check bias detection metrics",
        "Collect feedback from candidates after their AC",
        "Collect feedback from client after receiving reports",
        "Document any change requests for the developer",
        "Schedule quarterly platform review",
    ]),
]

def header_footer(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFont("Helvetica", 7)
    canvas_obj.setFillColor(TEXT_LIGHT)
    canvas_obj.drawCentredString(A4[0]/2, 15*mm, "Virginia Institute of Finance and Management - CONFIDENTIAL")
    canvas_obj.drawRightString(A4[0] - 20*mm, 15*mm, "Page %d" % doc.page)
    canvas_obj.restoreState()

doc = SimpleDocTemplate(output_path, pagesize=A4, topMargin=20*mm, bottomMargin=25*mm, leftMargin=20*mm, rightMargin=20*mm)
story = []

# Header banner
title_data = [
    [Paragraph("VIFM Assessment Center Portal", s_title)],
    [Paragraph("Production Checklist - From Development to Go-Live", s_subtitle)],
    [Paragraph("April 2026", s_date)],
]
title_table = Table(title_data, colWidths=[doc.width])
title_table.setStyle(TableStyle([
    ("BACKGROUND", (0,0), (-1,-1), PRIMARY),
    ("TOPPADDING", (0,0), (0,0), 24),
    ("BOTTOMPADDING", (-1,-1), (-1,-1), 24),
    ("LEFTPADDING", (0,0), (-1,-1), 16),
    ("RIGHTPADDING", (0,0), (-1,-1), 16),
]))
story.append(title_table)
story.append(Spacer(1, 8*mm))

# Phases
for name, meta, items in phases:
    story.append(Paragraph(name, s_phase))
    story.append(Paragraph(meta, s_meta))

    rows = []
    for item in items:
        rows.append([
            Paragraph("\u25a1", s_cb),
            Paragraph(item, s_item),
        ])

    t = Table(rows, colWidths=[8*mm, doc.width - 10*mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("TOPPADDING", (0,0), (-1,-1), 2),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ("LEFTPADDING", (0,0), (0,-1), 0),
        ("LEFTPADDING", (1,0), (1,-1), 2),
        ("LINEBELOW", (0,-1), (-1,-1), 0.5, BORDER),
    ]))
    story.append(t)
    story.append(Spacer(1, 2*mm))

# Notes
story.append(Paragraph("NOTES", s_notes))
for i in range(8):
    line = Table([[""]], colWidths=[doc.width])
    line.setStyle(TableStyle([
        ("LINEBELOW", (0,0), (-1,-1), 0.5, BORDER),
        ("TOPPADDING", (0,0), (-1,-1), 14),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(line)

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("PDF created successfully: " + output_path)
