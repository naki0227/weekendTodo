import { getWeekendCutoffDate, weekendKeyForDate } from "./date";
import {
  readLocalTodos,
  readPendingMutations,
  writeLocalTodos,
  writePendingMutations,
} from "./storage";
import { supabase } from "./supabase";
import type { BackendMode, PendingTodoMutation, TodoItem } from "../types";

const TABLE_NAME = "weekend_todos";

type StoredTodoItem = Partial<TodoItem> & Pick<TodoItem, "id" | "title" | "target_date">;

export async function loadTodos(userId?: string): Promise<{
  items: TodoItem[];
  backend: BackendMode;
}> {
  const localItems = normalizeStoredTodos(readLocalTodos());

  if (supabase && userId) {
    await flushPendingMutations(userId);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .order("target_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (!error) {
      const remoteItems = sortTodos((data ?? []) as TodoItem[]);
      const migratedItems = await migrateLegacyLocalTodos(localItems, remoteItems, userId);
      const mergedItems = sortTodos([...remoteItems, ...migratedItems]);
      writeLocalTodos(mergedItems);
      return { items: mergedItems, backend: "supabase" };
    }
  }

  return { items: sortTodos(localItems), backend: "local" };
}

export async function createTodo(item: TodoItem) {
  upsertLocalTodo(item);

  if (supabase) {
    const { error } = await supabase.from(TABLE_NAME).insert(item);
    if (!error) {
      dequeueMatchingMutation(item.id, "upsert");
      return;
    }
  }

  enqueueMutation({
    type: "upsert",
    item,
  });
}

export async function toggleTodo(id: string, completed: boolean) {
  const localItems = normalizeStoredTodos(readLocalTodos());
  const nextItem = localItems.find((item) => item.id === id);

  if (!nextItem) {
    return;
  }

  const updatedItem = { ...nextItem, completed };
  upsertLocalTodo(updatedItem);

  if (supabase) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ completed })
      .eq("id", id);
    if (!error) {
      dequeueMatchingMutation(id, "upsert");
      return;
    }
  }

  enqueueMutation({
    type: "upsert",
    item: updatedItem,
  });
}

export async function deleteTodo(id: string) {
  const localItems = normalizeStoredTodos(readLocalTodos());
  const target = localItems.find((item) => item.id === id);
  removeLocalTodo(id);

  if (supabase) {
    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", id);
    if (!error) {
      dequeueMatchingMutation(id);
      return;
    }
  }

  if (target) {
    enqueueMutation({
      type: "delete",
      id,
      user_id: target.user_id,
    });
  }
}

export async function pruneExpiredTodos() {
  const cutoff = getWeekendCutoffDate();

  if (supabase) {
    await supabase.from(TABLE_NAME).delete().lt("target_date", cutoff);
  }

  const localItems = normalizeStoredTodos(readLocalTodos()).filter(
    (item) => item.target_date >= cutoff,
  );
  writeLocalTodos(localItems);
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
      items: sortTodos(groupedItems),
    }));
}

function normalizeStoredTodos(items: StoredTodoItem[]): TodoItem[] {
  return items
    .filter((item): item is StoredTodoItem & Pick<TodoItem, "title"> => Boolean(item.id && item.title))
    .map((item) => ({
      id: item.id,
      user_id: item.user_id ?? "local-user",
      title: item.title,
      note: item.note ?? "",
      target_date: item.target_date,
      completed: item.completed ?? false,
      created_at: item.created_at ?? new Date(0).toISOString(),
    }));
}

async function flushPendingMutations(userId: string) {
  if (!supabase) {
    return;
  }

  const pending = readPendingMutations();
  if (pending.length === 0) {
    return;
  }

  const remaining: PendingTodoMutation[] = [];

  for (const mutation of pending) {
    if (!belongsToUser(mutation, userId)) {
      remaining.push(mutation);
      continue;
    }

    if (mutation.type === "upsert") {
      const { error } = await supabase.from(TABLE_NAME).upsert(mutation.item);
      if (error) {
        remaining.push(mutation, ...pending.slice(pending.indexOf(mutation) + 1));
        break;
      }
      continue;
    }

    const { error } = await supabase.from(TABLE_NAME).delete().eq("id", mutation.id);
    if (error) {
      remaining.push(mutation, ...pending.slice(pending.indexOf(mutation) + 1));
      break;
    }
  }

  writePendingMutations(remaining);
}

async function migrateLegacyLocalTodos(
  localItems: TodoItem[],
  remoteItems: TodoItem[],
  userId: string,
) {
  if (!supabase) {
    return [];
  }

  const remoteIds = new Set(remoteItems.map((item) => item.id));
  const legacyItems = localItems
    .filter((item) => (item.user_id === "local-user" || item.user_id === userId) && !remoteIds.has(item.id))
    .map((item) => ({
      ...item,
      user_id: userId,
    }));

  if (legacyItems.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from(TABLE_NAME).insert(legacyItems).select("*");
  if (error) {
    return [];
  }

  return (data ?? []) as TodoItem[];
}

function belongsToUser(mutation: PendingTodoMutation, userId: string) {
  if (mutation.type === "delete") {
    return mutation.user_id === "local-user" || mutation.user_id === userId;
  }
  return mutation.item.user_id === "local-user" || mutation.item.user_id === userId;
}

function enqueueMutation(mutation: PendingTodoMutation) {
  const pending = readPendingMutations();
  const filtered = pending.filter((item) => {
    if (item.type === "delete") {
      return item.id !== getMutationId(mutation);
    }
    return item.item.id !== getMutationId(mutation);
  });

  if (mutation.type === "delete") {
    filtered.push(mutation);
  } else {
    filtered.push(mutation);
  }

  writePendingMutations(filtered);
}

function dequeueMatchingMutation(id: string, type?: PendingTodoMutation["type"]) {
  const pending = readPendingMutations().filter((mutation) => {
    if (type && mutation.type !== type) {
      return true;
    }
    return getMutationId(mutation) !== id;
  });
  writePendingMutations(pending);
}

function getMutationId(mutation: PendingTodoMutation) {
  return mutation.type === "delete" ? mutation.id : mutation.item.id;
}

function upsertLocalTodo(item: TodoItem) {
  const localItems = normalizeStoredTodos(readLocalTodos());
  const nextItems = localItems.filter((candidate) => candidate.id !== item.id);
  nextItems.push(item);
  writeLocalTodos(sortTodos(nextItems));
}

function removeLocalTodo(id: string) {
  writeLocalTodos(normalizeStoredTodos(readLocalTodos()).filter((item) => item.id !== id));
}

function sortTodos(items: TodoItem[]) {
  return [...items].sort((a, b) =>
    `${a.target_date}${a.created_at}`.localeCompare(`${b.target_date}${b.created_at}`),
  );
}
