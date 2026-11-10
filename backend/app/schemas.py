from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Role = Literal["employee", "support", "manager", "admin"]
Status = Literal["new", "working", "waiting", "closed"]
Priority = Literal["low", "normal", "high"]
Category = Literal["hardware", "software", "network", "other"]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=140)]
Product = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=5000)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Login(Input):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=256)


class Person(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    role: Role


class TicketInput(Input):
    title: Title
    product: Product
    description: Description
    category: Category
    priority: Priority


class Update(Input):
    version: int = Field(ge=1)
    title: Title | None = None
    product: Product | None = None
    description: Description | None = None
    category: Category | None = None
    priority: Priority | None = None
    status: Status | None = None
    assignee_id: int | None = Field(default=None, ge=1)


class TicketView(TicketInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    version: int
    status: Status
    creator: Person
    assignee: Person | None
    created_at: datetime
    updated_at: datetime


class TicketPage(BaseModel):
    items: list[TicketView]
    total: int


class History(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    actor: Person
    action: str
    changes: dict
    created_at: datetime
