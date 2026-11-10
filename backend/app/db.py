import os

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()


def connection_url():
    if url := os.getenv("DATABASE_URL"):
        return url
    return URL.create("postgresql+psycopg", username=os.getenv("POSTGRES_USER", "flowpilot"),
                      password=os.environ["POSTGRES_PASSWORD"], host=os.getenv("DB_HOST", "127.0.0.1"),
                      port=int(os.getenv("DB_PORT", "5432")), database=os.getenv("POSTGRES_DB", "flowpilot"))


class Base(DeclarativeBase):
    pass


engine = create_engine(connection_url(), pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)


def database():
    with Session() as session:
        yield session
