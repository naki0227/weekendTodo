# Weekend Todo

週末にやるTodoだけを素早く登録して、スマホでもPCでも見やすく管理するための `React + TypeScript + Supabase Auth + Vercel` 向けアプリです。

## できること

- 土日だけ登録できるTodo
- その週末が終わると自動で消えるTodo
- 週末ごとの見やすい表示
- Supabase Authでログイン
- Supabaseを使ったユーザーごとのスマホ/PC共有
- Capacitorでネイティブ化しやすい構成

## まず試す

1. 依存を入れる

```bash
npm install
```

2. 環境変数を作る

```bash
cp .env.example .env
```

3. `.env` に Supabase 情報を入れる

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. 開発サーバーを起動する

```bash
npm run dev
```

## スマホとPCで同期する設定

1. Supabaseで新しいプロジェクトを作る
2. SQL Editorで [supabase/schema.sql](./supabase/schema.sql) の内容を実行する
3. `Authentication > URL Configuration` で以下を設定する

```text
Site URL:
http://localhost:5173

Redirect URLs:
http://localhost:5173
https://YOUR-PROJECT.vercel.app
https://YOUR-CUSTOM-DOMAIN
```

4. `.env` に URL と anon key を入れる

設定後に配信すれば、同じURLをスマホとPCで開いて共有できます。

補足:

- アプリ起動時に、終了した週末のTodoは自動削除されます
- つまり月曜以降は、前の土日分は一覧から消えます

## 公開方法

### Vercel

1. GitHubにこのリポジトリをpush
2. Vercelで `naki0227/weekendTodo` をImport
3. Build command を `npm run build`
4. Output Directory を `dist`
5. Environment Variables に以下を設定

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

6. デプロイ後、発行された `https://...vercel.app` を Supabase の Redirect URLs に追加

補足:

- ログイン基盤は Vercel ではなく Supabase Auth です
- カスタムドメインを使う場合も、そのURLを Supabase の Redirect URLs に追加してください

## ネイティブアプリ化する場合

この構成は `Capacitor` でiPhone/Androidアプリ化しやすいようにしてあります。

1. 依存を入れる

```bash
npm install
```

2. iOS / Android プロジェクトを追加

```bash
npx cap add ios
npx cap add android
```

3. Web資産をコピーしてIDEで開く

```bash
npx cap copy
npx cap open ios
npx cap open android
```

注意:

- いまはReactアプリをそのままネイティブWebViewで包む構成です
- 共有データはSupabaseを使うので、アプリ化してもスマホとPCで同じTodoを見られます
- ネイティブの通知やカレンダー連携を後から足しやすい土台です
