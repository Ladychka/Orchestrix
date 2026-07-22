"""Lightweight idempotent migration — adds Phase 0 columns if they don't exist yet."""

from sqlalchemy import text
from app.database import engine


def migrate():
    with engine.connect() as conn:
        # tasks.conversation_state
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'tasks' AND column_name = 'conversation_state'
                    ) THEN
                        ALTER TABLE tasks ADD COLUMN conversation_state JSONB;
                    END IF;
                END $$;
                """
            )
        )

        # tasks.resumed_at
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'tasks' AND column_name = 'resumed_at'
                    ) THEN
                        ALTER TABLE tasks ADD COLUMN resumed_at TIMESTAMP WITH TIME ZONE;
                    END IF;
                END $$;
                """
            )
        )

        # approvals.last_notified_at
        conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'approvals' AND column_name = 'last_notified_at'
                    ) THEN
                        ALTER TABLE approvals ADD COLUMN last_notified_at TIMESTAMP WITH TIME ZONE;
                    END IF;
                END $$;
                """
            )
        )

        conn.commit()
        print("[migrate] Schema is up to date.")


if __name__ == "__main__":
    migrate()
