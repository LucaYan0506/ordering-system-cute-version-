import json
from decimal import Decimal
from functools import wraps

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import (
    Category,
    Dish,
    DishIngredient,
    Ingredient,
    KitchenTicket,
    Order,
    OrderIngredientCheck,
    OrderItem,
    Table,
    UserProfile,
)


ROLE_LABELS = {
    UserProfile.Role.ORDER: "点单",
    UserProfile.Role.COOK: "做饭",
    UserProfile.Role.ADMIN: "管理",
}


STATUS_LABELS = {
    Order.Status.DRAFT: "购物袋",
    Order.Status.PLACED: "已下单",
    Order.Status.INGREDIENTS_READY: "食材已备好",
    Order.Status.COOKING: "准备中",
    Order.Status.DONE: "等抱抱",
}


def money(value):
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    return f"{Decimal(value):.2f}"


def json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return None


def profile_for(user):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


def serialize_user(user):
    profile = profile_for(user)
    return {
        "id": user.pk,
        "username": user.username,
        "role": profile.role,
        "roleLabel": ROLE_LABELS.get(profile.role, profile.role),
        "isAdmin": profile.role == UserProfile.Role.ADMIN,
    }


def require_roles(*roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({"msg": "请先登录。"}, status=401)

            role = profile_for(request.user).role
            if role != UserProfile.Role.ADMIN and role not in roles:
                return JsonResponse({"msg": "这个账号没有权限访问这里。"}, status=403)

            return view_func(request, *args, **kwargs)

        return wrapper

    return decorator


def get_table(table_id):
    if not table_id:
        return None
    try:
        return Table.objects.get(pk=table_id, available=True)
    except Table.DoesNotExist:
        return None


def get_or_create_basket(table):
    basket = Order.objects.filter(table=table, ordered=False, paid=False).first()
    if basket is None:
        basket = Order.objects.create(table=table, ordered=False, paid=False, status=Order.Status.DRAFT)
    return basket


def get_basket(table):
    return Order.objects.filter(table=table, ordered=False, paid=False).first()


def dish_image_url(request, dish):
    if not dish.image:
        return ""
    return request.build_absolute_uri(dish.image.url)


def decimal_from_data(value, field_name, *, allow_zero=True):
    try:
        parsed = Decimal(str(value))
    except Exception as exc:
        raise ValueError(f"{field_name}要填数字。") from exc

    if parsed < 0:
        raise ValueError(f"{field_name}不能小于 0。")
    if parsed == 0 and not allow_zero:
        raise ValueError(f"{field_name}不能等于 0。")
    return parsed


def serialize_dish(request, dish, quantity=0):
    return {
        "id": dish.pk,
        "categoryId": dish.category_id,
        "categoryName": dish.category.name,
        "name": dish.name,
        "description": dish.description,
        "price": money(dish.price),
        "imageUrl": dish_image_url(request, dish),
        "badge": dish.badge,
        "quantity": quantity,
    }


def serialize_ingredient(ingredient):
    return {
        "id": ingredient.pk,
        "name": ingredient.name,
        "quantity": money(ingredient.quantity),
        "unit": ingredient.unit,
    }


def serialize_dish_requirement(requirement):
    return {
        "id": requirement.pk,
        "ingredient": serialize_ingredient(requirement.ingredient),
        "quantity": money(requirement.quantity),
    }


def serialize_cook_dish(request, dish):
    payload = serialize_dish(request, dish)
    payload.update(
        {
            "categoryName": dish.category.name,
            "active": dish.active,
            "ingredients": [
                serialize_dish_requirement(requirement)
                for requirement in dish.ingredients.select_related("ingredient")
            ],
        }
    )
    return payload


def serialize_ingredient_check(check):
    return {
        "id": check.pk,
        "ingredient": serialize_ingredient(check.ingredient),
        "requiredQuantity": money(check.required_quantity),
        "checked": check.checked,
    }


def serialize_basket(request, basket):
    if basket is None:
        return {
            "id": None,
            "tableId": None,
            "items": [],
            "itemCount": 0,
            "totalPrice": "0.00",
        }

    items = []
    for item in basket.items.select_related("dish", "dish__category"):
        items.append(
            {
                "id": item.pk,
                "dish": serialize_dish(request, item.dish, item.quantity),
                "quantity": item.quantity,
                "lineTotal": money(item.line_total),
            }
        )

    return {
        "id": basket.pk,
        "tableId": basket.table_id,
        "items": items,
        "itemCount": basket.item_count,
        "totalPrice": money(basket.total_price),
    }


def serialize_order(request, order):
    return {
        "id": order.pk,
        "tableId": order.table_id,
        "tableName": order.table.name,
        "status": order.status,
        "statusLabel": STATUS_LABELS.get(order.status, order.status),
        "itemCount": order.item_count,
        "totalPrice": money(order.total_price),
        "numberOfPeople": order.number_of_people,
        "allTogether": order.all_together,
        "createdAt": order.created_at.isoformat(),
        "items": [
            {
                "dish": serialize_dish(request, item.dish, item.quantity),
                "quantity": item.quantity,
                "lineTotal": money(item.line_total),
            }
            for item in order.items.select_related("dish", "dish__category")
        ],
        "ingredientChecks": [
            serialize_ingredient_check(check)
            for check in order.ingredient_checks.select_related("ingredient")
        ],
    }


def sync_ingredient_checks(order):
    required = {}
    for item in order.items.select_related("dish").prefetch_related("dish__ingredients__ingredient"):
        for requirement in item.dish.ingredients.select_related("ingredient"):
            ingredient = requirement.ingredient
            required[ingredient.pk] = {
                "ingredient": ingredient,
                "quantity": required.get(ingredient.pk, {}).get("quantity", Decimal("0.00"))
                + requirement.quantity * item.quantity,
            }

    existing = {check.ingredient_id: check for check in order.ingredient_checks.select_related("ingredient")}
    for ingredient_id, data in required.items():
        check = existing.get(ingredient_id)
        if check is None:
            OrderIngredientCheck.objects.create(
                order=order,
                ingredient=data["ingredient"],
                required_quantity=data["quantity"],
                checked=False,
            )
        else:
            check.required_quantity = data["quantity"]
            check.save(update_fields=["required_quantity"])

    for ingredient_id, check in existing.items():
        if ingredient_id not in required:
            check.delete()

    refresh_order_ingredient_status(order)


def refresh_order_ingredient_status(order):
    checks = list(order.ingredient_checks.all())
    if not checks:
        return

    all_ready = all(check.checked for check in checks)
    if all_ready and order.status == Order.Status.PLACED:
        order.status = Order.Status.INGREDIENTS_READY
        order.save(update_fields=["status", "updated_at"])
    elif not all_ready and order.status == Order.Status.INGREDIENTS_READY:
        order.status = Order.Status.PLACED
        order.save(update_fields=["status", "updated_at"])


def health_view(request):
    return JsonResponse({"ok": True, "service": "ordering-api"})


@require_GET
def session_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({"authenticated": False, "user": None})
    return JsonResponse({"authenticated": True, "user": serialize_user(request.user)})


@csrf_exempt
@require_POST
def login_view(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "登录信息格式不对。"}, status=400)

    user = authenticate(username=data.get("username", ""), password=data.get("password", ""))
    if user is None:
        return JsonResponse({"msg": "账号或密码不对。"}, status=400)

    login(request, user)
    return JsonResponse({"user": serialize_user(user)})


@csrf_exempt
@require_POST
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


@require_GET
@require_roles(UserProfile.Role.ORDER)
def tables_view(request):
    tables = Table.objects.filter(available=True)
    return JsonResponse(
        {
            "tables": [
                {
                    "id": table.pk,
                    "name": table.name,
                    "occupied": table.occupied,
                }
                for table in tables
            ]
        }
    )


@require_GET
@require_roles(UserProfile.Role.ORDER)
def menu_view(request):
    table = get_table(request.GET.get("table"))
    basket = get_basket(table) if table else None
    quantities = {}
    if basket:
        quantities = {
            item.dish_id: item.quantity
            for item in basket.items.select_related("dish")
        }

    categories = []
    for category in Category.objects.filter(active=True).prefetch_related("dishes"):
        dishes = [
            serialize_dish(request, dish, quantities.get(dish.pk, 0))
            for dish in category.dishes.filter(active=True)
        ]
        categories.append(
            {
                "id": category.pk,
                "name": category.name,
                "dishes": dishes,
            }
        )

    return JsonResponse(
        {
            "store": {
                "name": "小搀猪的专属菜单",
                "subtitle": "想吃什么就点什么 · 用亲亲抱抱结算",
                "notice": "今天要吃点甜甜的",
            },
            "categories": categories,
            "basket": serialize_basket(request, basket),
        }
    )


@require_GET
@require_roles(UserProfile.Role.ORDER)
def basket_view(request):
    table = get_table(request.GET.get("table"))
    if table is None:
        return JsonResponse({"msg": "Table is required."}, status=400)
    return JsonResponse({"basket": serialize_basket(request, get_basket(table))})


@csrf_exempt
@require_POST
@require_roles(UserProfile.Role.ORDER)
def update_basket_view(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    table = get_table(data.get("tableId"))
    if table is None:
        return JsonResponse({"msg": "Table is required."}, status=400)

    try:
        dish = Dish.objects.get(pk=data.get("dishId"), active=True)
        quantity = max(0, int(data.get("quantity", 0)))
    except (Dish.DoesNotExist, TypeError, ValueError):
        return JsonResponse({"msg": "Dish and quantity are required."}, status=400)

    basket = get_or_create_basket(table)
    if quantity == 0:
        OrderItem.objects.filter(order=basket, dish=dish).delete()
    else:
        item, _ = OrderItem.objects.get_or_create(order=basket, dish=dish)
        item.quantity = quantity
        item.save()

    if basket.items.count() == 0:
        basket.delete()
        basket = None

    return JsonResponse({"basket": serialize_basket(request, basket)})


@csrf_exempt
@require_POST
@require_roles(UserProfile.Role.ORDER)
def clear_basket_view(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)
    table = get_table(data.get("tableId"))
    if table is None:
        return JsonResponse({"msg": "Table is required."}, status=400)

    basket = get_basket(table)
    if basket:
        basket.delete()
    return JsonResponse({"basket": serialize_basket(request, None)})


@csrf_exempt
@require_POST
@require_roles(UserProfile.Role.ORDER)
def place_order_view(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    table = get_table(data.get("tableId"))
    if table is None:
        return JsonResponse({"msg": "Table is required."}, status=400)

    basket = get_basket(table)
    if basket is None or basket.items.count() == 0:
        return JsonResponse({"msg": "Your basket is empty."}, status=400)

    try:
        number_of_people = max(1, int(data.get("numberOfPeople", 1)))
    except (TypeError, ValueError):
        number_of_people = 1

    active_order = Order.objects.filter(table=table, ordered=True, paid=False).exclude(status=Order.Status.DONE).first()
    if active_order:
        for basket_item in basket.items.select_related("dish"):
            item, _ = OrderItem.objects.get_or_create(order=active_order, dish=basket_item.dish)
            item.quantity += basket_item.quantity
            item.save()
        basket.delete()
        order = active_order
        if order.status == Order.Status.INGREDIENTS_READY:
            order.status = Order.Status.PLACED
            order.save(update_fields=["status", "updated_at"])
    else:
        basket.ordered = True
        basket.status = Order.Status.PLACED
        basket.number_of_people = number_of_people
        basket.all_together = bool(data.get("allTogether", False))
        basket.save()
        order = basket

    sync_ingredient_checks(order)
    KitchenTicket.objects.create(table=table, order=order)
    table.occupied = True
    table.save(update_fields=["occupied"])

    return JsonResponse(
        {
            "order": serialize_order(request, order),
            "basket": serialize_basket(request, None),
        },
        status=201,
    )


@require_GET
@require_roles(UserProfile.Role.ORDER)
def orders_view(request):
    table = get_table(request.GET.get("table"))
    if table is None:
        return JsonResponse({"msg": "Table is required."}, status=400)

    orders = Order.objects.filter(table=table, ordered=True, paid=False)
    return JsonResponse({"orders": [serialize_order(request, order) for order in orders]})


@require_GET
@require_roles(UserProfile.Role.COOK)
def all_orders_view(request):
    orders = Order.objects.filter(ordered=True, paid=False).select_related("table").prefetch_related(
        "items",
        "items__dish",
        "items__dish__category",
        "ingredient_checks",
        "ingredient_checks__ingredient",
    )
    return JsonResponse({"orders": [serialize_order(request, order) for order in orders]})


@csrf_exempt
@require_roles(UserProfile.Role.COOK)
def cook_ingredients_view(request):
    if request.method == "GET":
        return JsonResponse({"ingredients": [serialize_ingredient(item) for item in Ingredient.objects.all()]})

    if request.method != "POST":
        return JsonResponse({"msg": "Method not allowed."}, status=405)

    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    name = str(data.get("name", "")).strip()
    unit = str(data.get("unit", "份")).strip() or "份"
    if not name:
        return JsonResponse({"msg": "食材名字要填。"}, status=400)
    if Ingredient.objects.filter(name=name).exists():
        return JsonResponse({"msg": "这个食材已经有了。"}, status=400)

    try:
        quantity = decimal_from_data(data.get("quantity", 0), "库存数量")
    except ValueError as exc:
        return JsonResponse({"msg": str(exc)}, status=400)

    ingredient = Ingredient.objects.create(name=name, quantity=quantity, unit=unit)
    return JsonResponse({"ingredient": serialize_ingredient(ingredient)}, status=201)


@csrf_exempt
@require_roles(UserProfile.Role.COOK)
def cook_ingredient_detail_view(request, ingredient_id):
    try:
        ingredient = Ingredient.objects.get(pk=ingredient_id)
    except Ingredient.DoesNotExist:
        return JsonResponse({"msg": "食材不存在。"}, status=404)

    if request.method == "DELETE":
        ingredient.delete()
        return JsonResponse({"ok": True})

    if request.method != "POST":
        return JsonResponse({"msg": "Method not allowed."}, status=405)

    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    name = str(data.get("name", ingredient.name)).strip()
    unit = str(data.get("unit", ingredient.unit)).strip() or ingredient.unit
    if not name:
        return JsonResponse({"msg": "食材名字要填。"}, status=400)
    if Ingredient.objects.exclude(pk=ingredient.pk).filter(name=name).exists():
        return JsonResponse({"msg": "这个食材名字已经被用了。"}, status=400)

    try:
        quantity = decimal_from_data(data.get("quantity", ingredient.quantity), "库存数量")
    except ValueError as exc:
        return JsonResponse({"msg": str(exc)}, status=400)

    ingredient.name = name
    ingredient.quantity = quantity
    ingredient.unit = unit
    ingredient.save(update_fields=["name", "quantity", "unit"])
    return JsonResponse({"ingredient": serialize_ingredient(ingredient)})


@csrf_exempt
@require_roles(UserProfile.Role.COOK)
def cook_dishes_view(request):
    if request.method == "GET":
        categories = Category.objects.filter(active=True).prefetch_related(
            "dishes",
            "dishes__ingredients",
            "dishes__ingredients__ingredient",
        )
        return JsonResponse(
            {
                "categories": [
                    {
                        "id": category.pk,
                        "name": category.name,
                        "dishes": [serialize_cook_dish(request, dish) for dish in category.dishes.all()],
                    }
                    for category in categories
                ]
            }
        )

    if request.method != "POST":
        return JsonResponse({"msg": "Method not allowed."}, status=405)

    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    name = str(data.get("name", "")).strip()
    category_name = str(data.get("categoryName", "")).strip() or "推荐"
    description = str(data.get("description", "")).strip()
    badge = str(data.get("badge", "")).strip()[:20]
    ingredient_rows = data.get("ingredients", [])

    if not name:
        return JsonResponse({"msg": "菜品名字要填。"}, status=400)
    if not isinstance(ingredient_rows, list) or len(ingredient_rows) == 0:
        return JsonResponse({"msg": "至少要加一种食材。"}, status=400)

    try:
        price = decimal_from_data(data.get("price", 0), "价格", allow_zero=False)
    except ValueError as exc:
        return JsonResponse({"msg": str(exc)}, status=400)

    try:
        category = Category.objects.get(name=category_name, active=True)
    except Category.DoesNotExist:
        return JsonResponse({"msg": "这个分类不存在，请让管理账号先添加。"}, status=400)

    dish = Dish.objects.create(
        category=category,
        name=name,
        description=description,
        price=price,
        badge=badge,
        active=True,
        priority=(Dish.objects.filter(category=category).count() + 1) * 10,
    )

    try:
        for row in ingredient_rows:
            required_quantity = decimal_from_data(row.get("quantity", 0), "每份用量", allow_zero=False)
            ingredient_id = row.get("ingredientId")

            if ingredient_id:
                ingredient = Ingredient.objects.get(pk=ingredient_id)
            else:
                ingredient_name = str(row.get("name", "")).strip()
                ingredient_unit = str(row.get("unit", "份")).strip() or "份"
                if not ingredient_name:
                    raise ValueError("新食材名字要填。")
                stock_quantity = decimal_from_data(row.get("stockQuantity", 0), "新食材库存")
                ingredient, created = Ingredient.objects.get_or_create(
                    name=ingredient_name,
                    defaults={"quantity": stock_quantity, "unit": ingredient_unit},
                )
                if not created and ingredient.unit != ingredient_unit:
                    ingredient.unit = ingredient_unit
                    ingredient.save(update_fields=["unit"])

            requirement, _ = DishIngredient.objects.get_or_create(dish=dish, ingredient=ingredient)
            requirement.quantity = required_quantity
            requirement.save(update_fields=["quantity"])
    except (Ingredient.DoesNotExist, ValueError) as exc:
        dish.delete()
        return JsonResponse({"msg": str(exc) if str(exc) else "食材不存在。"}, status=400)

    dish = Dish.objects.select_related("category").prefetch_related("ingredients__ingredient").get(pk=dish.pk)
    return JsonResponse(
        {
            "dish": serialize_cook_dish(request, dish),
            "ingredients": [serialize_ingredient(item) for item in Ingredient.objects.all()],
        },
        status=201,
    )


@csrf_exempt
@require_POST
@require_roles(UserProfile.Role.COOK)
def toggle_ingredient_check_view(request, check_id):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    try:
        check = OrderIngredientCheck.objects.select_related("order").get(pk=check_id)
    except OrderIngredientCheck.DoesNotExist:
        return JsonResponse({"msg": "Ingredient check not found."}, status=404)

    check.checked = bool(data.get("checked", False))
    check.save(update_fields=["checked"])
    refresh_order_ingredient_status(check.order)
    check.order.refresh_from_db()
    return JsonResponse({"order": serialize_order(request, check.order)})


@csrf_exempt
@require_POST
@require_roles(UserProfile.Role.COOK)
def update_order_status_view(request, order_id):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    try:
        order = Order.objects.get(pk=order_id, ordered=True)
    except Order.DoesNotExist:
        return JsonResponse({"msg": "Order not found."}, status=404)

    status = data.get("status")
    allowed = {Order.Status.PLACED, Order.Status.INGREDIENTS_READY, Order.Status.COOKING, Order.Status.DONE}
    if status not in allowed:
        return JsonResponse({"msg": "Invalid order status."}, status=400)

    order.status = status
    order.save(update_fields=["status", "updated_at"])
    return JsonResponse({"order": serialize_order(request, order)})


@require_GET
@require_roles(UserProfile.Role.ADMIN)
def admin_accounts_view(request):
    users = User.objects.all().order_by("username")
    return JsonResponse({"accounts": [serialize_user(user) for user in users]})


@csrf_exempt
@require_POST
@require_roles(UserProfile.Role.ADMIN)
def create_account_view(request):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", "")).strip()
    role = data.get("role", UserProfile.Role.ORDER)
    if not username or not password:
        return JsonResponse({"msg": "账号和密码都要填。"}, status=400)
    if role not in UserProfile.Role.values:
        return JsonResponse({"msg": "角色不对。"}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"msg": "这个账号已经存在。"}, status=400)

    user = User.objects.create_user(username=username, password=password)
    profile = profile_for(user)
    profile.role = role
    profile.save(update_fields=["role"])
    if role == UserProfile.Role.ADMIN:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["is_staff", "is_superuser"])

    return JsonResponse({"account": serialize_user(user)}, status=201)


@csrf_exempt
@require_POST
@require_roles(UserProfile.Role.ADMIN)
def update_account_role_view(request, user_id):
    data = json_body(request)
    if data is None:
        return JsonResponse({"msg": "Invalid JSON body."}, status=400)

    role = data.get("role")
    if role not in UserProfile.Role.values:
        return JsonResponse({"msg": "角色不对。"}, status=400)

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return JsonResponse({"msg": "账号不存在。"}, status=404)

    profile = profile_for(user)
    profile.role = role
    profile.save(update_fields=["role"])
    user.is_staff = role == UserProfile.Role.ADMIN
    user.is_superuser = role == UserProfile.Role.ADMIN
    user.save(update_fields=["is_staff", "is_superuser"])
    return JsonResponse({"account": serialize_user(user)})
