import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  History as HistoryIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  api,
  categories,
  date,
  go,
  num,
  priorities,
  statuses,
  useData,
  type EventRow,
  type Fields,
  type Person,
  type Ticket,
} from "./api";
import { Heading, Loading, Options, Status } from "./components";
const labels: Record<string, string> = {
  title: "工單標題",
  product: "產品名稱",
  description: "問題描述",
  assignee: "負責人",
  status: "狀態",
  priority: "優先級",
  category: "問題分類",
};
function Back({ to = "tickets" }: { to?: string }) {
  return (
    <a className="back" href={"#" + to}>
      <ArrowLeft size={15} />
      返回{to === "tickets" ? "工單列表" : "詳情"}
    </a>
  );
}
export function Editor({ ticket, user }: { ticket?: Ticket; user: Person }) {
  const [form, setForm] = useState<Fields>(
    ticket
      ? {
          title: ticket.title,
          product: ticket.product,
          description: ticket.description,
          priority: ticket.priority,
          category: ticket.category,
        }
      : {
          title: "",
          product: "",
          description: "",
          category: "hardware",
          priority: "normal",
        },
  );
  const [status, setStatus] = useState(ticket?.status || "new"),
    [assignee, setAssignee] = useState(String(ticket?.assignee?.id || "")),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dispatch = !!ticket && user.role !== "employee";
  const put = (key: keyof Fields, value: string) =>
    setForm({ ...form, [key]: value });
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = ticket
        ? {
            ...form,
            version: ticket.version,
            ...(dispatch
              ? { status, assignee_id: assignee ? Number(assignee) : null }
              : {}),
          }
        : form;
      const saved = await api<Ticket>(
        ticket ? "tickets/" + ticket.id : "tickets",
        ticket ? "PATCH" : "POST",
        body,
      );
      go("ticket/" + saved.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Back to={ticket ? "ticket/" + ticket.id : "tickets"} />
      <Heading title={ticket ? "編輯工單" : "建立維修工單"} />
      <form className="panel form" onSubmit={submit}>
        <h2>維修申請資料</h2>
        <label>
          工單標題
          <input
            required
            minLength={2}
            maxLength={140}
            value={form.title}
            onChange={(e) => put("title", e.target.value)}
            placeholder="簡述需要協助的問題"
          />
        </label>
        <label>
          產品名稱
          <input
            required
            maxLength={100}
            value={form.product}
            onChange={(e) => put("product", e.target.value)}
          />
        </label>
        <div className="pair">
          <label>
            問題分類
            <select
              value={form.category}
              onChange={(e) => put("category", e.target.value)}
            >
              <Options map={categories} />
            </select>
          </label>
          <label>
            優先級
            <select
              value={form.priority}
              onChange={(e) => put("priority", e.target.value)}
            >
              <Options map={priorities} />
            </select>
          </label>
        </div>
        <label>
          問題描述
          <textarea
            rows={5}
            required
            minLength={2}
            maxLength={5000}
            value={form.description}
            onChange={(e) => put("description", e.target.value)}
            placeholder="描述故障現象與已嘗試的處理方式"
          />
        </label>
        {dispatch && (
          <div className="pair">
            <label>
              狀態
              <select
                aria-label="狀態"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <Options map={statuses} />
              </select>
            </label>
            <Assignee value={assignee} change={setAssignee} />
          </div>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="actions">
          <button
            type="button"
            onClick={() => go(ticket ? "ticket/" + ticket.id : "tickets")}
          >
            取消
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "儲存中…" : ticket ? "儲存變更" : "送出工單"}
          </button>
        </div>
      </form>
    </>
  );
}
function Assignee({
  value,
  change,
}: {
  value: string;
  change: (s: string) => void;
}) {
  const { data, error, retry } = useData<Person[]>("assignees");
  return (
    <label>
      負責人
      {data ? (
        <select
          aria-label="負責人"
          value={value}
          onChange={(e) => change(e.target.value)}
        >
          <option value="">未指派</option>
          {data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      ) : (
        <Loading error={error} retry={retry} />
      )}
    </label>
  );
}
function Timeline({ id }: { id: number }) {
  const { data, error, retry } = useData<EventRow[]>(
    "tickets/" + id + "/history",
  );
  const mapped: Record<string, Record<string, string>> = {
    status: statuses,
    priority: priorities,
    category: categories,
  };
  const value = (key: string, v: string | null) =>
    v === null ? "未指派" : (mapped[key]?.[v] ?? v);
  return (
    <section className="panel pad">
      <h2>
        <HistoryIcon size={18} />
        操作歷程
      </h2>
      {!data ? (
        <Loading error={error} retry={retry} />
      ) : (
        data.map((e) => (
          <article className="event" key={e.id}>
            <b>
              {e.actor.name} ·{" "}
              {e.action === "created" ? "建立工單" : "更新工單"}
            </b>
            <small>{date(e.created_at)}</small>
            {Object.entries(e.changes).map(([k, [a, b]]) => (
              <p key={k}>
                {labels[k]}：{value(k, a)} → {value(k, b)}
              </p>
            ))}
          </article>
        ))
      )}
    </section>
  );
}
export function TicketScreen({
  id,
  edit,
  user,
}: {
  id: string;
  edit: boolean;
  user: Person;
}) {
  const { data: t, error, retry } = useData<Ticket>("tickets/" + id);
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState(false);
  if (!t) return <Loading error={error} retry={retry} />;
  const editable = user.role !== "employee" || t.status === "new";
  if (edit && editable) return <Editor ticket={t} user={user} />;
  async function remove() {
    if (
      !t ||
      !confirm("確定刪除 " + num(t.id) + "？工單會從列表移除，稽核紀錄將保留。")
    )
      return;
    setBusy(true);
    try {
      await api("tickets/" + t.id + "?version=" + t.version, "DELETE");
      go("tickets");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Back />
      <Heading title={t.title} sub={num(t.id)}>
        {editable && (
          <button className="primary" onClick={() => go("edit/" + id)}>
            <Pencil size={16} />
            編輯工單
          </button>
        )}
      </Heading>
      <div className="details">
        <section className="panel pad">
          <h2>工單詳情</h2>
          <dl>
            {[
              ["狀態", <Status value={t.status} />],
              ["優先級", priorities[t.priority]],
              ["產品名稱", t.product],
              ["問題分類", categories[t.category]],
              ["申請人", t.creator.name],
              ["負責人", t.assignee?.name || "未指派"],
              ["建立時間", date(t.created_at)],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>問題描述</h3>
          <p className="description">{t.description}</p>
          {user.role === "admin" && (
            <button className="danger" disabled={busy} onClick={remove}>
              <Trash2 size={15} />
              刪除工單
            </button>
          )}
          {err && <p role="alert">{err}</p>}
        </section>
        <Timeline id={t.id} />
      </div>
    </>
  );
}
