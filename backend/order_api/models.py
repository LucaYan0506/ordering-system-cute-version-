from decimal import Decimal

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    class Role(models.TextChoices):
        ORDER = "order", "点单"
        COOK = "cook", "做饭"
        ADMIN = "admin", "管理"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ORDER)

    def __str__(self):
        return f"{self.user.username} · {self.get_role_display()}"


class Table(models.Model):
    name = models.CharField(max_length=80)
    available = models.BooleanField(default=True)
    occupied = models.BooleanField(default=False)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Category(models.Model):
    name = models.CharField(max_length=80)
    active = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["priority", "name"]

    def __str__(self):
        return self.name


class Dish(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="dishes")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    image = models.FileField(upload_to="dish", blank=True)
    badge = models.CharField(max_length=20, blank=True)
    active = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["category__priority", "priority", "name"]

    def __str__(self):
        return self.name


class Ingredient(models.Model):
    name = models.CharField(max_length=80, unique=True)
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    unit = models.CharField(max_length=24, default="份")

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} {self.quantity}{self.unit}"


class DishIngredient(models.Model):
    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name="ingredients")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name="dish_requirements")
    quantity = models.DecimalField(max_digits=8, decimal_places=2, default=1)

    class Meta:
        unique_together = ("dish", "ingredient")

    def __str__(self):
        return f"{self.dish.name} needs {self.quantity}{self.ingredient.unit} {self.ingredient.name}"


class Order(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "购物袋"
        PLACED = "placed", "已下单"
        INGREDIENTS_READY = "ingredients_ready", "食材已备好"
        COOKING = "cooking", "准备中"
        DONE = "done", "等抱抱"

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="orders")
    ordered = models.BooleanField(default=False)
    paid = models.BooleanField(default=False)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT)
    all_together = models.BooleanField(default=False)
    number_of_people = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    @property
    def total_price(self):
        total = Decimal("0.00")
        for item in self.items.select_related("dish"):
            total += item.dish.price * item.quantity
        return total

    @property
    def item_count(self):
        return sum(item.quantity for item in self.items.all())

    def __str__(self):
        state = "ordered" if self.ordered else "basket"
        return f"{self.table.name} {state} #{self.pk}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    dish = models.ForeignKey(Dish, on_delete=models.CASCADE, related_name="order_items")
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ("order", "dish")

    @property
    def line_total(self):
        return self.dish.price * self.quantity

    def __str__(self):
        return f"{self.quantity} x {self.dish.name}"


class OrderIngredientCheck(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="ingredient_checks")
    ingredient = models.ForeignKey(Ingredient, on_delete=models.CASCADE, related_name="order_checks")
    required_quantity = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    checked = models.BooleanField(default=False)

    class Meta:
        ordering = ["ingredient__name"]
        unique_together = ("order", "ingredient")

    def __str__(self):
        mark = "ready" if self.checked else "waiting"
        return f"{self.order_id} · {self.ingredient.name} · {mark}"


class KitchenTicket(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "New"
        IN_PROGRESS = "in_progress", "In progress"
        DONE = "done", "Done"

    table = models.ForeignKey(Table, on_delete=models.CASCADE, related_name="kitchen_tickets")
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="kitchen_tickets")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.table.name} ticket #{self.pk}"
