export type TodoItem = {
  id: string;
  user_id: string;
  title: string;
  note: string;
  target_date: string;
  completed: boolean;
  created_at: string;
};

export type PendingTodoMutation =
  | {
      type: "upsert";
      item: TodoItem;
    }
  | {
      type: "delete";
      id: string;
      user_id: string;
    };

export type TodoFilter = "all" | "open" | "done";

export type BackendMode = "supabase" | "local";

export type AuthMode = "required" | "local";
