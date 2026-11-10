import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Workflow,
  X,
} from "lucide-react";
import { api, go, roles, type Person } from "./api";
import { Brand, Loading } from "./components";
import { Dashboard, List } from "./Workspace";
import { Editor, TicketScreen } from "./Ticket";
import "./style.css";

function Login({ done }: { done: (p: Person) => void }) {
  const [username, setName] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await api<Person>("login", "POST", { username, password });
      go("dashboard");
      done(user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <aside className="login-art">
        <Brand />
        <div className="art-center">
          <div className="eyebrow">
            <i /> SERVICE OPERATIONS
          </div>
          <h1>
            售後服務
            <br />
            營運工作台
          </h1>
          <div className="flow-art" aria-hidden="true">
            <div>
              <ClipboardList />
              <span>維修申請</span>
              <Check />
            </div>
            <i />
            <div>
              <GitBranch />
              <span>工單派送</span>
              <Check />
            </div>
            <i />
            <div>
              <Activity />
              <span>進度追蹤</span>
              <span className="live-dot" />
            </div>
          </div>
        </div>
        <small>FlowPilot Enterprise Platform</small>
      </aside>
      <section className="login-form">
        <form onSubmit={submit}>
          <span className="workspace-icon">
            <Workflow />
          </span>
          <h1>登入工作空間</h1>
          <p>使用團隊帳號進入售後服務平台。</p>
          <label>
            使用者帳號
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setName(e.target.value)}
              placeholder="輸入帳號"
            />
          </label>
          <label>
            密碼
            <span className="pass">
              <input
                required
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="輸入密碼"
              />
              <button
                type="button"
                aria-label={show ? "隱藏密碼" : "顯示密碼"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="primary login-btn" disabled={busy}>
            {busy ? "登入中…" : "登入"}
            <ArrowRight size={16} />
          </button>
          <div className="secure">
            <ShieldCheck size={15} />
            企業內部服務平台
          </div>
        </form>
      </section>
    </main>
  );
}
function route() {
  return location.hash.slice(1) || "dashboard";
}
function App() {
  const [user, setUser] = useState<Person | null>(),
    [path, setPath] = useState(route),
    [menu, setMenu] = useState(false),
    [error, setError] = useState("");
  function load() {
    setError("");
    api<Person>("me")
      .then(setUser)
      .catch((e) => {
        if (e.message === "請先登入") setUser(null);
        else setError(e.message);
      });
  }
  useEffect(() => {
    const nav = () => {
        setPath(route());
        setMenu(false);
      },
      expired = () => setUser(null);
    window.addEventListener("hashchange", nav);
    window.addEventListener("expired", expired);
    load();
    return () => {
      window.removeEventListener("hashchange", nav);
      window.removeEventListener("expired", expired);
    };
  }, []);
  if (user === undefined) return <Loading error={error} retry={load} />;
  if (!user)
    return (
      <Login
        done={(p) => {
          setError("");
          setUser(p);
        }}
      />
    );
  const [view, id] = path.split("/"),
    dash = view === "dashboard";
  const current = dash
    ? "服務總覽"
    : view === "tickets"
      ? "工單管理"
      : view === "new"
        ? "建立工單"
        : view === "edit"
          ? "編輯工單"
          : "工單詳情";
  return (
    <div className="shell">
      {menu && (
        <button
          className="scrim"
          aria-label="關閉導覽"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Brand />
        <div className="workspace">
          <span>
            <Workflow size={18} />
          </span>
          <div>
            <b>售後服務中心</b>
            <small>企業工作空間</small>
          </div>
        </div>
        <small className="nav-label">工作空間</small>
        <nav>
          <a className={dash ? "active" : ""} href="#dashboard">
            <LayoutDashboard />
            服務總覽
          </a>
          <a className={!dash ? "active" : ""} href="#tickets">
            <ClipboardList />
            工單管理
          </a>
        </nav>
        <div className="side-bottom">
          <a href="/api/docs" target="_blank" rel="noreferrer">
            <BookOpen size={16} />
            API 文件
          </a>
          <div className="profile">
            <span className="avatar">{user.name.slice(-2, -1)}</span>
            <div>
              <b>{user.name}</b>
              <small>{roles[user.role]}</small>
            </div>
            <button
              aria-label="登出"
              className="icon"
              onClick={async () => {
                try {
                  await api("logout", "POST");
                  setUser(null);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <main className="content">
        <header className="top">
          <button
            className="mobile icon"
            aria-label="開啟導覽"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <span>工作空間</span>
          <ChevronRight size={14} />
          <b>{current}</b>
          <time>
            {new Intl.DateTimeFormat("zh-TW", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }).format(new Date())}
          </time>
        </header>
        <div className="page">
          {error && <p role="alert">{error}</p>}
          {dash ? (
            <Dashboard user={user} />
          ) : view === "tickets" ? (
            <List key={path} initial={id || ""} />
          ) : view === "new" ? (
            <Editor user={user} />
          ) : ["ticket", "edit"].includes(view) && /^\d+$/.test(id) ? (
            <TicketScreen
              key={path}
              id={id}
              edit={view === "edit"}
              user={user}
            />
          ) : (
            <a href="#dashboard">找不到頁面，返回服務總覽</a>
          )}
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
