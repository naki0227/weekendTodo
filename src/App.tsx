import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  formatMonthDay,
  formatWeekday,
  getWeekendRangeLabel,
  isExpiredWeekendDate,
  isWeekendDate,
  nextWeekendDate,
  addDays,
} from "./lib/date";
import {
  getInitialSession,
  onAuthStateChange,
  signInWithGoogle,
  signInWithMagicLink,
  signOut,
} from "./lib/auth";
import { supabase } from "./lib/supabase";
import { createTodo, deleteTodo, groupTodos, loadTodos, pruneExpiredTodos, toggleTodo } from "./lib/todos";
import type { AuthMode, BackendMode, TodoFilter, TodoItem } from "./types";

type DraftState = {
  title: string;
  note: string;
  targetDate: string;
};

const initialDraft = (): DraftState => ({
  title: "",
  note: "",
  targetDate: nextWeekendDate("sat"),
});

export default function App() {
  const [draft, setDraft] = useState<DraftState>(initialDraft);
  const [email, setEmail] = useState("");
  const [items, setItems] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [backend, setBackend] = useState<BackendMode>("local");
  const [authMode] = useState<AuthMode>(supabase ? "required" : "local");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      void refreshTodos();
      return;
    }

    void getInitialSession().then((initialSession) => {
      setSession(initialSession);
      setAuthLoading(false);

      if (initialSession) {
        void refreshTodos();
      } else {
        setLoading(false);
      }
    });

    const unsubscribe = onAuthStateChange((nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);

      if (nextSession) {
        void refreshTodos();
      } else {
        setItems([]);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  async function refreshTodos() {
    setLoading(true);
    await pruneExpiredTodos();
    const next = await loadTodos();
    setItems(next.items);
    setBackend(next.backend);
    setLoading(false);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = draft.title.trim();
    const note = draft.note.trim();
    const targetDate = draft.targetDate;

    if (!title) {
      return;
    }

    if (!isWeekendDate(targetDate)) {
      window.alert("予定日は土曜または日曜を選んでください。");
      return;
    }

    if (isExpiredWeekendDate(targetDate)) {
      window.alert("終了した週末には登録できません。今週末以降の土日を選んでください。");
      return;
    }

    await createTodo({
      id: crypto.randomUUID(),
      user_id: session?.user.id ?? "local-user",
      title,
      note,
      target_date: targetDate,
      completed: false,
      created_at: new Date().toISOString(),
    });

    setDraft(initialDraft());
    await refreshTodos();
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEmail = email.trim();
    if (!nextEmail) {
      return;
    }

    const { error } = await signInWithMagicLink(nextEmail);
    if (error) {
      window.alert("ログインリンクを送れませんでした。Supabase Auth設定を確認してください。");
      return;
    }

    setAuthNotice("ログインリンクをメールで送りました。スマホかPCで開いてログインしてください。");
  }

  async function handleGoogleSignIn() {
    const { error } = await signInWithGoogle();
    if (error) {
      window.alert("Googleログインを開始できませんでした。Supabase と Google Auth 設定を確認してください。");
    }
  }

  async function handleSignOut() {
    await signOut();
  }

  async function handleToggle(item: TodoItem) {
    await toggleTodo(item.id, !item.completed);
    await refreshTodos();
  }

  async function handleDelete(id: string) {
    await deleteTodo(id);
    await refreshTodos();
  }

  function setShortcutDate(shortcut: "sat" | "sun" | "next") {
    if (shortcut === "sun") {
      setDraft((current) => ({ ...current, targetDate: nextWeekendDate("sun") }));
      return;
    }

    if (shortcut === "next") {
      const nextWeek = addDays(new Date(), 7);
      setDraft((current) => ({
        ...current,
        targetDate: nextWeekendDate("sat", nextWeek),
      }));
      return;
    }

    setDraft((current) => ({ ...current, targetDate: nextWeekendDate("sat") }));
  }

  const visibleItems = items.filter((item) => {
    if (filter === "open") {
      return !item.completed;
    }
    if (filter === "done") {
      return item.completed;
    }
    return true;
  });

  const groups = groupTodos(visibleItems);

  if (authLoading) {
    return (
      <div className="app-shell">
        <p className="empty-state">認証状態を確認中...</p>
      </div>
    );
  }

  if (authMode === "required" && !session) {
    return (
      <div className="app-shell auth-shell">
        <section className="card auth-card">
          <p className="eyebrow">Weekend Planner</p>
          <h1>週末Todoにログイン</h1>
          <p className="hero-copy">
            Googleログインかメールのマジックリンクでログインできます。ログイン後は自分の週末Todoだけが表示されます。
          </p>

          <div className="auth-actions">
            <button className="oauth-button" type="button" onClick={() => void handleGoogleSignIn()}>
              Googleでログイン
            </button>
          </div>

          <div className="auth-divider" aria-hidden="true">
            <span>またはメールでログイン</span>
          </div>

          <form className="todo-form" onSubmit={handleSignIn}>
            <label>
              <span>メールアドレス</span>
              <input
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <div className="submit-row">
              <button className="primary-button" type="submit">
                ログインリンクを送る
              </button>
              <p className="hint">
                Supabase Dashboard の Authentication で Site URL と Redirect URL に公開URLを登録してください。
              </p>
              {authNotice ? <p className="hint">{authNotice}</p> : null}
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="eyebrow">Weekend Planner</p>
        <h1>週末することだけ、すぐ入れる。</h1>
        <p className="hero-copy">
          土日専用のTodoリスト。週末が終わったTodoは自動で消え、Supabaseを設定すればスマホでもPCでも同じ内容を見られます。
        </p>
        <div className="hero-meta">
          <span className="pill">{backend === "supabase" ? "Supabase同期中" : "ローカル保存"}</span>
          <span className="pill pill-accent">{getWeekendRangeLabel()}</span>
          {session?.user.email ? <span className="pill">{session.user.email}</span> : null}
        </div>
      </header>

      <main className="layout">
        <section className="card composer">
          <div className="section-heading">
            <h2>クイック登録</h2>
            <p>今週末にやることだけを、最短で追加します。</p>
          </div>

          <form className="todo-form" onSubmit={handleCreate}>
            <label>
              <span>やること</span>
              <input
                type="text"
                maxLength={80}
                placeholder="洗濯、買い出し、映画、掃除..."
                required
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>

            <label>
              <span>メモ</span>
              <textarea
                maxLength={240}
                rows={3}
                placeholder="場所、持ち物、時間など"
                value={draft.note}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>

            <div className="date-row">
              <label>
                <span>予定日</span>
                <input
                  type="date"
                  required
                  value={draft.targetDate}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      targetDate: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="date-shortcuts" aria-label="日付ショートカット">
                <button type="button" onClick={() => setShortcutDate("sat")}>
                  土
                </button>
                <button type="button" onClick={() => setShortcutDate("sun")}>
                  日
                </button>
                <button type="button" onClick={() => setShortcutDate("next")}>
                  次の週末
                </button>
              </div>
            </div>

            <div className="submit-row">
              <button className="primary-button" type="submit">
                追加する
              </button>
              <p className="hint">土日以外の日付は登録できません。終了した週末分は自動で消えます。</p>
            </div>
          </form>
        </section>

        <section className="card dashboard">
          <div className="section-heading">
            <h2>週末Todo</h2>
            <p>終了した週末のTodoは自動で消えます。</p>
          </div>

          <div className="toolbar">
            <div className="filters" role="tablist" aria-label="表示フィルター">
              <button
                className={filter === "all" ? "is-active" : undefined}
                type="button"
                onClick={() => setFilter("all")}
              >
                全部
              </button>
              <button
                className={filter === "open" ? "is-active" : undefined}
                type="button"
                onClick={() => setFilter("open")}
              >
                未完了
              </button>
              <button
                className={filter === "done" ? "is-active" : undefined}
                type="button"
                onClick={() => setFilter("done")}
              >
                完了
              </button>
            </div>
            <button className="ghost-button" type="button" onClick={() => void refreshTodos()}>
              再読み込み
            </button>
            {session ? (
              <button className="ghost-button" type="button" onClick={() => void handleSignOut()}>
                ログアウト
              </button>
            ) : null}
          </div>

          {loading ? <p className="empty-state">読み込み中...</p> : null}

          {!loading && groups.length === 0 ? (
            <p className="empty-state">今週末以降のTodoはまだありません。最初の1件を追加しましょう。</p>
          ) : null}

          <div className="todo-groups">
            {groups.map((group) => {
              const saturday = new Date(`${group.key}T00:00:00`);
              const sunday = addDays(saturday, 1);

              return (
                <section className="todo-group" key={group.key}>
                  <h3>
                    {formatMonthDay(saturday)} - {formatMonthDay(sunday)}
                  </h3>
                  <p>{group.items.length}件のTodo</p>
                  <div className="todo-list">
                    {group.items.map((item) => (
                      <article
                        className={`todo-item${item.completed ? " is-done" : ""}`}
                        key={item.id}
                      >
                        <div className="todo-main">
                          <div className="todo-topline">
                            <span className="todo-date">{formatWeekday(item.target_date)}</span>
                            <span className="todo-badge">{item.completed ? "完了" : "未完了"}</span>
                          </div>
                          <h3 className="todo-title">{item.title}</h3>
                          <p className="todo-note">{item.note || "メモなし"}</p>
                        </div>
                        <div className="todo-actions">
                          <button type="button" onClick={() => void handleToggle(item)}>
                            {item.completed ? "未完了に戻す" : "完了"}
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => void handleDelete(item.id)}
                          >
                            削除
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
