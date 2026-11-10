"""Initial service schema."""
from alembic import op
import sqlalchemy as sa

revision = "0001_service"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("users", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("username", sa.String(80), unique=True, nullable=False),
                    sa.Column("name", sa.String(80), nullable=False),
                    sa.Column("role", sa.String(16), nullable=False),
                    sa.Column("password_hash", sa.String(256), nullable=False))
    op.create_table("sessions", sa.Column("digest", sa.String(64), primary_key=True),
                    sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
                    sa.Column("expires", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_expires", "sessions", ["expires"])
    op.create_table("tickets", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("title", sa.String(140), nullable=False),
                    sa.Column("description", sa.Text, nullable=False),
                    sa.Column("product", sa.String(100), nullable=False),
                    sa.Column("category", sa.String(32), nullable=False),
                    sa.Column("priority", sa.String(16), nullable=False),
                    sa.Column("status", sa.String(16), nullable=False),
                    sa.Column("creator_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
                    sa.Column("assignee_id", sa.Integer, sa.ForeignKey("users.id")),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("deleted", sa.Boolean, nullable=False),
                    sa.Column("version", sa.Integer, nullable=False))
    op.create_index("ix_tickets_creator_id", "tickets", ["creator_id"])
    op.create_index("ix_tickets_assignee_id", "tickets", ["assignee_id"])
    op.create_index("ix_queue", "tickets", ["deleted", "status", "updated_at"])
    op.create_table("events", sa.Column("id", sa.Integer, primary_key=True),
                    sa.Column("ticket_id", sa.Integer, sa.ForeignKey("tickets.id"), nullable=False),
                    sa.Column("actor_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
                    sa.Column("action", sa.String(20), nullable=False),
                    sa.Column("changes", sa.JSON, nullable=False),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_events_ticket_id", "events", ["ticket_id"])


def downgrade():
    for name in ["events", "tickets", "sessions", "users"]:
        op.drop_table(name)
