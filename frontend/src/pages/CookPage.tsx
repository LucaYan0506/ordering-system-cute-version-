import { useEffect, useState, type FormEvent } from "react";
import { affection } from "../api/affection";
import {
  createDish,
  createIngredient,
  deleteIngredient,
  getAllOrders,
  getCookDishes,
  getCookIngredients,
  logout,
  toggleIngredientCheck,
  updateIngredient,
  updateOrderStatus,
  type AppUser,
  type CookCategory,
  type CreateDishInput,
  type Ingredient,
  type PlacedOrder,
} from "../api/orderApi";

type CookPageProps = {
  user: AppUser;
  onLogout: () => void;
};

type KitchenTab = "orders" | "ingredients" | "dishes";

type IngredientDraft = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
};

type DishIngredientDraft = {
  rowId: string;
  ingredientId: string;
  name: string;
  quantity: string;
  unit: string;
  stockQuantity: string;
};

type DishForm = Omit<CreateDishInput, "ingredients"> & {
  ingredients: DishIngredientDraft[];
};

const cookStatusRank: Record<string, number> = {
  placed: 0,
  ingredients_ready: 1,
  cooking: 2,
  done: 3,
};

function newIngredientRow(): DishIngredientDraft {
  return {
    rowId: `${Date.now()}-${Math.random()}`,
    ingredientId: "",
    name: "",
    quantity: "1",
    unit: "份",
    stockQuantity: "0",
  };
}

function newDishForm(): DishForm {
  return {
    name: "",
    categoryName: "推荐",
    description: "",
    price: "9",
    badge: "新品",
    ingredients: [newIngredientRow()],
  };
}

function draftMap(items: Ingredient[]): Record<number, IngredientDraft> {
  const next: Record<number, IngredientDraft> = {};
  items.forEach((item) => {
    next[item.id] = { ...item };
  });
  return next;
}

function CookPage({ user, onLogout }: CookPageProps) {
  const [activeTab, setActiveTab] = useState<KitchenTab>("orders");
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [ingredientDrafts, setIngredientDrafts] = useState<Record<number, IngredientDraft>>({});
  const [cookCategories, setCookCategories] = useState<CookCategory[]>([]);
  const [newIngredient, setNewIngredient] = useState({ name: "", quantity: "0", unit: "份" });
  const [dishForm, setDishForm] = useState<DishForm>(newDishForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function refreshOrders() {
    return getAllOrders().then((data) => setOrders(data.orders));
  }

  function refreshKitchenData() {
    return Promise.all([getCookIngredients(), getCookDishes()]).then(([ingredientData, dishData]) => {
      const categoryNames = dishData.categories.map((category) => category.name);
      setIngredients(ingredientData.ingredients);
      setIngredientDrafts(draftMap(ingredientData.ingredients));
      setCookCategories(dishData.categories);
      setDishForm((current) =>
        categoryNames.includes(current.categoryName)
          ? current
          : { ...current, categoryName: categoryNames[0] ?? "" },
      );
    });
  }

  function refresh() {
    setLoading(true);
    setError("");
    Promise.all([refreshOrders(), refreshKitchenData()])
      .catch((err) => setError(err instanceof Error ? err.message : "做饭台加载失败"))
      .finally(() => setLoading(false));
  }

  function replaceOrder(nextOrder: PlacedOrder) {
    setOrders((current) => current.map((order) => (order.id === nextOrder.id ? nextOrder : order)));
  }

  function handleToggle(checkId: number, checked: boolean) {
    setOrders((current) =>
      current.map((order) => ({
        ...order,
        ingredientChecks: order.ingredientChecks.map((check) =>
          check.id === checkId ? { ...check, checked } : check,
        ),
      })),
    );
    toggleIngredientCheck(checkId, checked)
      .then((data) => replaceOrder(data.order))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "食材勾选失败");
        refreshOrders();
      });
  }

  function handleStatus(orderId: number, status: string) {
    updateOrderStatus(orderId, status)
      .then((data) => replaceOrder(data.order))
      .catch((err) => setError(err instanceof Error ? err.message : "状态更新失败"));
  }

  function handleLogout() {
    logout().finally(onLogout);
  }

  function changeIngredientDraft(id: number, key: keyof IngredientDraft, value: string) {
    setIngredientDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? ingredients.find((item) => item.id === id)!),
        [key]: value,
      },
    }));
  }

  function handleCreateIngredient(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    createIngredient(newIngredient.name, newIngredient.quantity, newIngredient.unit)
      .then((data) => {
        setIngredients((current) => [...current, data.ingredient]);
        setIngredientDrafts((current) => ({ ...current, [data.ingredient.id]: data.ingredient }));
        setNewIngredient({ name: "", quantity: "0", unit: "份" });
        setMessage("食材加好啦");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "新增食材失败"));
  }

  function handleSaveIngredient(id: number) {
    const draft = ingredientDrafts[id];
    if (!draft) return;
    setError("");
    setMessage("");
    updateIngredient(draft)
      .then((data) => {
        setIngredients((current) => current.map((item) => (item.id === id ? data.ingredient : item)));
        setIngredientDrafts((current) => ({ ...current, [id]: data.ingredient }));
        setMessage("食材更新啦");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "保存食材失败"));
  }

  function handleDeleteIngredient(ingredient: Ingredient) {
    if (!window.confirm(`删掉 ${ingredient.name} 吗？`)) return;
    setError("");
    setMessage("");
    deleteIngredient(ingredient.id)
      .then(() => {
        setIngredients((current) => current.filter((item) => item.id !== ingredient.id));
        setIngredientDrafts((current) => {
          const next = { ...current };
          delete next[ingredient.id];
          return next;
        });
        refreshKitchenData();
        setMessage("食材删掉啦");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "删除食材失败"));
  }

  function updateDishField<K extends keyof DishForm>(key: K, value: DishForm[K]) {
    setDishForm((current) => ({ ...current, [key]: value }));
  }

  function updateDishIngredient(rowId: string, updates: Partial<DishIngredientDraft>) {
    setDishForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((row) => (row.rowId === rowId ? { ...row, ...updates } : row)),
    }));
  }

  function handleCreateDish(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");

    const payload: CreateDishInput = {
      ...dishForm,
      ingredients: dishForm.ingredients.map((row) =>
        row.ingredientId
          ? { ingredientId: Number(row.ingredientId), quantity: row.quantity }
          : {
              name: row.name,
              quantity: row.quantity,
              unit: row.unit,
              stockQuantity: row.stockQuantity,
            },
      ),
    };

    createDish(payload)
      .then((data) => {
        setIngredients(data.ingredients);
        setIngredientDrafts(draftMap(data.ingredients));
        return getCookDishes();
      })
      .then((data) => {
        setCookCategories(data.categories);
        setDishForm(newDishForm());
        setMessage("新品加到菜单啦");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "新增菜品失败"));
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => {
      refreshOrders().catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const categoryOptions = cookCategories.map((category) => category.name);

  return (
    <div className="page">
      <div className="app-shell">
        <header className="app-header order-desk-header">
          <div className="brand-row">
            <div className="brand-mark">厨</div>
            <div className="store-copy">
              <h1>宝贝的专属</h1>
              <p>{user.username} · 做饭账号</p>
            </div>
            <button className="switch-role-button" onClick={handleLogout} type="button">
              退出
            </button>
          </div>
        </header>

        <nav className="kitchen-tabs">
          <button className={activeTab === "orders" ? "active" : ""} onClick={() => setActiveTab("orders")} type="button">
            订单
          </button>
          <button
            className={activeTab === "ingredients" ? "active" : ""}
            onClick={() => setActiveTab("ingredients")}
            type="button"
          >
            食材
          </button>
          <button className={activeTab === "dishes" ? "active" : ""} onClick={() => setActiveTab("dishes")} type="button">
            菜品
          </button>
        </nav>

        <main className="orders-page">
          <div className="promo-card compact">
            <div className="promo-eyebrow">做饭模式</div>
            <h2>{orders.length > 0 ? "有新投喂" : "现在很安静"}</h2>
            <p>{loading ? "刷新中..." : "小厨房今日营业中"}</p>
          </div>

          <button className="refresh-button" onClick={refresh} type="button">
            刷新
          </button>

          {message && <div className="success-note">{message}</div>}
          {error && <div className="notice">{error}</div>}

          {activeTab === "orders" && (
            <>
              {orders.length === 0 ? (
                <div className="empty-state">还没有订单，可以先去点单</div>
              ) : (
                orders.map((order) => (
                  <article className="order-card" key={order.id}>
                    <div className="order-card-header">
                      <strong>{order.tableName} · 订单 #{order.id}</strong>
                      <span>
                        {order.statusLabel} · {affection(order.totalPrice)}
                      </span>
                    </div>
                    <div className="status-steps kitchen-status">
                      <span className="done">收到啦</span>
                      <span className={(cookStatusRank[order.status] ?? 0) >= 1 ? "done" : ""}>食材已备好</span>
                      <span className={(cookStatusRank[order.status] ?? 0) >= 2 ? "done" : ""}>准备中</span>
                      <span className={(cookStatusRank[order.status] ?? 0) >= 3 ? "done" : ""}>等抱抱</span>
                    </div>

                    {order.items.map((item) => (
                      <div className="order-line" key={`${order.id}-${item.dish.id}`}>
                        <span>{item.dish.name}</span>
                        <b>x {item.quantity}</b>
                      </div>
                    ))}

                    <div className="checklist">
                      <h3>食材检查</h3>
                      {order.ingredientChecks.length === 0 ? (
                        <div className="empty-state small">这个订单还没有设置食材</div>
                      ) : (
                        order.ingredientChecks.map((check) => (
                          <label className="check-row" key={check.id}>
                            <input
                              checked={check.checked}
                              onChange={(event) => handleToggle(check.id, event.target.checked)}
                              type="checkbox"
                            />
                            <span>{check.ingredient.name}</span>
                            <b>
                              {check.requiredQuantity}
                              {check.ingredient.unit}
                            </b>
                          </label>
                        ))
                      )}
                    </div>

                    <div className="status-actions">
                      <button onClick={() => handleStatus(order.id, "cooking")} type="button">
                        开始做了
                      </button>
                      <button onClick={() => handleStatus(order.id, "done")} type="button">
                        做好啦
                      </button>
                    </div>
                  </article>
                ))
              )}
            </>
          )}

          {activeTab === "ingredients" && (
            <>
              <form className="kitchen-form" onSubmit={handleCreateIngredient}>
                <h2>新增食材</h2>
                <div className="form-grid three">
                  <label>
                    <span>名字</span>
                    <input
                      value={newIngredient.name}
                      onChange={(event) => setNewIngredient((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>数量</span>
                    <input
                      value={newIngredient.quantity}
                      onChange={(event) => setNewIngredient((current) => ({ ...current, quantity: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>单位</span>
                    <input
                      value={newIngredient.unit}
                      onChange={(event) => setNewIngredient((current) => ({ ...current, unit: event.target.value }))}
                    />
                  </label>
                </div>
                <button className="primary-button" type="submit">
                  加食材
                </button>
              </form>

              <section className="inventory-panel">
                <h2>食材库存</h2>
                <div className="editable-list">
                  {ingredients.map((ingredient) => {
                    const draft = ingredientDrafts[ingredient.id] ?? ingredient;
                    return (
                      <article className="edit-row" key={ingredient.id}>
                        <div className="form-grid three">
                          <label>
                            <span>名字</span>
                            <input
                              value={draft.name}
                              onChange={(event) => changeIngredientDraft(ingredient.id, "name", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>数量</span>
                            <input
                              value={draft.quantity}
                              onChange={(event) => changeIngredientDraft(ingredient.id, "quantity", event.target.value)}
                            />
                          </label>
                          <label>
                            <span>单位</span>
                            <input
                              value={draft.unit}
                              onChange={(event) => changeIngredientDraft(ingredient.id, "unit", event.target.value)}
                            />
                          </label>
                        </div>
                        <div className="row-actions">
                          <button onClick={() => handleSaveIngredient(ingredient.id)} type="button">
                            保存
                          </button>
                          <button onClick={() => handleDeleteIngredient(ingredient)} type="button">
                            删除
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {activeTab === "dishes" && (
            <>
              <form className="kitchen-form" onSubmit={handleCreateDish}>
                <h2>新增菜品</h2>
                <label>
                  <span>菜名</span>
                  <input value={dishForm.name} onChange={(event) => updateDishField("name", event.target.value)} />
                </label>
                <div className="form-grid two">
                  <label>
                    <span>分类</span>
                    <select
                      value={dishForm.categoryName}
                      onChange={(event) => updateDishField("categoryName", event.target.value)}
                    >
                      {categoryOptions.map((categoryName) => (
                        <option key={categoryName} value={categoryName}>
                          {categoryName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>价格</span>
                    <input value={dishForm.price} onChange={(event) => updateDishField("price", event.target.value)} />
                  </label>
                </div>
                <div className="form-grid two">
                  <label>
                    <span>小标</span>
                    <input value={dishForm.badge} onChange={(event) => updateDishField("badge", event.target.value)} />
                  </label>
                </div>
                <label>
                  <span>描述</span>
                  <input
                    value={dishForm.description}
                    onChange={(event) => updateDishField("description", event.target.value)}
                  />
                </label>
                <div className="dish-ingredient-editor">
                  <h3>食材</h3>
                  {dishForm.ingredients.map((row, index) => (
                    <article className="dish-ingredient-row" key={row.rowId}>
                      <div className="form-grid two">
                        <label>
                          <span>食材</span>
                          <select
                            value={row.ingredientId || "__new__"}
                            onChange={(event) =>
                              updateDishIngredient(row.rowId, {
                                ingredientId: event.target.value === "__new__" ? "" : event.target.value,
                              })
                            }
                          >
                            <option value="__new__">新食材</option>
                            {ingredients.map((ingredient) => (
                              <option key={ingredient.id} value={ingredient.id}>
                                {ingredient.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>每份用量</span>
                          <input
                            value={row.quantity}
                            onChange={(event) => updateDishIngredient(row.rowId, { quantity: event.target.value })}
                          />
                        </label>
                      </div>

                      {!row.ingredientId && (
                        <div className="form-grid three">
                          <label>
                            <span>新名字</span>
                            <input
                              value={row.name}
                              onChange={(event) => updateDishIngredient(row.rowId, { name: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>库存</span>
                            <input
                              value={row.stockQuantity}
                              onChange={(event) =>
                                updateDishIngredient(row.rowId, { stockQuantity: event.target.value })
                              }
                            />
                          </label>
                          <label>
                            <span>单位</span>
                            <input
                              value={row.unit}
                              onChange={(event) => updateDishIngredient(row.rowId, { unit: event.target.value })}
                            />
                          </label>
                        </div>
                      )}

                      <button
                        className="tiny-link-button"
                        onClick={() =>
                          setDishForm((current) => ({
                            ...current,
                            ingredients:
                              current.ingredients.length === 1
                                ? current.ingredients
                                : current.ingredients.filter((item) => item.rowId !== row.rowId),
                          }))
                        }
                        type="button"
                      >
                        删除第 {index + 1} 个
                      </button>
                    </article>
                  ))}
                  <button
                    className="secondary-button"
                    onClick={() =>
                      setDishForm((current) => ({ ...current, ingredients: [...current.ingredients, newIngredientRow()] }))
                    }
                    type="button"
                  >
                    加一行食材
                  </button>
                </div>

                <button className="primary-button" type="submit">
                  加到菜单
                </button>
              </form>

              <section className="inventory-panel">
                <h2>现有菜品</h2>
                {cookCategories.map((category) => (
                  <div className="dish-group" key={category.id}>
                    <h3>{category.name}</h3>
                    {category.dishes.map((dish) => (
                      <article className="dish-manage-card" key={dish.id}>
                        <div>
                          <strong>{dish.name}</strong>
                          <span>
                            {dish.badge || "菜单"} · {affection(dish.price)}
                          </span>
                        </div>
                        <p>{dish.description}</p>
                        <div className="mini-chip-row">
                          {dish.ingredients.map((requirement) => (
                            <span key={requirement.id}>
                              {requirement.ingredient.name} {requirement.quantity}
                              {requirement.ingredient.unit}
                            </span>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                ))}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default CookPage;
