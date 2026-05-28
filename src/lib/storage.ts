import type { PendingTodoMutation, TodoItem } from "../types";

const STORAGE_KEY = "weekend-todo-items-v1";
const PENDING_MUTATIONS_KEY = "weekend-todo-pending-mutations-v1";

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

export function readPendingMutations(): PendingTodoMutation[] {
  try {
    const raw = window.localStorage.getItem(PENDING_MUTATIONS_KEY);
    return raw ? (JSON.parse(raw) as PendingTodoMutation[]) : [];
  } catch {
    return [];
  }
}

export function writePendingMutations(mutations: PendingTodoMutation[]) {
  window.localStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(mutations));
}
