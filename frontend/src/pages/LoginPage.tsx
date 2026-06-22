import { useState } from "react";
import { login, type AppUser } from "../api/orderApi";

type LoginPageProps = {
  onLogin: (user: AppUser) => void;
};

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    login(username, password)
      .then((data) => onLogin(data.user))
      .catch((err) => setError(err instanceof Error ? err.message : "登录失败"))
      .finally(() => setBusy(false));
  }

  return (
    <div className="page">
      <main className="app-shell login-shell">
        <section className="login-hero">
          <div className="brand-mark login-mark">宝</div>
          <p className="login-eyebrow">今天也要好好吃饭</p>
          <h1>宝宝专属小菜单</h1>
          <p>登录后才能点单、做饭或管理账号。</p>
        </section>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error && <div className="notice">{error}</div>}
          <button className="primary-button login-button" disabled={busy} type="submit">
            {busy ? "登录中..." : "进入小菜单"}
          </button>
        </form>
      </main>
    </div>
  );
}

export default LoginPage;
