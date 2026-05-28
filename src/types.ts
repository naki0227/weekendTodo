export type TodoItem = {
  id: string;
  user_id: string;
  title: string;
  note: string;
  target_date: string;
  completed: boolean;
  created_at: string;
};

export type TodoFilter = "all" | "open" | "done";

export type BackendMode = "supabase" | "local";

export type AuthMode = "required" | "local";
