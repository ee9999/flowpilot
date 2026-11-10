import logging
import os
import secrets
import time
from datetime import timedelta

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from .db import database
from .models import Event, LoginSession, Ticket, User, now
from .schemas import Category, History, Login, Person, Priority, Status, TicketInput, TicketPage, TicketView, Update
from .security import digest, hash_password, verify_password

app = FastAPI(title="FlowPilot 售後服務 API", version="1.0", docs_url="/api/docs",
              openapi_url="/api/openapi.json", redoc_url=None)
log = logging.getLogger("uvicorn.error")
dummy_hash = hash_password(secrets.token_urlsafe())
cookie = "flowpilot_session"


def require_web_header(x_flowpilot: str = Header(default="")):
    if x_flowpilot != "web":
        raise HTTPException(403, "缺少安全請求標頭 X-FlowPilot: web")


@app.middleware("http")
async def request_log(request: Request, call_next):
    start = time.monotonic()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("Request failed %s %s", request.method, request.url.path)
        return JSONResponse({"detail": "伺服器錯誤，請稍後再試"}, status_code=500)
    log.info("%s %s %s %.0fms", request.method, request.url.path, response.status_code,
             1000 * (time.monotonic() - start))
    response.headers["Cache-Control"] = "no-store"
    return response


@app.get("/api/health")
def health(db: Session = Depends(database)):
    db.execute(select(1))
    return {"status": "ok"}


def current(request: Request, db: Session = Depends(database)):
    user = db.scalar(select(User).join(LoginSession).where(
        LoginSession.digest == digest(request.cookies.get(cookie, "")), LoginSession.expires > now()))
    if not user:
        raise HTTPException(401, "請先登入")
    return user


@app.post("/api/login", response_model=Person, dependencies=[Depends(require_web_header)])
def login(data: Login, request: Request, response: Response, db: Session = Depends(database)):
    user = db.scalar(select(User).where(User.username == data.username))
    if not verify_password(data.password, user.password_hash if user else dummy_hash) or not user:
        raise HTTPException(401, "帳號或密碼不正確")
    token = secrets.token_urlsafe(32)
    db.execute(delete(LoginSession).where(or_(LoginSession.expires <= now(),
               LoginSession.digest == digest(request.cookies.get(cookie, "")))))
    db.add(LoginSession(digest=digest(token), user_id=user.id, expires=now() + timedelta(hours=8)))
    db.commit()
    response.set_cookie(cookie, token, httponly=True, samesite="strict", max_age=28800,
                        secure=os.getenv("COOKIE_SECURE", "false").lower() == "true")
    return user


@app.post("/api/logout", dependencies=[Depends(require_web_header)])
def logout(request: Request, response: Response, db: Session = Depends(database)):
    db.execute(delete(LoginSession).where(LoginSession.digest == digest(request.cookies.get(cookie, ""))))
    db.commit()
    response.delete_cookie(cookie)
    return {"ok": True}


@app.get("/api/me", response_model=Person)
def profile(user: User = Depends(current)):
    return user


def staff(user: User = Depends(current)):
    if user.role == "employee":
        raise HTTPException(403, "需要客服以上權限")
    return user


@app.get("/api/assignees", response_model=list[Person])
def assignees(user: User = Depends(staff), db: Session = Depends(database)):
    return db.scalars(select(User).where(User.role != "employee").order_by(User.id)).all()


def visible(user):
    conditions = [Ticket.deleted.is_(False)]
    if user.role == "employee":
        conditions.append(Ticket.creator_id == user.id)
    return conditions


def get_ticket(db, user, ticket_id, lock=False):
    query = select(Ticket).where(Ticket.id == ticket_id, *visible(user))
    if lock:
        query = query.with_for_update(of=Ticket)
    ticket = db.scalar(query)
    if not ticket:
        raise HTTPException(404, "找不到工單")
    return ticket


def audit(db, ticket, user, action, changes):
    db.add(Event(ticket_id=ticket.id, actor_id=user.id, action=action, changes=changes))


@app.get("/api/tickets", response_model=TicketPage)
def tickets(q: str = Query("", max_length=140), status: Status | None = None,
            priority: Priority | None = None, category: Category | None = None,
            page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=100),
            user: User = Depends(current), db: Session = Depends(database)):
    filters = visible(user)
    if term := q.strip():
        matches = [col.icontains(term, autoescape=True) for col in (Ticket.title, Ticket.product)]
        number = term.upper().removeprefix("FP-")
        if number.isascii() and number.isdigit() and len(number) <= 9:
            matches.append(Ticket.id == int(number))
        filters.append(or_(*matches))
    for column, value in [(Ticket.status, status), (Ticket.priority, priority), (Ticket.category, category)]:
        if value:
            filters.append(column == value)
    count = db.scalar(select(func.count()).select_from(Ticket).where(*filters))
    rows = db.scalars(select(Ticket).where(*filters).order_by(Ticket.updated_at.desc(), Ticket.id.desc())
                      .offset((page - 1) * size).limit(size)).all()
    return {"items": rows, "total": count}


@app.post("/api/tickets", response_model=TicketView, status_code=201, dependencies=[Depends(require_web_header)])
def create(data: TicketInput, user: User = Depends(current), db: Session = Depends(database)):
    ticket = Ticket(**data.model_dump(), creator=user)
    db.add(ticket)
    db.flush()
    audit(db, ticket, user, "created", {})
    db.commit()
    return ticket


@app.get("/api/tickets/{ticket_id}", response_model=TicketView)
def detail(ticket_id: int, user: User = Depends(current), db: Session = Depends(database)):
    return get_ticket(db, user, ticket_id)


@app.get("/api/tickets/{ticket_id}/history", response_model=list[History])
def history(ticket_id: int, user: User = Depends(current), db: Session = Depends(database)):
    get_ticket(db, user, ticket_id)
    return db.scalars(select(Event).where(Event.ticket_id == ticket_id).order_by(Event.id.desc())).all()


def check_version(ticket, version):
    if ticket.version != version:
        raise HTTPException(409, "工單已被更新，請重新載入後再試")


@app.patch("/api/tickets/{ticket_id}", response_model=TicketView, dependencies=[Depends(require_web_header)])
def update(ticket_id: int, data: Update, user: User = Depends(current), db: Session = Depends(database)):
    ticket = get_ticket(db, user, ticket_id, lock=True)
    fields = data.model_dump(exclude_unset=True, exclude={"version"})
    if user.role == "employee" and (ticket.status != "new" or {"assignee_id", "status"} & fields.keys()):
        raise HTTPException(403, "員工僅可修改待處理工單內容")
    check_version(ticket, data.version)
    changes = {}
    for key, value in fields.items():
        if key == "assignee_id":
            person = db.get(User, value) if value else None
            if value and (not person or person.role == "employee"):
                raise HTTPException(422, "請選擇有效的負責人")
            if value != ticket.assignee_id:
                changes["assignee"] = [ticket.assignee.name if ticket.assignee else None, person.name if person else None]
                ticket.assignee = person
        elif value is None:
            raise HTTPException(422, "欄位不可為空值")
        elif value != getattr(ticket, key):
            changes[key] = [getattr(ticket, key), value]
            setattr(ticket, key, value)
    if changes:
        ticket.updated_at = now()
        ticket.version += 1
        audit(db, ticket, user, "updated", changes)
    db.commit()
    return ticket


@app.delete("/api/tickets/{ticket_id}", status_code=204, dependencies=[Depends(require_web_header)])
def remove(ticket_id: int, version: int = Query(ge=1), user: User = Depends(current), db: Session = Depends(database)):
    if user.role != "admin":
        raise HTTPException(403, "僅管理員可刪除工單")
    ticket = get_ticket(db, user, ticket_id, lock=True)
    check_version(ticket, version)
    ticket.deleted = True
    ticket.version += 1
    audit(db, ticket, user, "deleted", {})
    db.commit()


@app.get("/api/dashboard")
def dashboard(user: User = Depends(current), db: Session = Depends(database)):
    filters = visible(user)
    counts = dict(db.execute(select(Ticket.status, func.count()).where(*filters).group_by(Ticket.status)).all())
    recent = db.scalars(select(Ticket).where(*filters).order_by(Ticket.updated_at.desc(), Ticket.id.desc()).limit(5)).all()
    return {"counts": counts, "total": sum(counts.values()),
            "recent": [TicketView.model_validate(t) for t in recent]}

