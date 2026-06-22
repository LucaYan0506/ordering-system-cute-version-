import { useEffect, useMemo, useState } from "react";
import { affection } from "../api/affection";
import {
  clearBasket,
  getSession,
  getMenu,
  getOrders,
  getTables,
  logout,
  placeOrder,
  updateBasket,
  type AppUser,
  type Basket,
  type Category,
  type Dish,
  type PlacedOrder,
  type Store,
  type Table,
} from "../api/orderApi";
import CartBar from "../components/CartBar";
import CategoryRail from "../components/CategoryRail";
import CheckoutSheet from "../components/CheckoutSheet";
import ProductCard from "../components/ProductCard";
import AdminPage from "./AdminPage";
import CookPage from "./CookPage";
import LoginPage from "./LoginPage";

const emptyBasket: Basket = {
  id: null,
  tableId: null,
  items: [],
  itemCount: 0,
  totalPrice: "0.00",
};

const emptyStore: Store = {
  name: "宝宝专属小菜单",
  subtitle: "想吃什么就点什么 · 用亲亲抱抱结算",
  notice: "今天要吃点甜甜的",
};

const customerStatusRank: Record<string, number> = {
  placed: 0,
  ingredients_ready: 0,
  cooking: 1,
  done: 2,
};

function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tables, setTables] = useState<Table[]>([]);
  const [tableId, setTableId] = useState<number | null>(null);
  const [store, setStore] = useState<Store>(emptyStore);
  const [categories, setCategories] = useState<Category[]>([]);
  const [basket, setBasket] = useState<Basket>(emptyBasket);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"menu" | "orders">("menu");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function handleLogout() {
    logout().finally(() => setUser(null));
  }

  useEffect(() => {
    getSession()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (user?.role !== "order") return;
    getTables()
      .then((data) => {
        setTables(data.tables);
        setTableId((current) => current ?? data.tables[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }, [user]);

  useEffect(() => {
    if (tableId === null) return;
    refreshMenu(tableId);
  }, [tableId]);

  useEffect(() => {
    if (user?.role !== "order" || tableId === null) return;
    const timer = window.setInterval(() => {
      getOrders(tableId)
        .then((data) => setOrders(data.orders))
        .catch((err) => setError(err.message));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [tableId, user]);

  function refreshMenu(nextTableId = tableId) {
    if (nextTableId === null) return;
    setError("");
    Promise.all([getMenu(nextTableId), getOrders(nextTableId)])
      .then(([menuData, orderData]) => {
        setStore(menuData.store);
        setCategories(menuData.categories);
        setBasket(menuData.basket);
        setOrders(orderData.orders);
        setActiveCategoryId((current) => current ?? menuData.categories[0]?.id ?? null);
      })
      .catch((err) => setError(err.message));
  }

  function setDishQuantity(dishId: number, quantity: number) {
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        dishes: category.dishes.map((dish) => (dish.id === dishId ? { ...dish, quantity } : dish)),
      })),
    );
  }

  async function handleQuantityChange(dish: Dish, quantity: number) {
    if (tableId === null) return;
    setBusy(true);
    setError("");
    setDishQuantity(dish.id, quantity);
    try {
      const data = await updateBasket(tableId, dish.id, quantity);
      setBasket(data.basket);
    } catch (err) {
      setDishQuantity(dish.id, dish.quantity);
      setError(err instanceof Error ? err.message : "更新购物袋失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleClearBasket() {
    if (tableId === null) return;
    setBusy(true);
    try {
      const data = await clearBasket(tableId);
      setBasket(data.basket);
      setCategories((current) =>
        current.map((category) => ({
          ...category,
          dishes: category.dishes.map((dish) => ({ ...dish, quantity: 0 })),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "清空失败");
    } finally {
      setBusy(false);
    }
  }

  async function handlePlaceOrder(people: number, allTogether: boolean) {
    if (tableId === null) return;
    setBusy(true);
    setError("");
    try {
      const data = await placeOrder(tableId, people, allTogether);
      setBasket(data.basket);
      setOrders((current) => {
        const hasOrder = current.some((order) => order.id === data.order.id);
        if (hasOrder) {
          return current.map((order) => (order.id === data.order.id ? data.order : order));
        }
        return [data.order, ...current];
      });
      setCategories((current) =>
        current.map((category) => ({
          ...category,
          dishes: category.dishes.map((dish) => ({ ...dish, quantity: 0 })),
        })),
      );
      setSheetOpen(false);
      setActiveTab("orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "下单失败");
    } finally {
      setBusy(false);
    }
  }

  const visibleCategories = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return categories;
    return categories
      .map((category) => ({
        ...category,
        dishes: category.dishes.filter((dish) =>
          `${dish.name} ${dish.description} ${dish.badge}`.toLowerCase().includes(keyword),
        ),
      }))
      .filter((category) => category.dishes.length > 0);
  }, [categories, search]);

  const activeCategory = visibleCategories.find((category) => category.id === activeCategoryId) ?? visibleCategories[0];
  const activeDishes = activeCategory?.dishes ?? [];

  if (!authChecked) {
    return (
      <div className="page">
        <main className="app-shell login-shell">
          <div className="empty-state">正在看看是谁来了...</div>
        </main>
      </div>
    );
  }

  if (user === null) {
    return <LoginPage onLogin={setUser} />;
  }

  if (user.role === "cook") {
    return <CookPage user={user} onLogout={() => setUser(null)} />;
  }

  if (user.role === "admin") {
    return <AdminPage user={user} onLogout={() => setUser(null)} />;
  }

  return (
    <div className="page">
      <div className="app-shell">
        <header className="app-header">
          <div className="brand-row">
            <div className="brand-mark">啵</div>
            <div className="store-copy">
              <h1>{store.name}</h1>
              <p>{store.subtitle}</p>
            </div>
            <select
              className="table-select"
              value={tableId ?? ""}
              onChange={(event) => setTableId(Number(event.target.value))}
              aria-label="选择桌号"
            >
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
            <button className="switch-role-button compact-switch" onClick={handleLogout} type="button">
              退
            </button>
          </div>

          <label className="search-row">
            <span />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜果茶、布丁、冰豆花"
            />
          </label>

          <div className="coupon-strip">
            <span>今天多抱抱</span>
            <span>不许饿肚子</span>
            <span>甜甜补给</span>
          </div>
        </header>

        <nav className="top-tabs">
          <button className={activeTab === "menu" ? "active" : ""} onClick={() => setActiveTab("menu")} type="button">
            点单
          </button>
          <button className={activeTab === "orders" ? "active" : ""} onClick={() => setActiveTab("orders")} type="button">
            我的单
          </button>
        </nav>

        {error && <div className="notice">{error}</div>}

        {activeTab === "menu" ? (
          <main className="order-layout">
            <CategoryRail
              categories={visibleCategories}
              activeId={activeCategory?.id ?? null}
              onSelect={setActiveCategoryId}
            />

            <section className="menu-list">
              <div className="promo-card">
                <div className="promo-eyebrow">今日想吃</div>
                <h2>{store.notice}</h2>
                <p>清爽果香，满杯脆啵啵</p>
              </div>

              <div className="section-title">{activeCategory?.name ?? "菜单"}</div>
              {activeDishes.length === 0 ? (
                <div className="empty-state">没有找到这一口</div>
              ) : (
                activeDishes.map((dish) => (
                  <ProductCard key={dish.id} dish={dish} onQuantityChange={handleQuantityChange} />
                ))
              )}
            </section>
          </main>
        ) : (
          <main className="orders-page">
            <div className="promo-card compact">
              <div className="promo-eyebrow">制作进度</div>
              <h2>老板收到啦</h2>
              <p>做好后就可以来取餐</p>
            </div>
            {orders.length === 0 ? (
              <div className="empty-state">还没有下单</div>
            ) : (
              orders.map((order) => {
                const statusRank = customerStatusRank[order.status] ?? 0;
                return (
                  <article className="order-card" key={order.id}>
                    <div className="order-card-header">
                      <strong>订单 #{order.id}</strong>
                      <span>
                        {order.statusLabel} · {affection(order.totalPrice)}
                      </span>
                    </div>
                    <div className="status-steps">
                      <span className="done">已收到</span>
                      <span className={statusRank >= 1 ? "done" : ""}>准备中</span>
                      <span className={statusRank >= 2 ? "done" : ""}>等抱抱</span>
                    </div>
                    {order.items.map((item) => (
                      <div className="order-line" key={`${order.id}-${item.dish.id}`}>
                        <span>{item.dish.name}</span>
                        <b>x {item.quantity}</b>
                      </div>
                    ))}
                  </article>
                );
              })
            )}
          </main>
        )}

        <CartBar basket={basket} onOpen={() => setSheetOpen(true)} />
        <CheckoutSheet
          basket={basket}
          open={sheetOpen}
          busy={busy}
          onClose={() => setSheetOpen(false)}
          onClear={handleClearBasket}
          onSubmit={handlePlaceOrder}
        />
      </div>
    </div>
  );
}

export default App;
