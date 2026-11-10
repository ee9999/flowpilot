import { useState } from "react";
import {
  ArrowRight,
  CheckCheck,
  CircleDot,
  Clock3,
  Layers3,
  Plus,
  Search,
  Timer,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  categories,
  go,
  priorities,
  statuses,
  useData,
  type Person,
  type Ticket,
} from "./api";
import { Heading, Loading, Options, TicketTable } from "./components";
const icons = [Layers3, Clock3, CircleDot, CheckCheck];
export function Add() {
  return (
    <button className="primary" onClick={() => go("new")}>
      <Plus size={17} />
      建立工單
    </button>
  );
}
export function Dashboard({ user }: { user: Person }) {
  const { data, error, retry } = useData<{
    counts: Record<string, number>;
    total: number;
    recent: Ticket[];
  }>("dashboard");
  if (!data) return <Loading error={error} retry={retry} />;
  const { counts, total } = data;
  return (
    <>
      <Heading
        title="服務總覽"
        sub={
          user.role === "employee"
            ? "查看你提出的維修申請與處理進度。"
            : "掌握團隊工單現況與最新服務動態。"
        }
      >
        <Add />
      </Heading>
      <div className="metrics">
        {[
          ["全部工單", total, "all"],
          ["待處理", counts.new || 0, "new"],
          ["處理中", counts.working || 0, "working"],
          ["已結案", counts.closed || 0, "closed"],
        ].map(([label, n, k], i) => {
          const Icon = icons[i];
          return (
            <a
              className={"metric m" + i}
              key={k}
              href={k === "all" ? "#tickets" : "#tickets/" + k}
            >
              <span className="metric-label">
                <span>
                  <Icon size={18} />
                </span>
                {label}
              </span>
              <b>{String(n).padStart(2, "0")}</b>
            </a>
          );
        })}
      </div>
      <section className="panel distribution">
        <div>
          <div className="section-label">
            <Timer size={16} />
            工作佇列
          </div>
          <h2>工單狀態分布</h2>
        </div>
        <div className="distribution-chart">
          <div className="bar">
            {Object.keys(statuses).map((k) => (
              <i key={k} className={k} style={{ flex: counts[k] || 0 }} />
            ))}
          </div>
          <div className="legend">
            {Object.entries(statuses).map(([k, v]) => (
              <a href={"#tickets/" + k} key={k}>
                <i className={k} />
                {v} <b>{counts[k] || 0}</b>
              </a>
            ))}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>近期更新工單</h2>
          <a href="#tickets">
            查看全部 <ArrowRight size={15} />
          </a>
        </div>
        <TicketTable rows={data.recent} />
      </section>
    </>
  );
}
export function List({ initial }: { initial: string }) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState(initial),
    [priority, setPriority] = useState(""),
    [cat, setCat] = useState(""),
    [page, setPage] = useState(1);
  const params = new URLSearchParams({ q, page: String(page) });
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  if (cat) params.set("category", cat);
  const { data, error, retry } = useData<{ items: Ticket[]; total: number }>(
    "tickets?" + params,
  );
  return (
    <>
      <Heading title="工單管理" sub="查詢維修申請、分派任務與追蹤進度。">
        <Add />
      </Heading>
      <section className="panel">
        <div className="filters">
          <label className="search">
            <Search size={16} />
            <input
              aria-label="搜尋工單"
              placeholder="搜尋工單編號、標題或產品"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          {[
            [status, setStatus, statuses, "全部狀態"],
            [priority, setPriority, priorities, "全部優先級"],
            [cat, setCat, categories, "全部分類"],
          ].map((entry) => {
            const [v, set, map, label] = entry as [
              string,
              (v: string) => void,
              Record<string, string>,
              string,
            ];
            return (
              <select
                key={label}
                aria-label={label}
                value={v}
                onChange={(e) => {
                  set(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{label}</option>
                <Options map={map} />
              </select>
            );
          })}
        </div>
        {!data ? (
          <Loading error={error} retry={retry} />
        ) : (
          <>
            <TicketTable rows={data.items} />
            <div className="pager">
              共 {data.total} 筆工單{" "}
              <div>
                <button
                  className="icon"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  aria-label="上一頁"
                >
                  <ChevronLeft />
                </button>{" "}
                {page} / {Math.max(1, Math.ceil(data.total / 10))}{" "}
                <button
                  className="icon"
                  disabled={page * 10 >= data.total}
                  onClick={() => setPage(page + 1)}
                  aria-label="下一頁"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
