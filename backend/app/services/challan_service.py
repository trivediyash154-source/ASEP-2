"""
Challan (traffic fine) service.

Handles issuance, status updates, and PDF generation.
PDF includes: challan details table, QR code placeholder, and evidence photos
when available on disk.
"""

import uuid
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.constants import ChallanStatus, FINE_AMOUNTS
from app.core.logging import get_logger
from app.models.challan import Challan
from app.repositories.challan_repo import ChallanRepository
from app.schemas.challan import ChallanCreate, ChallanResponse, ChallanUpdateStatus

logger = get_logger(__name__)

# Fine multiplier for repeat offenders
REPEAT_OFFENDER_MULTIPLIER = 2.0
# Maximum days to pay before overdue interest applies
PAYMENT_GRACE_DAYS = 30


class ChallanService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ChallanRepository(db)

    async def issue_challan(
        self, data: ChallanCreate, issued_by_id: Optional[uuid.UUID] = None
    ) -> ChallanResponse:
        # Validate violation type
        if not data.violation_type:
            raise ValueError("violation_type is required")

        # Validate and normalise fine amount
        default_fine = FINE_AMOUNTS.get(data.violation_type, 2000)
        fine = data.fine_amount if data.fine_amount > 0 else default_fine

        challan_number = await self.repo.generate_challan_number()
        due_date = data.due_date or (date.today() + timedelta(days=PAYMENT_GRACE_DAYS))

        # Validate phone format if provided
        if data.owner_phone:
            phone = data.owner_phone.strip().replace(" ", "").replace("-", "")
            if not (phone.startswith("+91") or len(phone) == 10):
                logger.warning("challan_invalid_phone_format", phone=data.owner_phone)

        challan = Challan(
            challan_number=challan_number,
            detection_id=data.detection_id,
            issued_by_id=issued_by_id,
            plate_number=data.plate_number.upper().strip(),
            violation_type=data.violation_type,
            violation_description=data.violation_description,
            fine_amount=fine,
            status=ChallanStatus.ISSUED,
            issued_at=datetime.now(timezone.utc),
            due_date=due_date,
            location=data.location,
            owner_name=data.owner_name,
            owner_phone=data.owner_phone,
            owner_email=data.owner_email,
        )
        self.db.add(challan)
        await self.db.flush()
        await self.db.refresh(challan)

        logger.info(
            "challan_issued",
            challan_number=challan_number,
            plate=data.plate_number,
            violation=data.violation_type,
            fine=fine,
        )
        return ChallanResponse.model_validate(challan)

    async def update_status(
        self, challan_id: uuid.UUID, update: ChallanUpdateStatus
    ) -> ChallanResponse:
        challan = await self.repo.get(challan_id)
        if not challan:
            raise ValueError("Challan not found")

        challan.status = update.status

        if update.status == ChallanStatus.PAID:
            if not update.paid_amount or update.paid_amount <= 0:
                raise ValueError("paid_amount is required and must be positive for PAID status")
            challan.paid_at = datetime.now(timezone.utc)
            challan.paid_amount = update.paid_amount
            challan.payment_reference = update.payment_reference

        if update.notes:
            challan.notes = update.notes

        self.db.add(challan)
        await self.db.flush()
        await self.db.refresh(challan)

        logger.info(
            "challan_status_updated",
            challan_number=challan.challan_number,
            status=update.status,
        )
        return ChallanResponse.model_validate(challan)

    async def generate_pdf(self, challan_id: uuid.UUID) -> bytes:
        """
        Generates a professional PDF challan receipt using ReportLab.
        Includes evidence photos when they exist on disk.
        Raises ImportError clearly if reportlab is not installed.
        Raises ValueError if challan not found.
        """
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import mm
            from reportlab.platypus import (
                HRFlowable, Image, Paragraph, SimpleDocTemplate,
                Spacer, Table, TableStyle,
            )
        except ImportError:
            raise ImportError(
                "reportlab is required for PDF generation. Run: pip install reportlab"
            )

        challan = await self.repo.get(challan_id)
        if not challan:
            raise ValueError(f"Challan {challan_id} not found")

        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
            leftMargin=20 * mm,
            rightMargin=20 * mm,
        )
        styles = getSampleStyleSheet()
        story = []

        # ── Header ────────────────────────────────────────────────
        header_style = ParagraphStyle(
            "EnforcementHeader",
            parent=styles["Title"],
            fontSize=20,
            textColor=colors.HexColor("#1a237e"),
            spaceAfter=2 * mm,
        )
        sub_style = ParagraphStyle(
            "Sub",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#546e7a"),
        )

        story.append(Paragraph("GOVERNMENT OF INDIA", sub_style))
        story.append(Paragraph("AI Traffic Enforcement System", header_style))
        story.append(Paragraph("Motor Vehicles Act, 1988 — Section 177 / 178", sub_style))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1a237e")))
        story.append(Spacer(1, 5 * mm))

        # Challan status banner
        status_color = {
            ChallanStatus.ISSUED: colors.HexColor("#e65100"),
            ChallanStatus.PAID: colors.HexColor("#2e7d32"),
            ChallanStatus.OVERDUE: colors.HexColor("#b71c1c"),
            ChallanStatus.DISPUTED: colors.HexColor("#f57f17"),
            ChallanStatus.CANCELLED: colors.HexColor("#546e7a"),
        }.get(challan.status, colors.grey)

        banner_style = ParagraphStyle(
            "Banner",
            parent=styles["Normal"],
            fontSize=11,
            textColor=colors.white,
            backColor=status_color,
            borderPadding=(4, 8, 4, 8),
            alignment=1,
        )
        story.append(Paragraph(f"CHALLAN STATUS: {challan.status.upper()}", banner_style))
        story.append(Spacer(1, 5 * mm))

        # ── Challan details table ─────────────────────────────────
        label_style = ParagraphStyle("Label", parent=styles["Normal"], fontSize=9, textColor=colors.HexColor("#37474f"), fontName="Helvetica-Bold")
        value_style = ParagraphStyle("Value", parent=styles["Normal"], fontSize=9)
        fine_style = ParagraphStyle("Fine", parent=styles["Normal"], fontSize=16, textColor=colors.HexColor("#b71c1c"), fontName="Helvetica-Bold", alignment=1)

        table_data = [
            [Paragraph("Field", label_style), Paragraph("Details", label_style)],
            [Paragraph("Challan Number", label_style), Paragraph(challan.challan_number, value_style)],
            [Paragraph("Vehicle Plate", label_style), Paragraph(f"<b>{challan.plate_number}</b>", value_style)],
            [Paragraph("Violation", label_style), Paragraph(challan.violation_type.replace("_", " ").title(), value_style)],
            [Paragraph("Description", label_style), Paragraph(challan.violation_description or "—", value_style)],
            [Paragraph("Location", label_style), Paragraph(challan.location or "—", value_style)],
            [Paragraph("Issued At", label_style), Paragraph(challan.issued_at.strftime("%d %b %Y, %H:%M:%S IST"), value_style)],
            [Paragraph("Due Date", label_style), Paragraph(str(challan.due_date) if challan.due_date else "—", value_style)],
        ]

        if challan.paid_at:
            table_data.append([Paragraph("Paid At", label_style), Paragraph(challan.paid_at.strftime("%d %b %Y, %H:%M"), value_style)])
        if challan.payment_reference:
            table_data.append([Paragraph("Payment Ref.", label_style), Paragraph(challan.payment_reference, value_style)])

        table = Table(table_data, colWidths=[55 * mm, 120 * mm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a237e")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#e8eaf6")),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b0bec5")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafafa")]),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(table)
        story.append(Spacer(1, 5 * mm))

        # Fine amount box
        story.append(Paragraph(f"FINE AMOUNT: ₹{challan.fine_amount:,.2f}", fine_style))
        story.append(Spacer(1, 5 * mm))

        # ── Owner details ─────────────────────────────────────────
        if challan.owner_name or challan.owner_phone:
            owner_data = [
                [Paragraph("Owner Details", label_style), Paragraph("", label_style)],
                [Paragraph("Name", label_style), Paragraph(challan.owner_name or "—", value_style)],
                [Paragraph("Phone", label_style), Paragraph(challan.owner_phone or "—", value_style)],
                [Paragraph("Email", label_style), Paragraph(challan.owner_email or "—", value_style)],
            ]
            owner_table = Table(owner_data, colWidths=[55 * mm, 120 * mm])
            owner_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#263238")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("SPAN", (0, 0), (-1, 0)),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b0bec5")),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#eceff1")),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]))
            story.append(owner_table)
            story.append(Spacer(1, 5 * mm))

        # ── Evidence photos ───────────────────────────────────────
        if challan.evidence_paths:
            evidence_images = []
            for key, rel_path in challan.evidence_paths.items():
                abs_path = Path(settings.UPLOAD_DIR) / rel_path
                if abs_path.exists():
                    try:
                        img = Image(str(abs_path), width=85 * mm, height=55 * mm)
                        evidence_images.append([img, Paragraph(key.title(), sub_style)])
                    except Exception as e:
                        logger.warning("pdf_evidence_image_failed", path=str(abs_path), error=str(e))

            if evidence_images:
                story.append(Paragraph("Evidence Photographs", header_style))
                story.append(Spacer(1, 2 * mm))
                # Two-column layout for evidence
                if len(evidence_images) >= 2:
                    ev_table = Table(
                        [[evidence_images[0][0], evidence_images[1][0]],
                         [evidence_images[0][1], evidence_images[1][1]]],
                        colWidths=[90 * mm, 90 * mm],
                    )
                else:
                    ev_table = Table(
                        [[evidence_images[0][0]], [evidence_images[0][1]]],
                        colWidths=[90 * mm],
                    )
                ev_table.setStyle(TableStyle([
                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b0bec5")),
                    ("PADDING", (0, 0), (-1, -1), 4),
                ]))
                story.append(ev_table)
                story.append(Spacer(1, 5 * mm))

        # ── Footer ────────────────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#90a4ae")))
        story.append(Spacer(1, 2 * mm))
        footer_text = (
            "This is a computer-generated document. No physical signature is required. "
            "Failure to pay within the due date will attract additional penalties under the MV Act. "
            "For disputes, contact the nearest RTO office."
        )
        story.append(Paragraph(footer_text, ParagraphStyle(
            "Footer", parent=styles["Normal"], fontSize=7, textColor=colors.HexColor("#90a4ae")
        )))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        logger.info("challan_pdf_generated", challan_number=challan.challan_number, size_kb=len(pdf_bytes) // 1024)
        return pdf_bytes
