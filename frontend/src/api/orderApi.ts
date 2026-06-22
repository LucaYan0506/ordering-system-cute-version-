export type AppRole = "order" | "cook" | "admin";

export type AppUser = {
  id: number;
  username: string;
  role: AppRole;
  roleLabel: string;
  isAdmin: boolean;
};

export type Table = {
  id: number;
  name: string;
  occupied: boolean;
};

export type Dish = {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  badge: string;
  quantity: number;
};

export type DishRequirement = {
  id: number;
  ingredient: Ingredient;
  quantity: string;
};

export type CookDish = Dish & {
  categoryName: string;
  active: boolean;
  ingredients: DishRequirement[];
};

export type Category = {
  id: number;
  name: string;
  dishes: Dish[];
};

export type CookCategory = {
  id: number;
  name: string;
  dishes: CookDish[];
};

export type Store = {
  name: string;
  subtitle: string;
  notice: string;
};

export type BasketItem = {
  id: number;
  dish: Dish;
  quantity: number;
  lineTotal: string;
};

export type Ingredient = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
};

export type IngredientCheck = {
  id: number;
  ingredient: Ingredient;
  requiredQuantity: string;
  checked: boolean;
};

export type Basket = {
  id: number | null;
  tableId: number | null;
  items: BasketItem[];
  itemCount: number;
  totalPrice: string;
};

export type PlacedOrder = {
  id: number;
  tableId: number;
  tableName: string;
  status: string;
  statusLabel: string;
  itemCount: number;
  totalPrice: string;
  numberOfPeople: number;
  allTogether: boolean;
  createdAt: string;
  items: BasketItem[];
  ingredientChecks: IngredientCheck[];
};

export type MenuResponse = {
  store: Store;
  categories: Category[];
  basket: Basket;
};

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.msg ?? "请求失败，请稍后再试");
  }
  return data as T;
}

export function getTables() {
  return fetchJson<{ tables: Table[] }>("/tables/");
}

export function getSession() {
  return fetchJson<{ authenticated: boolean; user: AppUser | null }>("/auth/session/");
}

export function login(username: string, password: string) {
  return fetchJson<{ user: AppUser }>("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout() {
  return fetchJson<{ ok: boolean }>("/auth/logout/", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function getMenu(tableId: number) {
  return fetchJson<MenuResponse>(`/menu/?table=${tableId}`);
}

export function updateBasket(tableId: number, dishId: number, quantity: number) {
  return fetchJson<{ basket: Basket }>("/basket/update/", {
    method: "POST",
    body: JSON.stringify({ tableId, dishId, quantity }),
  });
}

export function clearBasket(tableId: number) {
  return fetchJson<{ basket: Basket }>("/basket/clear/", {
    method: "POST",
    body: JSON.stringify({ tableId }),
  });
}

export function placeOrder(tableId: number, numberOfPeople: number, allTogether: boolean) {
  return fetchJson<{ order: PlacedOrder; basket: Basket }>("/order/", {
    method: "POST",
    body: JSON.stringify({ tableId, numberOfPeople, allTogether }),
  });
}

export function getOrders(tableId: number) {
  return fetchJson<{ orders: PlacedOrder[] }>(`/orders/?table=${tableId}`);
}

export function getAllOrders() {
  return fetchJson<{ orders: PlacedOrder[] }>("/orders/all/");
}

export function getCookIngredients() {
  return fetchJson<{ ingredients: Ingredient[] }>("/cook/ingredients/");
}

export function createIngredient(name: string, quantity: string, unit: string) {
  return fetchJson<{ ingredient: Ingredient }>("/cook/ingredients/", {
    method: "POST",
    body: JSON.stringify({ name, quantity, unit }),
  });
}

export function updateIngredient(ingredient: Ingredient) {
  return fetchJson<{ ingredient: Ingredient }>(`/cook/ingredients/${ingredient.id}/`, {
    method: "POST",
    body: JSON.stringify({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
    }),
  });
}

export function deleteIngredient(ingredientId: number) {
  return fetchJson<{ ok: boolean }>(`/cook/ingredients/${ingredientId}/`, {
    method: "DELETE",
  });
}

export type CreateDishIngredientInput = {
  ingredientId?: number;
  name?: string;
  quantity: string;
  unit?: string;
  stockQuantity?: string;
};

export type CreateDishInput = {
  name: string;
  categoryName: string;
  description: string;
  price: string;
  badge: string;
  ingredients: CreateDishIngredientInput[];
};

export function getCookDishes() {
  return fetchJson<{ categories: CookCategory[] }>("/cook/dishes/");
}

export function createDish(dish: CreateDishInput) {
  return fetchJson<{ dish: CookDish; ingredients: Ingredient[] }>("/cook/dishes/", {
    method: "POST",
    body: JSON.stringify(dish),
  });
}

export function toggleIngredientCheck(checkId: number, checked: boolean) {
  return fetchJson<{ order: PlacedOrder }>(`/cook/checks/${checkId}/`, {
    method: "POST",
    body: JSON.stringify({ checked }),
  });
}

export function updateOrderStatus(orderId: number, status: string) {
  return fetchJson<{ order: PlacedOrder }>(`/cook/orders/${orderId}/status/`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function getAdminAccounts() {
  return fetchJson<{ accounts: AppUser[] }>("/admin/accounts/");
}

export function createAccount(username: string, password: string, role: AppRole) {
  return fetchJson<{ account: AppUser }>("/admin/accounts/create/", {
    method: "POST",
    body: JSON.stringify({ username, password, role }),
  });
}

export function updateAccountRole(userId: number, role: AppRole) {
  return fetchJson<{ account: AppUser }>(`/admin/accounts/${userId}/role/`, {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}
