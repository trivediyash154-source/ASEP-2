"""add system settings table

Revision ID: b3c9d2e1f4a5
Revises: af6ff1e015df
Create Date: 2026-05-24 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3c9d2e1f4a5'
down_revision: Union[str, None] = 'af6ff1e015df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(length=100), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=True),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('updated_by', sa.String(length=255), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_system_settings_key'), 'system_settings', ['key'], unique=True)

    # Seed default settings
    op.execute("""
        INSERT INTO system_settings (id, key, value, description, category, created_at, updated_at)
        VALUES
          (gen_random_uuid(), 'yolo_confidence', '0.60', 'YOLO vehicle detection confidence threshold (0.1–0.99)', 'pipeline', now(), now()),
          (gen_random_uuid(), 'plate_confidence', '0.55', 'Plate detection confidence threshold (0.1–0.99)', 'pipeline', now(), now()),
          (gen_random_uuid(), 'ocr_confidence', '0.70', 'OCR recognition confidence threshold (0.1–0.99)', 'pipeline', now(), now()),
          (gen_random_uuid(), 'frame_skip', '2', 'Process every Nth frame (1 = every frame, 5 = every 5th)', 'pipeline', now(), now()),
          (gen_random_uuid(), 'evidence_retention_days', '90', 'Days to keep evidence images on disk', 'storage', now(), now()),
          (gen_random_uuid(), 'violation_cooldown_s', '60', 'Minimum seconds between challans for same plate', 'enforcement', now(), now()),
          (gen_random_uuid(), 'notify_sms', 'true', 'Send SMS notifications for new challans', 'notifications', now(), now()),
          (gen_random_uuid(), 'notify_email', 'true', 'Send email notifications for new challans', 'notifications', now(), now()),
          (gen_random_uuid(), 'max_fps', '15', 'Maximum frames per second to process from stream', 'pipeline', now(), now()),
          (gen_random_uuid(), 'stream_reconnect_delay_s', '5', 'Seconds to wait before stream reconnect attempt', 'pipeline', now(), now())
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_system_settings_key'), table_name='system_settings')
    op.drop_table('system_settings')
