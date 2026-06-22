from django.contrib import admin

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


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


class OrderIngredientCheckInline(admin.TabularInline):
    model = OrderIngredientCheck
    extra = 0


class DishIngredientInline(admin.TabularInline):
    model = DishIngredient
    extra = 0


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role")
    list_filter = ("role",)


@admin.register(Table)
class TableAdmin(admin.ModelAdmin):
    list_display = ("name", "available", "occupied")
    list_filter = ("available", "occupied")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "priority", "active")
    list_filter = ("active",)
    ordering = ("priority", "name")


@admin.register(Dish)
class DishAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "price", "badge", "active", "priority")
    list_filter = ("category", "active")
    ordering = ("category__priority", "priority", "name")
    inlines = [DishIngredientInline]


@admin.register(Ingredient)
class IngredientAdmin(admin.ModelAdmin):
    list_display = ("name", "quantity", "unit")
    search_fields = ("name",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "table", "ordered", "status", "paid", "item_count", "total_price", "updated_at")
    list_filter = ("ordered", "status", "paid", "table")
    inlines = [OrderItemInline, OrderIngredientCheckInline]


@admin.register(KitchenTicket)
class KitchenTicketAdmin(admin.ModelAdmin):
    list_display = ("id", "table", "order", "status", "created_at")
    list_filter = ("status",)
