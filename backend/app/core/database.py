from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from typing import Generator
import os

from app.core.config import get_settings

settings = get_settings()

# Ensure data directory exists
db_path = settings.database_url.replace("sqlite:///", "")
os.makedirs(os.path.dirname(db_path), exist_ok=True)

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=settings.debug,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and foreign keys for SQLite."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Dependency to get a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from app.models.base import Base
    # Import all models to register them
    import app.models.document  # noqa
    import app.models.conversation  # noqa
    import app.models.memory  # noqa
    Base.metadata.create_all(bind=engine)
