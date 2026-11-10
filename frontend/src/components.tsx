import {
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Inbox,
  LoaderCircle,
  PanelTop,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  categories,
  date,
  go,
  num,
  priorities,
  statuses,
  type Ticket,
} from "./api";
export function Brand() {
  return (
    <div className="brand">
      <span className="mark">
        <i />
        <i />
        <i />
      </span>
      FlowPilot
    </div>
  );
}
export function Loading({
  error,
  retry,
}: {
  error?: string;
  retry?: () => void;
}) {
  return (
    <div className="state" role="status">
      {error ? (
        <>
          {error} <button onClick={retry}>重新載入</button>
        </>
      ) : (
        <>
          <LoaderCircle className="spin" size={18} /> 載入中…
        </>
      )}
    </div>
  );
}
export function Empty() {
  return (
    <div className="state">
      <Inbox /> 沒有符合條件的工單
    </div>
  );
}
export function Heading({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <header className="heading">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </header>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span className={"badge " + value}>
      <i />
      {statuses[value]}
    </span>
  );
}
export function Options({ map }: { map: Record<string, string> }) {
  return (
    <>
      {Object.entries(map).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </>
  );
}
export function TicketTable({ rows }: { rows: Ticket[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>工單資訊</th>
            <th>狀態</th>
            <th>優先級</th>
            <th>負責人</th>
            <th>更新時間</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => (
            <tr key={t.id}>
              <td>
                <a className="subject" href={"#ticket/" + t.id}>
                  <span className={"product-icon " + t.category}>
                    {t.category === "hardware" ? (
                      <Wrench />
                    ) : t.category === "network" ? (
                      <Boxes />
                    ) : t.category === "software" ? (
                      <PanelTop />
                    ) : (
                      <SlidersHorizontal />
                    )}
                  </span>
                  <span>
                    <small>
                      {num(t.id)} · {categories[t.category]}
                    </small>
                    <strong>{t.title}</strong>
                  </span>
                </a>
              </td>
              <td>
                <Status value={t.status} />
              </td>
              <td>
                <span className={"priority " + t.priority}>
                  {t.priority === "high" && <ArrowUpRight size={13} />}{" "}
                  {priorities[t.priority]}
                </span>
              </td>
              <td>{t.assignee?.name || "未指派"}</td>
              <td className="time">{date(t.updated_at)}</td>
              <td>
                <button
                  className="icon"
                  aria-label={"開啟 " + num(t.id)}
                  onClick={() => go("ticket/" + t.id)}
                >
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
