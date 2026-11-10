import os
import secrets

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

# Prevent importing app.db from connecting to the developer's database.
os.environ.setdefault("DATABASE_URL", "sqlite://")
from app.db import Base, database
from app.main import app
from app.models import User
from app.security import hash_password


@pytest.fixture
def workspace():
    url = os.environ.get("FLOWPILOT_TEST_URL", "sqlite://")
    sqlite = url.startswith("sqlite")
    options = {"poolclass": StaticPool, "connect_args": {"check_same_thread": False}} if sqlite else {}
    engine = create_engine(url, **options)
    password = secrets.token_urlsafe(18)
    with engine.connect() as connection:
        transaction = connection.begin()
        if not sqlite:
            schema = "test_" + secrets.token_hex(12)
            connection.execute(text(f"CREATE SCHEMA {schema}"))
            connection.execute(text(f"SET LOCAL search_path TO {schema}"))
        Base.metadata.create_all(connection)
        with Session(connection, join_transaction_mode="create_savepoint") as db:
            encoded = hash_password(password)
            for name in ["employee", "second", "support", "manager", "admin"]:
                db.add(User(username=name, name=name, role="employee" if name=="second" else name, password_hash=encoded))
            db.commit()

        def override():
            with Session(connection, expire_on_commit=False, join_transaction_mode="create_savepoint") as db:
                yield db

        app.dependency_overrides[database] = override
        try:
            with TestClient(app, headers={"X-FlowPilot": "web"}) as client:
                yield client, password
        finally:
            app.dependency_overrides.clear()
            transaction.rollback()
    engine.dispose()
