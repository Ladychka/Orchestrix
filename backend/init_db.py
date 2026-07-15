"""Initialize database tables and seed one AI Finance Officer."""

from app.database import engine, SessionLocal, Base
from app.models.ai_employee import AIEmployee


def init():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(AIEmployee).filter(AIEmployee.role == "finance_officer").first()
        if not existing:
            officer = AIEmployee(
                name="AI Finance Officer",
                role="finance_officer",
                permissions={"can_send_email": False, "requires_approval": True},
                connected_tools=["check_inventory", "calculate_quote", "draft_quotation_email", "request_approval"],
                knowledge_collection="finance_officer_knowledge",
            )
            db.add(officer)
            db.commit()
            print("Seeded AI Finance Officer.")
        else:
            print("AI Finance Officer already exists.")
    finally:
        db.close()
    print("Database initialized.")


if __name__ == "__main__":
    init()
