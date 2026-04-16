#!/usr/bin/env python3
"""Genera el Manual del Portal Agente de Argencargo en PDF — versión CHINO."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

# Register Chinese font
pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))

W, H = A4
DARK = HexColor("#0f1b30")
ACCENT = HexColor("#4A90D9")
YELLOW = HexColor("#fbbf24")
WHITE = HexColor("#ffffff")
GRAY = HexColor("#94a3b8")
TEXT = HexColor("#cbd5e1")

# Font shortcuts
ZH = "STSong-Light"

sTitle = ParagraphStyle("title", fontName=ZH, fontSize=26, textColor=WHITE, alignment=TA_CENTER, spaceAfter=4*mm)
sBrand = ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=36, textColor=ACCENT, alignment=TA_CENTER, spaceAfter=8*mm)
sSubtitle = ParagraphStyle("subtitle", fontName=ZH, fontSize=13, textColor=GRAY, alignment=TA_CENTER, spaceAfter=12*mm)
sH1 = ParagraphStyle("h1", fontName=ZH, fontSize=18, textColor=ACCENT, spaceBefore=10*mm, spaceAfter=5*mm)
sH2 = ParagraphStyle("h2", fontName=ZH, fontSize=14, textColor=WHITE, spaceBefore=6*mm, spaceAfter=3*mm)
sBody = ParagraphStyle("body", fontName=ZH, fontSize=11, textColor=TEXT, leading=18, spaceAfter=3*mm)
sBullet = ParagraphStyle("bullet", fontName=ZH, fontSize=11, textColor=TEXT, leading=18, leftIndent=12*mm, bulletIndent=5*mm, spaceAfter=2*mm)
sStep = ParagraphStyle("step", fontName=ZH, fontSize=11, textColor=TEXT, leading=18, leftIndent=12*mm, spaceAfter=2*mm)
sImportant = ParagraphStyle("important", fontName=ZH, fontSize=11, textColor=YELLOW, leading=18, spaceAfter=2*mm)
sFaq_q = ParagraphStyle("faq_q", fontName=ZH, fontSize=11, textColor=WHITE, spaceBefore=4*mm, spaceAfter=1*mm)
sFaq_a = ParagraphStyle("faq_a", fontName=ZH, fontSize=11, textColor=TEXT, leading=18, leftIndent=8*mm, spaceAfter=3*mm)
sVer = ParagraphStyle("ver", fontName=ZH, fontSize=10, textColor=GRAY, alignment=TA_CENTER, spaceAfter=4*mm)
sUrl = ParagraphStyle("url", fontName="Helvetica-Bold", fontSize=12, textColor=ACCENT, alignment=TA_CENTER)

def bg_canvas(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(DARK)
    canvas_obj.rect(0, 0, W, H, fill=1)
    canvas_obj.setStrokeColor(HexColor("#1e3a5f"))
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(20*mm, 15*mm, W-20*mm, 15*mm)
    canvas_obj.setFillColor(GRAY)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawCentredString(W/2, 10*mm, "Argencargo — www.argencargo.com.ar")
    canvas_obj.drawRightString(W-20*mm, 10*mm, f"{doc.page}")
    canvas_obj.restoreState()

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor("#1e3a5f"), spaceAfter=4*mm, spaceBefore=2*mm)

def B(t):
    """Bold wrapper for Chinese text."""
    return t  # STSong-Light doesn't have bold variant, use as-is

def build():
    doc = SimpleDocTemplate(
        "public/manual-agente-argencargo.pdf",
        pagesize=A4,
        topMargin=20*mm, bottomMargin=22*mm,
        leftMargin=20*mm, rightMargin=20*mm
    )
    story = []

    # ── COVER ──
    story.append(Spacer(1, 40*mm))
    story.append(Paragraph("代理门户操作手册", sTitle))
    story.append(Paragraph("ARGENCARGO", sBrand))
    story.append(Paragraph("从中国操作的完整指南", sSubtitle))
    story.append(Spacer(1, 20*mm))
    story.append(hr())
    story.append(Spacer(1, 10*mm))
    story.append(Paragraph("版本 2.0 — 2026年4月", sVer))
    story.append(Paragraph("www.argencargo.com.ar/agente", sUrl))
    story.append(PageBreak())

    # ── 1. ACCESS ──
    story.append(Paragraph("1. 登录门户", sH1))
    story.append(hr())
    for t in [
        "在浏览器中访问 www.argencargo.com.ar/agente（手机或电脑均可）。",
        "如果是第一次使用，点击「注册」，填写邮箱、姓名和密码。",
        "您的账户将由 Argencargo 管理员审核批准。",
        "批准后，使用邮箱和密码登录。",
        "您可以通过右上角的语言按钮切换西班牙语和中文。",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    # ── 2. TABS ──
    story.append(Paragraph("2. 门户选项卡", sH1))
    story.append(hr())
    story.append(Paragraph("门户有5个主要选项卡：", sBody))

    story.append(Paragraph("2.1 仓库（存放区）", sH2))
    for t in [
        "显示当前在您仓库中的所有包裹（未分配到航班的包裹）。",
        "可按操作代码、客户代码或物流单号搜索。",
        "顶部显示包裹总数和总重量（公斤）。",
        "「+ 注册包裹」按钮在所有选项卡中都可用。",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    story.append(Paragraph("2.2 活跃航班", sH2))
    for t in [
        "显示 Argencargo 为您创建的待发送航班。",
        "每个航班有两种状态：",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))
    story.append(Paragraph("   等待发票 — Argencargo 尚未提交发票，您还不能发送。", sStep))
    story.append(Paragraph("   可以发送 — 发票已提交，您可以填写信息并发送。", sStep))

    story.append(Paragraph("2.3 历史", sH2))
    for t in [
        "已发送或已到达布宜诺斯艾利斯的航班。",
        "随时查看以往的发货记录。",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    story.append(Paragraph("2.4 统计", sH2))
    for t in [
        "当前仓库中的包裹数量。",
        "历史总收到包裹数。",
        "已完成的航班数。",
        "总发货公斤数。",
        "总计费金额（美元）。",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    story.append(Paragraph("2.5 我的账户（往来账户）", sH2))
    for t in [
        "您与 Argencargo 的当前余额（预付款减去扣款）。",
        "完整的交易记录：预付款和航班扣款，包含日期和详情。",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    story.append(PageBreak())

    # ── 3. REGISTER PACKAGE ──
    story.append(Paragraph("3. 注册包裹", sH1))
    story.append(hr())
    story.append(Paragraph("按以下步骤注册新包裹：", sBody))

    steps = [
        ("1.", "点击「+ 注册包裹」（在任何选项卡中都可用）。"),
        ("2.", "从下拉菜单中选择客户。可按代码或姓名搜索。"),
        ("", "如果客户未注册，选择「未注册的客户」，Argencargo 稍后会分配。"),
        ("3.", "如果客户已有未完成的操作，包裹会自动添加到该操作中。否则，系统会创建新操作。"),
        ("4.", "输入包裹的物流单号。"),
        ("5.", "填写每个包裹的信息：重量（公斤）、长、宽、高（厘米）。"),
        ("", "可以通过「+ 添加另一个包裹」添加多个包裹。"),
        ("6.", "点击「保存包裹」。"),
        ("7.", "包裹将出现在「仓库」选项卡中。"),
    ]
    for num, text in steps:
        if num:
            story.append(Paragraph(f"{num} {text}", sStep))
        else:
            story.append(Paragraph(f"    → {text}", sStep))

    # ── 4. DISPATCH ──
    story.append(Paragraph("4. 发送航班", sH1))
    story.append(hr())
    story.append(Paragraph("当 Argencargo 为您创建航班并提交出口发票后：", sBody))

    story.append(Paragraph("1. 航班将出现在「活跃航班」中，状态为「可以发送」。", sStep))
    story.append(Paragraph("2. 打开航班，您将看到：", sStep))
    for t in [
        "包含的操作及其包裹和重量。",
        "出口发票（已提交）。",
        "布宜诺斯艾利斯的目的地地址。",
        "发票项目：描述、HS编码、数量和申报价值。",
    ]:
        story.append(Paragraph(f"      • {t}", sStep))

    story.append(Paragraph("3. 填写发送表格：", sStep))
    for t in [
        "总重量：根据包裹自动计算。",
        "总费用（美元）：您的运输成本。",
        "国际物流单号：快递的运单号。",
        "快递：选择 DHL、FedEx 或 UPS。",
        "付款方式：往来账户 / 现金 / 转账。",
    ]:
        story.append(Paragraph(f"      • {t}", sStep))

    story.append(Paragraph("4. 点击「确认发送」。", sStep))
    story.append(Paragraph("5. 航班移至「历史」，操作状态变为「运输中」。", sStep))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("重要 — 付款方式说明：", sImportant))
    for t in [
        "往来账户：从您的余额中自动扣除（已收到的预付款）。",
        "现金/转账：Argencargo 另行支付给您。",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    story.append(PageBreak())

    # ── 5. NOTIFICATIONS ──
    story.append(Paragraph("5. 通知", sH1))
    story.append(hr())
    story.append(Paragraph("右上角的铃铛图标显示您的通知。您会在以下情况收到通知：", sBody))
    for t in [
        "Argencargo 为您创建了航班。",
        "发票已准备好，您可以发送。",
        "航班已到达布宜诺斯艾利斯。",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))
    story.append(Paragraph("点击通知可直接跳转到航班详情。", sBody))

    # ── 6. FAQ ──
    story.append(Paragraph("6. 常见问题", sH1))
    story.append(hr())

    faqs = [
        ("如果我填错了包裹信息怎么办？",
         "请联系 Argencargo 管理员进行更正。"),
        ("没有提交发票可以发送吗？",
         "不可以。只有 Argencargo 提交出口发票后，发送表格才会启用。"),
        ("怎么知道航班到达布宜诺斯艾利斯了？",
         "您会收到通知，航班会在「历史」中显示为「已接收」。"),
        ("语言设置会保存吗？",
         "是的，您的语言偏好（西班牙语或中文）会自动保存。"),
        ("怎么查看往来账户的扣款记录？",
         "在「我的账户」选项卡中，可以看到所有交易记录，包括日期、金额和详情。"),
        ("如果看不到创建的航班怎么办？",
         "请查看铃铛通知。如果仍然没有，请联系管理员。"),
    ]
    for q, a in faqs:
        story.append(Paragraph(q, sFaq_q))
        story.append(Paragraph(f"→ {a}", sFaq_a))

    doc.build(story, onFirstPage=bg_canvas, onLaterPages=bg_canvas)
    print("PDF generado: public/manual-agente-argencargo.pdf")

if __name__ == "__main__":
    build()
