"""add_user_metadata_jsonb

Revision ID: e5a9b3c7d1f4
Revises: d4f8a2b6c9e3
Create Date: 2026-03-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'e5a9b3c7d1f4'
down_revision: Union[str, Sequence[str], None] = 'd4f8a2b6c9e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add metadata JSONB column to users table for drip email tracking."""
    op.add_column('users', sa.Column('metadata', JSONB, nullable=True))


def downgrade() -> None:
    """Remove metadata column from users table."""
    op.drop_column('users', 'metadata')
