"""Initialize the database.

Usage:
    python create_db.py

Set `DATABASE_URL` environment variable to override the default SQLite file.
Example: `sqlite:///./db.sqlite3` or a Postgres URL.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import OperationalError
from models import Base


def get_database_url():
    return os.environ.get("DATABASE_URL", "sqlite:///./db.sqlite3")


def main():
    db_url = get_database_url()
    print(f"Using database: {db_url}")
    try:
        engine = create_engine(db_url, echo=False, future=True)
        Base.metadata.create_all(engine)
        print("Database initialized and tables created.")
    except OperationalError as e:
        print("Failed to initialize database:", e)


if __name__ == "__main__":
    main()
