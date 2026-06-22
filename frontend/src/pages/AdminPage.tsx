import { useEffect, useState } from "react";
import {
  createAccount,
  getAdminAccounts,
  logout,
  updateAccountRole,
  type AppRole,
  type AppUser,
} from "../api/orderApi";

type AdminPageProps = {
  user: AppUser;
  onLogout: () => void;
};

const roleOptions: { value: AppRole; label: string }[] = [
  { value: "order", label: "点单" },
  { value: "cook", label: "做饭" },
  { value: "admin", label: "管理" },
];

function AdminPage({ user, onLogout }: AdminPageProps) {
  const [accounts, setAccounts] = useState<AppUser[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("order");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function refreshAccounts() {
    setError("");
    getAdminAccounts()
      .then((data) => setAccounts(data.accounts))
      .catch((err) => setError(err instanceof Error ? err.message : "账号加载失败"));
  }

  function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    createAccount(username, password, role)
      .then((data) => {
        setAccounts((current) => [...current, data.account].sort((a, b) => a.username.localeCompare(b.username)));
        setUsername("");
        setPassword("");
        setRole("order");
        setMessage("账号创建好了");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "创建失败"));
  }

  function handleRoleChange(account: AppUser, nextRole: AppRole) {
    updateAccountRole(account.id, nextRole)
      .then((data) => {
        setAccounts((current) => current.map((item) => (item.id === data.account.id ? data.account : item)));
        setMessage(`${account.username} 已改成 ${data.account.roleLabel}`);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "角色修改失败"));
  }

  function handleLogout() {
    logout().finally(onLogout);
  }

  useEffect(() => {
    refreshAccounts();
  }, []);

  return (
    <div className="page">
      <div className="app-shell">
        <header className="app-header order-desk-header">
          <div className="brand-row">
            <div className="brand-mark">管</div>
            <div className="store-copy">
              <h1>账号管理</h1>
              <p>{user.username} · 管理账号</p>
            </div>
            <button className="switch-role-button" onClick={handleLogout} type="button">
              退出
            </button>
          </div>
        </header>

        <main className="orders-page">
          <form className="admin-form" onSubmit={handleCreate}>
            <h2>创建账号</h2>
            <label>
              <span>账号</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label>
              <span>密码</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
              />
            </label>
            <label>
              <span>角色</span>
              <select value={role} onChange={(event) => setRole(event.target.value as AppRole)}>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              创建
            </button>
          </form>

          {message && <div className="success-note">{message}</div>}
          {error && <div className="notice">{error}</div>}

          <section className="account-list">
            <h2>已有账号</h2>
            {accounts.map((account) => (
              <div className="account-row" key={account.id}>
                <div>
                  <strong>{account.username}</strong>
                  <span>{account.roleLabel}</span>
                </div>
                <select value={account.role} onChange={(event) => handleRoleChange(account, event.target.value as AppRole)}>
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}

export default AdminPage;
