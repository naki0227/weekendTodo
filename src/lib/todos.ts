import { getWeekendCutoffDate, weekendKeyForDate } from "./date";
import { readLocalTodos, writeLocalTodos } from "./storage";
import { supabase } from "./supabase";
import type { BackendMode, TodoItem } from "../types";

const TABLE_NAME = "weekend_todos";

export async function loadTodos(): Promise<{
  items: TodoItem[];
  backend: BackendMode;
}> {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("target_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error) {
      const items = (data ?? []) as TodoItem[];
      writeLocalTodos(items);
      return { items, backend: "supabase" };
    }
  }

  return { items: readLocalTodos(), backend: "local" };
}

export async function createTodo(item: TodoItem) {
  if (supabase) {
    const { error } = await supabase.from(TABLE_NAME).insert(item);
    if (!error) {
      return;
    }
  }

  const items = readLocalTodos();
  items.push(item);
  writeLocalTodos(items);
}

export async function toggleTodo(id: string, completed: boolean) {
  if (supabase) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ completed })
      .eq("id", id);
    if (!error) {
      return;
    }
  }

  const items = readLocalTodos().map((item) =>
    item.id === id ? { ...item, completed } : item,
  );
  writeLocalTodos(items);
}

export async function deleteTodo(id: string) {
  if (supabase) {
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
    if (!error) {
      return;
    }
  }

  writeLocalTodos(readLocalTodos().filter((item) => item.id !== id));
}

export async function pruneExpiredTodos() {
  const cutoff = getWeekendCutoffDate();

  if (supabase) {
    await supabase.from(TABLE_NAME).delete().lt("target_date", cutoff);
  }

  writeLocalTodos(readLocalTodos().filter((item) => item.target_date >= cutoff));
}

export function groupTodos(items: TodoItem[]) {
  const groups = new Map<string, TodoItem[]>();

  for (const item of items) {
    const key = weekendKeyForDate(item.target_date);
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupedItems]) => ({
      key,
      items: groupedItems.sort((a, b) =>
        `${a.target_date}${a.created_at}`.localeCompare(`${b.target_date}${b.created_at}`),
      ),
    }));
}
