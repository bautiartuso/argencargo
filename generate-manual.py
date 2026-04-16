#!/usr/bin/env python3
"""Genera el Manual del Portal Agente de Argencargo en PDF."""

from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)

W, H = A4
DARK = HexColor("#0f1b30")
ACCENT = HexColor("#4A90D9")
GREEN = HexColor("#22c55e")
YELLOW = HexColor("#fbbf24")
WHITE = HexColor("#ffffff")
GRAY = HexColor("#94a3b8")
LIGHT_BG = HexColor("#1a2d4a")

# Styles
sTitle = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=26, textColor=WHITE, alignment=TA_CENTER, spaceAfter=4*mm)
sSubtitle = ParagraphStyle("subtitle", fontName="Helvetica", fontSize=13, textColor=GRAY, alignment=TA_CENTER, spaceAfter=12*mm)
sH1 = ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=18, textColor=ACCENT, spaceBefore=10*mm, spaceAfter=5*mm)
sH2 = ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=14, textColor=WHITE, spaceBefore=6*mm, spaceAfter=3*mm)
sBody = ParagraphStyle("body", fontName="Helvetica", fontSize=11, textColor=HexColor("#cbd5e1"), leading=16, spaceAfter=3*mm)
sBullet = ParagraphStyle("bullet", fontName="Helvetica", fontSize=11, textColor=HexColor("#cbd5e1"), leading=16, leftIndent=12*mm, bulletIndent=5*mm, spaceAfter=2*mm)
sStep = ParagraphStyle("step", fontName="Helvetica", fontSize=11, textColor=HexColor("#cbd5e1"), leading=16, leftIndent=12*mm, spaceAfter=2*mm)
sImportant = ParagraphStyle("important", fontName="Helvetica-Bold", fontSize=11, textColor=YELLOW, leading=16, spaceAfter=2*mm)
sFaq_q = ParagraphStyle("faq_q", fontName="Helvetica-Bold", fontSize=11, textColor=WHITE, spaceBefore=4*mm, spaceAfter=1*mm)
sFaq_a = ParagraphStyle("faq_a", fontName="Helvetica", fontSize=11, textColor=HexColor("#cbd5e1"), leading=16, leftIndent=8*mm, spaceAfter=3*mm)
sFooter = ParagraphStyle("footer", fontName="Helvetica", fontSize=9, textColor=GRAY, alignment=TA_CENTER)

def bg_canvas(canvas_obj, doc):
    canvas_obj.saveState()
    canvas_obj.setFillColor(DARK)
    canvas_obj.rect(0, 0, W, H, fill=1)
    # Footer line
    canvas_obj.setStrokeColor(HexColor("#1e3a5f"))
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(20*mm, 15*mm, W-20*mm, 15*mm)
    # Footer text
    canvas_obj.setFillColor(GRAY)
    canvas_obj.setFont("Helvetica", 8)
    canvas_obj.drawCentredString(W/2, 10*mm, "Argencargo — www.argencargo.com.ar — Soporte: info@argencargo.com.ar")
    # Page number
    canvas_obj.drawRightString(W-20*mm, 10*mm, f"Página {doc.page}")
    canvas_obj.restoreState()

def hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor("#1e3a5f"), spaceAfter=4*mm, spaceBefore=2*mm)

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
    story.append(Paragraph("Manual del Portal Agente", sTitle))
    story.append(Paragraph("ARGENCARGO", ParagraphStyle("brand", fontName="Helvetica-Bold", fontSize=36, textColor=ACCENT, alignment=TA_CENTER, spaceAfter=8*mm)))
    story.append(Paragraph("Guía completa para operar desde China", sSubtitle))
    story.append(Spacer(1, 20*mm))
    story.append(hr())
    story.append(Spacer(1, 10*mm))

    # Version info
    story.append(Paragraph("Versión 2.0 — Abril 2026", ParagraphStyle("ver", fontName="Helvetica", fontSize=10, textColor=GRAY, alignment=TA_CENTER, spaceAfter=4*mm)))
    story.append(Paragraph("Portal: www.argencargo.com.ar/agente", ParagraphStyle("url", fontName="Helvetica-Bold", fontSize=12, textColor=ACCENT, alignment=TA_CENTER)))

    story.append(PageBreak())

    # ── SECCIÓN 1 ──
    story.append(Paragraph("1. Acceso al Portal", sH1))
    story.append(hr())
    for t in [
        "Ingresá a <b>www.argencargo.com.ar/agente</b> desde cualquier navegador (celular o computadora).",
        "Si es tu primera vez, tocá <b>\"Registrarse\"</b> y completá tu email, nombre y contraseña.",
        "Tu cuenta será revisada y aprobada por el administrador de Argencargo.",
        "Una vez aprobada, iniciá sesión con tu email y contraseña.",
        "Podés cambiar el idioma entre <b>Español</b> y <b>Chino</b> con el botón de idioma arriba a la derecha.",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    # ── SECCIÓN 2 ──
    story.append(Paragraph("2. Pestañas del Portal", sH1))
    story.append(hr())
    story.append(Paragraph("El portal tiene 5 pestañas principales:", sBody))

    # 2.1
    story.append(Paragraph("2.1 Depósito", sH2))
    for t in [
        "Muestra todos los paquetes que están <b>actualmente en tu depósito</b> (no asignados a un vuelo).",
        "Buscá paquetes por código de operación, código de cliente o tracking.",
        "Arriba ves el <b>total de paquetes</b> y el <b>peso total en kg</b>.",
        "El botón <b>\"+ Registrar paquete\"</b> está disponible desde cualquier pestaña.",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    # 2.2
    story.append(Paragraph("2.2 Vuelos Activos", sH2))
    for t in [
        "Muestra los vuelos que Argencargo creó para vos y están pendientes de despacho.",
        "Cada vuelo puede estar en dos estados:",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))
    story.append(Paragraph("   ⏳ <b>Esperando factura</b> — Argencargo todavía no presentó la factura. No podés despachar.", sStep))
    story.append(Paragraph("   🚀 <b>Listo para enviar</b> — La factura fue presentada. Ya podés completar los datos y despachar.", sStep))

    # 2.3
    story.append(Paragraph("2.3 Histórico", sH2))
    for t in [
        "Vuelos ya <b>despachados</b> (en camino) o <b>recibidos</b> en Buenos Aires.",
        "Consultá datos de envíos anteriores en cualquier momento.",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    # 2.4
    story.append(Paragraph("2.4 Estadísticas", sH2))
    for t in [
        "Paquetes actualmente en depósito.",
        "Total de paquetes recibidos (histórico completo).",
        "Vuelos completados.",
        "Kilogramos totales despachados.",
        "Monto total facturado en USD.",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    # 2.5
    story.append(Paragraph("2.5 Cuenta Corriente", sH2))
    for t in [
        "Tu <b>saldo actual</b> con Argencargo (anticipos recibidos menos deducciones por vuelos).",
        "Historial completo de movimientos: anticipos y deducciones con fecha y detalle.",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    story.append(PageBreak())

    # ── SECCIÓN 3 ──
    story.append(Paragraph("3. Registrar un Paquete", sH1))
    story.append(hr())
    story.append(Paragraph("Seguí estos pasos para registrar un paquete nuevo:", sBody))

    steps = [
        ("1.", "Tocá <b>\"+ Registrar paquete\"</b> (disponible desde cualquier pestaña)."),
        ("2.", "Seleccioná el <b>cliente</b> del menú desplegable. Podés buscar por código o nombre."),
        ("", "Si el cliente no está registrado, elegí <b>\"Cliente no registrado\"</b> y Argencargo lo asignará después."),
        ("3.", "Si el cliente ya tiene una operación abierta, el paquete se agrega ahí automáticamente. Si no, se crea una operación nueva."),
        ("4.", "Ingresá el <b>tracking</b> del paquete (número de seguimiento)."),
        ("5.", "Completá los datos de cada bulto: <b>peso</b> (kg), <b>largo</b>, <b>ancho</b>, <b>alto</b> (cm)."),
        ("", "Podés agregar múltiples bultos con <b>\"+ Agregar otro bulto\"</b>."),
        ("6.", "Tocá <b>\"Guardar bulto\"</b>."),
        ("7.", "El paquete aparecerá en la pestaña <b>Depósito</b>."),
    ]
    for num, text in steps:
        if num:
            story.append(Paragraph(f"<b>{num}</b> {text}", sStep))
        else:
            story.append(Paragraph(f"    ↳ {text}", sStep))

    # ── SECCIÓN 4 ──
    story.append(Paragraph("4. Despachar un Vuelo", sH1))
    story.append(hr())
    story.append(Paragraph("Cuando Argencargo cree un vuelo para vos y presente la factura de exportación:", sBody))

    steps2 = [
        ("1.", "El vuelo aparecerá en <b>\"Vuelos activos\"</b> con el estado 🚀 <b>LISTO PARA ENVIAR</b>."),
        ("2.", "Abrí el vuelo. Vas a ver:"),
    ]
    for num, text in steps2:
        story.append(Paragraph(f"<b>{num}</b> {text}", sStep))

    for t in [
        "Las operaciones incluidas con sus bultos y peso.",
        "La factura de exportación (✅ Factura presentada).",
        "La dirección de destino en Buenos Aires.",
        "Los items de la factura con descripción, HS code, cantidad y valor declarado.",
    ]:
        story.append(Paragraph(f"      • {t}", sStep))

    story.append(Paragraph("<b>3.</b> Completá el formulario de despacho:", sStep))
    for t in [
        "<b>Peso total</b>: se calcula automáticamente desde los bultos.",
        "<b>Costo total (USD)</b>: lo que te costó el envío.",
        "<b>Tracking internacional</b>: el número de guía del courier.",
        "<b>Courier</b>: seleccioná DHL, FedEx o UPS.",
        "<b>Método de pago</b>: Cuenta corriente / Contado / Transferencia.",
    ]:
        story.append(Paragraph(f"      • {t}", sStep))

    story.append(Paragraph("<b>4.</b> Tocá <b>\"Confirmar despacho\"</b>.", sStep))
    story.append(Paragraph("<b>5.</b> El vuelo pasa a <b>Histórico</b> y las operaciones cambian a <b>\"En tránsito\"</b>.", sStep))

    story.append(Spacer(1, 6*mm))
    story.append(Paragraph("IMPORTANTE — Métodos de pago:", sImportant))
    for t in [
        "<b>Cuenta corriente</b>: se descuenta automáticamente de tu saldo (anticipos que ya recibiste).",
        "<b>Contado / Transferencia</b>: Argencargo te paga por separado.",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))

    story.append(PageBreak())

    # ── SECCIÓN 5 ──
    story.append(Paragraph("5. Notificaciones", sH1))
    story.append(hr())
    story.append(Paragraph("La campanita arriba a la derecha muestra tus notificaciones. Recibís una notificación cuando:", sBody))
    for t in [
        "Argencargo <b>crea un vuelo</b> para vos.",
        "La <b>factura está lista</b> y podés despachar.",
        "El vuelo fue <b>recibido en Buenos Aires</b>.",
    ]:
        story.append(Paragraph(f"• {t}", sBullet))
    story.append(Paragraph("Tocá una notificación para ir directamente al detalle del vuelo.", sBody))

    # ── SECCIÓN 6 ──
    story.append(Paragraph("6. Preguntas Frecuentes", sH1))
    story.append(hr())

    faqs = [
        ("¿Qué pasa si me equivoqué al cargar un paquete?",
         "Contactá al administrador de Argencargo para corregirlo."),
        ("¿Puedo despachar sin que la factura esté presentada?",
         "No. El formulario de despacho se habilita recién cuando Argencargo presenta la factura de exportación."),
        ("¿Cómo sé si el vuelo llegó a Buenos Aires?",
         "Te llega una notificación y el vuelo aparece en Histórico con el estado \"Recibido\"."),
        ("¿El idioma se guarda?",
         "Sí, tu preferencia de idioma (Español o Chino) se guarda automáticamente."),
        ("¿Puedo ver cuánto me descontaron de la cuenta corriente?",
         "Sí, en la pestaña \"Cuenta corriente\" ves todos los movimientos con fecha, monto y detalle."),
        ("¿Qué hago si no veo un vuelo que me crearon?",
         "Revisá la campanita de notificaciones. Si no aparece, contactá al administrador."),
    ]
    for q, a in faqs:
        story.append(Paragraph(q, sFaq_q))
        story.append(Paragraph(f"→ {a}", sFaq_a))

    doc.build(story, onFirstPage=bg_canvas, onLaterPages=bg_canvas)
    print("✅ PDF generado: public/manual-agente-argencargo.pdf")

if __name__ == "__main__":
    build()
