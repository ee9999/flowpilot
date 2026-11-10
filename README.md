# FlowPilot

**Enterprise AI Service & Workflow Automation Platform**

企業售後服務工作台。員工提出維修需求，客服接手、指派與更新處理進度，主管和管理員透過同一套工單資料查看狀態分布與近期異動。第一階段可完全在本機執行，無需雲端帳號或 AI 金鑰。

## Windows 快速啟動

在專案根目錄開啟 PowerShell。新環境建議使用 Docker Desktop，啟用 Linux containers 與 Compose v2。

```powershell
docker compose version
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

在編輯器中分別設定 `POSTGRES_PASSWORD` 與 `DEMO_PASSWORD`。請使用兩組不同的隨機字串，Demo 密碼長度為 12 至 256 字元。可用密碼管理器產生英數字串。這台開發機已建立本機專用的 `.env`，可沿用現有值。

```powershell
docker compose up --build -d
docker compose ps -a
Invoke-RestMethod http://127.0.0.1:8080/api/health
```

開啟 [售後服務工作台](http://127.0.0.1:8080) 或 [Swagger UI](http://127.0.0.1:8080/api/docs)。初次啟動會下載映像與套件。資料庫就緒後，`init` 執行 Alembic migration，再於空白工作區建立帳號與工單。`init` 成功結束後會顯示 `Exited (0)`。Nginx 提供靜態前端並將同源的 `/api/` 轉給 FastAPI。

```powershell
docker compose logs --tail 80 init api web
docker compose down
```

`down` 會保留 PostgreSQL 的具名 volume。重啟時使用相同的資料庫密碼。帳號密碼由首次 seed 設定，之後編輯環境檔不會更改既有帳號。Docker 與下方原生開發模式各有獨立資料庫。

## 五分鐘展示流程

首次 seed 會建立 12 張範例工單，分布於 4 種狀態與 4 種分類。以下帳號共用你在首次啟動時設定的 `DEMO_PASSWORD`，方便在本機切換角色。

| 帳號 | 身分 | 可操作範圍 |
| --- | --- | --- |
| `employee` | 員工 | 建立、查詢自己的工單及歷程，修改自己的待處理工單內容 |
| `support` | 客服 | 查看與編輯全隊工單、指派客服／主管／管理員、更新狀態 |
| `manager` | 主管 | 查看全隊統計與歷程，具備客服處理權限 |
| `admin` | 管理員 | 全隊統計與工單管理，另可軟刪除工單 |

1. 以 `employee` 登入，按「建立工單」，輸入產品名稱、問題標題與描述，送出後記下工單編號。
2. 從左下角登出，改用 `support` 登入，在「工單管理」搜尋剛才的編號。
3. 進入詳情，按「編輯工單」，選擇負責人並將狀態改為「處理中」。儲存後，詳情頁會列出操作者、時間與欄位變更前後值。
4. 用 `employee` 再次登入即可看到進度。工單進入處理後，員工無法改寫申請內容。
5. 用 `admin` 登入「服務總覽」，查看各狀態數量。點選統計卡或分布圖例可進入對應的篩選列表。

列表支援工單編號、標題與產品搜尋，可搭配狀態、分類、優先級及分頁。員工的總覽只計算本人資料，其餘角色顯示全隊資料。主管與管理員皆可查看統計。刪除限管理員，資料庫保留原工單與刪除事件。

## Windows 原生開發

需要 Python 3.13 或 3.14、Node.js 24、pnpm 11.25.0、可連線的 PostgreSQL。若已安裝標準 Node.js，可執行 `npm install -g pnpm@11.25.0`。本機已準備好的開發環境可直接使用 [開發工作台](http://127.0.0.1:5173)。

**全新原生環境**請先建立獨立 PostgreSQL 資料庫與有權建立資料表的角色，在根目錄 `.env` 設定 `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD`、`DEMO_PASSWORD`。選用 `DB_HOST`、`DB_PORT`，預設為 `127.0.0.1`、`5432`。也可設定完整 `DATABASE_URL` 取代分欄連線設定，密碼內的特殊字元須 URL encode。

**本次已配置的工作區**使用獨立 PostgreSQL 18.6，僅監聽 `127.0.0.1:55432`。`.qa/pgdata` 保存這個本機 Demo 的資料，執行檔在 `.qa/node_modules`，兩者均由 Git 排除。重開機後可在根目錄啟動此既有資料庫：

```powershell
$pgctl = '.\.qa\node_modules\@embedded-postgres\windows-x64\native\bin\pg_ctl.exe'
& $pgctl -D .qa/pgdata status
# 若資料庫未執行
& $pgctl -D .qa/pgdata -l .qa/postgres.log -o '-h 127.0.0.1 -p 55432' -w start
```

**後端終端機**，從根目錄執行：

```powershell
if (!(Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.txt
cd backend
..\.venv\Scripts\python.exe -m alembic upgrade head
..\.venv\Scripts\python.exe -m app.seed
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**前端終端機**，從根目錄執行：

```powershell
cd frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd dev --port 5173 --strictPort
```

開啟 [Vite 工作台](http://127.0.0.1:5173)。前後端埠已被本次執行的服務使用時，直接使用現有服務即可。自行從終端機啟動的前後端可用 Ctrl+C 結束。需要停止上述專用 PostgreSQL 時，從根目錄執行 `& $pgctl -D .qa/pgdata -m fast -w stop`。

## 架構與程式入口

| 位置 | 職責 |
| --- | --- |
| `frontend/src/main.tsx` | 登入、工作空間、導覽與 Session 到期處理 |
| `frontend/src/Workspace.tsx`、`Ticket.tsx` | 總覽、佇列、編輯表單、詳情與歷程 |
| `frontend/src/api.ts` | 同源 REST 請求、載入狀態、業務型別及繁中標籤 |
| `backend/app/main.py` | FastAPI 路由、後端權限、交易、搜尋與統計 |
| `backend/app/schemas.py` | Pydantic 輸入驗證與回應欄位 |
| `backend/app/models.py`、`db.py` | SQLAlchemy 關聯模型、連線與 Session |
| `backend/app/security.py`、`seed.py` | 密碼與 Session 雜湊、可重複執行的 Demo 初始化 |
| `backend/migrations/`、`tests/` | Alembic 結構版本與 pytest 測試 |

`users` 同時作為工單申請人、負責人與稽核操作者。`sessions` 保存隨機登入憑證的 SHA-256 摘要與到期時間。`tickets` 以外鍵連向申請人與負責人，`events` 保存工單及欄位差異。申請人、負責人、事件工單與佇列查詢均有索引。

密碼用隨機 salt 與 scrypt 雜湊。登入採八小時的 HttpOnly、SameSite=Strict Cookie，登出會刪除伺服器 Session。前端與 API 同源，異動請求須帶自訂標頭。部署 HTTPS 時將 `COOKIE_SECURE` 設為 `true`。API 逐次驗證角色與資料範圍。

PostgreSQL 對修改中的工單加列鎖，再比對客戶端帶來的 `version`。過期修改收到 HTTP 409，需重新整理後確認最新工單。工單寫入與稽核事件同筆提交，失敗會回滾。執行日誌記錄方法、路徑、狀態碼與耗時，例外堆疊保留於後端。

## API 文件與除錯

[開發版 Swagger UI](http://127.0.0.1:5173/api/docs) · [OpenAPI JSON](http://127.0.0.1:5173/api/openapi.json)。Swagger UI 的靜態資源使用 CDN；離線環境仍可直接讀取本機 OpenAPI JSON。Swagger 試打異動端點時，將 `x-flowpilot` 填入 `web`，先呼叫登入，再於同一瀏覽器測試。

| 操作 | 路徑 |
| --- | --- |
| 登入、登出、目前身分 | `POST /api/login`、`POST /api/logout`、`GET /api/me` |
| 建立、搜尋／篩選 | `POST /api/tickets`、`GET /api/tickets` |
| 詳情、編輯、軟刪除 | `GET / PATCH / DELETE /api/tickets/{id}` |
| 歷程、可指派人員 | `GET /api/tickets/{id}/history`、`GET /api/assignees` |
| 即時統計、DB 健康檢查 | `GET /api/dashboard`、`GET /api/health` |

PATCH 在 JSON 帶入 `version`，DELETE 在 query 帶入 `version`。未登入回傳 401；角色不足回傳 403；越權讀取他人工單與已刪除工單回傳 404；格式／欄位錯誤回傳 422。登入後仍跳回登入頁時，請確認瀏覽器使用相同 hostname，且 HTTP 本機模式的 `COOKIE_SECURE=false`。

## 驗證

從根目錄執行：

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m alembic check
cd ../frontend
pnpm.cmd build
```

pytest 預設使用記憶體 SQLite，覆蓋密碼雜湊、登入登出與憑證失效、跨角色操作、越權存取、欄位驗證、搜尋分頁、版本衝突與軟刪除。若要在 PostgreSQL 上跑同一套案例，可在 `backend` 目錄執行下列命令。它從現有設定取得連線，測試表放在隨機 schema 中，結束後整筆回滾。連線角色須有建立 schema 的權限。

```powershell
..\.venv\Scripts\python.exe -c "from app.db import connection_url; import os, pytest; os.environ['FLOWPILOT_TEST_URL'] = connection_url().render_as_string(hide_password=False); raise SystemExit(pytest.main(['-q']))"
```

本次驗收在 Windows 完成 PostgreSQL migration、重跑 seed、schema 比對、SQLite 與 PostgreSQL 各 4 項 pytest、TypeScript 與 Vite production build。另用 Edge 實際走過員工建單、客服搜尋／指派／改狀態、查看前後值、管理員總覽與刪除，以及手機寬度導覽。測試套件目前會提示 Starlette TestClient 的 httpx 相容層即將淘汰。這台機器沒有可用的 Docker CLI，Compose 容器啟動尚待具備 Docker 的環境驗證。

## 下一階段

建議先完成產品、客戶與保固模組。把工單現有的產品名稱逐步連至產品或設備序號，保留歷史工單文字，再加入購買日、保固到期日與查詢 API。這些資料可作為後續自動派工與 AI 工具呼叫的共同來源。Webhook 重試、RAG、OCR 與 AI Agent 留待相應階段實作。
