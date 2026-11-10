"""Initialize the demo once, atomically. Existing workspaces are left intact."""
import os
from datetime import timedelta

from sqlalchemy import select, text

from .db import Session
from .models import Event, Ticket, User, now
from .security import hash_password

SAMPLES = [
    ("會議室無線投影連線中斷", "ViewCast Pro", "network", "high", "working"),
    ("標籤機進紙時卡紙", "LabelPro 420", "hardware", "normal", "new"),
    ("更新後無法開啟管理介面", "EdgeBox S2", "software", "high", "waiting"),
    ("掃描文件出現黑色直線", "ScanMate 300", "hardware", "normal", "working"),
    ("手持終端充電異常", "MobileScan X1", "hardware", "high", "new"),
    ("網路交換器連接埠失效", "NetCore 24", "network", "high", "closed"),
    ("盤點程式無法同步", "MobileScan X1", "software", "normal", "working"),
    ("顯示器背光閃爍", "PanelView 27", "hardware", "low", "new"),
    ("列印佇列無回應", "PrintHub M2", "software", "normal", "closed"),
    ("讀卡機間歇性離線", "Access Mini", "network", "normal", "waiting"),
    ("底座固定扣鬆脫", "DockStation D4", "other", "low", "new"),
    ("備份排程失敗", "Vault NAS", "software", "normal", "closed"),
]


def main():
    with Session.begin() as db:
        if db.bind.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(7210231)"))
        if db.scalar(select(User.id).limit(1)):
            print("Workspace already initialized.")
            return
        password = os.getenv("DEMO_PASSWORD", "")
        if not 12 <= len(password) <= 256:
            raise SystemExit("Set DEMO_PASSWORD to a 12–256 character local demo password.")
        users = [User(username=role, role=role, name=name, password_hash=hash_password(password))
                 for role, name in [("employee", "林予安"), ("support", "陳品妤"), ("manager", "張承恩"), ("admin", "王子晴")]]
        db.add_all(users)
        db.flush()
        anchor = now()
        for i, (title, product, category, priority, status) in enumerate(SAMPLES):
            at = anchor - timedelta(hours=i * 6 + 2)
            ticket = Ticket(title=title, product=product, category=category, priority=priority,
                            description=f"{product} 使用時發現「{title}」，重新啟動後仍可重現，請協助檢修。",
                            status=status, creator=users[0], assignee=users[1] if status != "new" else None,
                            created_at=at, updated_at=at if status == "new" else at + timedelta(hours=1))
            db.add(ticket)
            db.flush()
            db.add(Event(ticket_id=ticket.id, actor=users[0], action="created", changes={}, created_at=at))
            if status != "new":
                db.add(Event(ticket_id=ticket.id, actor=users[1], action="updated",
                             changes={"status": ["new", status], "assignee": [None, users[1].name]},
                             created_at=ticket.updated_at))
    print("Created four demo accounts and twelve tickets.")


if __name__ == "__main__":
    main()
