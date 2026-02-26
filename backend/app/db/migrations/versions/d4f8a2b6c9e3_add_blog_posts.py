"""add_blog_posts

Revision ID: d4f8a2b6c9e3
Revises: c7a2d4e6f8b1
Create Date: 2026-02-22 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = 'd4f8a2b6c9e3'
down_revision: Union[str, Sequence[str], None] = 'c7a2d4e6f8b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'blog_posts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('company_id', UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('signal_id', UUID(as_uuid=True), sa.ForeignKey('signals.id', ondelete='SET NULL'), nullable=False),
        sa.Column('slug', sa.String(100)),
        sa.Column('title', sa.String(200)),
        sa.Column('status', sa.String(20), nullable=False, server_default='queued'),
        sa.Column('error_message', sa.Text),
        sa.Column('published_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )
    op.create_index('uq_blog_posts_company', 'blog_posts', ['company_id'], unique=True)
    op.create_index('ix_blog_posts_status', 'blog_posts', ['status'])


def downgrade() -> None:
    op.drop_index('ix_blog_posts_status', table_name='blog_posts')
    op.drop_index('uq_blog_posts_company', table_name='blog_posts')
    op.drop_table('blog_posts')
