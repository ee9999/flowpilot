import { useEffect, useState } from "react";

export type Person = { id: number; name: string; role: string };
export type Fields = {
  title: string;
  product: string;
  category: string;
  priority: string;
  description: string;
};
export type Ticket = Fields & {
  id: number;
  status: string;
  creator: Person;
  assignee: Person | null;
  updated_at: string;
  created_at: string;
  version: number;
};
export type EventRow = {
  id: number;
  actor: Person;
  action: string;
  changes: Record<string, [string | null, string | null]>;
  created_at: string;
};
export const statuses: Record<string, string> = {
  new: "待處理",
  working: "處理中",
  waiting: "待回覆",
  closed: "已結案",
};
export const priorities = { high: "高", normal: "一般", low: "低" } as Record<
  string,
  string
>;
export const categories = {
  hardware: "硬體維修",
  software: "軟體問題",
  network: "網路連線",
  other: "其他",
} as Record<string, string>;
export const roles: Record<string, string> = {
  employee: "員工",
  support: "客服",
  manager: "主管",
  admin: "管理員",
};
export const num = (id: number) => "FP-" + String(id).padStart(5, "0");
export const date = (s: string) =>
  new Date(s).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export function go(path: string) {
  location.hash = path;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const res = await fetch("/api/" + path, {
    method,
    headers: { "Content-Type": "application/json", "X-FlowPilot": "web" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && path !== "login")
      window.dispatchEvent(new Event("expired"));
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : res.status === 422
          ? "請確認欄位內容與長度。"
          : "讀取失敗，請稍後重試。",
    );
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
export function useData<T>(path: string) {
  const [rev, setRev] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>(
    { key: "" },
  );
  const key = path + "#" + rev;
  useEffect(() => {
    let active = true;
    api<T>(path)
      .then((data) => active && setState({ key, data }))
      .catch((e) => active && setState({ key, error: e.message }));
    return () => {
      active = false;
    };
  }, [path, key]);
  return {
    ...(state.key === key ? state : {}),
    retry: () => setRev((x) => x + 1),
  };
}
