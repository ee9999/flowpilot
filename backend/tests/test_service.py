import secrets

from app.security import hash_password, verify_password

FORM = dict(title="螢幕無訊號", product="Panel 27", description="更換訊號線後問題仍存在", category="hardware", priority="high")


def login(client, password, username):
    response = client.post("/api/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()


def test_password_salt():
    password = secrets.token_urlsafe()
    first = hash_password(password)
    assert first != hash_password(password)
    assert verify_password(password, first)
    assert not verify_password(password + "x", first)


def test_session(workspace):
    client, password = workspace
    assert client.get("/api/dashboard").status_code == 401
    assert client.post("/api/login", json={"username":"admin","password":secrets.token_urlsafe()}).status_code == 401
    login(client, password, "admin")
    token = client.cookies.get("flowpilot_session")
    assert client.post("/api/logout", headers={"X-FlowPilot":""}).status_code == 403
    assert client.post("/api/logout").status_code == 200
    client.cookies.set("flowpilot_session", token)
    assert client.get("/api/me").status_code == 401


def test_workflow(workspace):
    client, password = workspace
    login(client, password, "employee")
    created = client.post("/api/tickets", json=FORM)
    assert created.status_code == 201, created.text
    url = "/api/tickets/" + str(created.json()["id"])
    assert client.patch(url, json={"version":1,"status":"closed"}).status_code == 403
    assert client.patch(url, json={"version":1,"title":"顯示器無訊號"}).json()["version"] == 2
    login(client, password, "second")
    assert client.get(url).status_code == 404
    assert client.get(url+"/history").status_code == 404
    assert client.get("/api/tickets").json()["total"] == 0
    assert client.get("/api/dashboard").json()["total"] == 0
    support = login(client, password, "support")
    assert client.patch(url, json={"version":2,"assignee_id":1}).status_code == 422
    updated = client.patch(url, json={"version":2,"assignee_id":support["id"],"status":"working"})
    assert updated.json()["assignee"]["id"] == support["id"]
    assert client.patch(url, json={"version":2,"status":"new"}).status_code == 409
    assert client.delete(url+"?version=3").status_code == 403
    login(client, password, "employee")
    assert client.patch(url,json={"version":3,"description":"擅自修改"}).status_code == 403
    history = client.get(url+"/history").json()
    assert len(history) == 3
    assert history[0]["changes"]["status"] == ["new","working"]
    login(client,password,"manager")
    assert client.get("/api/dashboard").json()["counts"] == {"working":1}
    login(client,password,"admin")
    assert client.delete(url+"?version=2").status_code == 409
    assert client.delete(url+"?version=3").status_code == 204
    assert client.get(url).status_code == 404
    assert client.get("/api/dashboard").json()["total"] == 0


def test_validation_and_search(workspace):
    client, password = workspace
    login(client,password,"employee")
    assert client.post("/api/tickets",json={**FORM,"title":" "}).status_code == 422
    assert client.post("/api/tickets",json={**FORM,"creator_id":2}).status_code == 422
    for i in range(3):
        assert client.post("/api/tickets", json={**FORM,"product":"螢幕"+str(i)}).status_code == 201
    rows = client.get("/api/tickets",params={"q":"螢幕","size":2,"page":2,"priority":"high"}).json()
    assert rows["total"] == 3 and len(rows["items"]) == 1
    assert client.get("/api/tickets?q=%25").json()["total"] == 0
    assert client.get("/api/tickets?page=0").status_code == 422
