import type { TodoItem } from "../types";

const STORAGE_KEY = "weekend-todo-items-v1";

export function readLocalTodos(): TodoItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TodoItem[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalTodos(items: TodoItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
