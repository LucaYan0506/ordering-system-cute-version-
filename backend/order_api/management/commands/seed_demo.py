import os
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from order_api.models import Category, Dish, DishIngredient, Ingredient, Table, UserProfile


class Command(BaseCommand):
    help = "Create demo tables, categories, and jelly-style dishes."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo is disabled when DJANGO_DEBUG is false.")

        demo_password = os.environ.get("DEMO_PASSWORD", "123456")

        for name in ["A01", "A02", "B01", "B02", "窗边小桌"]:
            Table.objects.get_or_create(name=name, defaults={"available": True})

        accounts = [
            ("diandan", demo_password, UserProfile.Role.ORDER, False),
            ("cook", demo_password, UserProfile.Role.COOK, False),
            ("admin", demo_password, UserProfile.Role.ADMIN, True),
        ]
        for username, password, role, is_admin in accounts:
            user, created = User.objects.get_or_create(username=username)
            if created:
                user.set_password(password)
            user.is_staff = is_admin
            user.is_superuser = is_admin
            user.save()
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile.role = role
            profile.save()

        categories = [
            ("推荐", 10),
            ("果茶", 20),
            ("糖水", 30),
            ("小食", 40),
            ("加料", 50),
            ("冰品", 60),
        ]
        category_map = {}
        for name, priority in categories:
            category, _ = Category.objects.update_or_create(
                name=name,
                defaults={"priority": priority, "active": True},
            )
            category_map[name] = category

        dishes = [
            ("推荐", "青提啵啵茶", "青提果香 · 脆啵啵 · 清爽茶底", "19.00", "TOP", 10),
            ("推荐", "桃桃布丁杯", "桃子果肉 · 奶香布丁 · 轻甜口", "16.00", "软乎", 20),
            ("推荐", "芒果冰豆花", "芒果粒 · 豆花滑嫩 · 夏天必点", "18.00", "冰爽", 30),
            ("小食", "脆脆小薯角", "外皮酥脆 · 撒粉可选 · 趁热吃", "12.00", "小食", 40),
            ("果茶", "荔枝冰茶", "荔枝果香 · 茶底清亮 · 少冰也好喝", "15.00", "清爽", 10),
            ("糖水", "桂花酒酿小圆子", "桂花香 · 小圆子 · 温温热热", "16.00", "热甜", 10),
            ("加料", "双倍脆啵啵", "给快乐加一点弹弹口感", "3.00", "加点", 10),
            ("冰品", "红糖冰粉", "红糖香 · 花生碎 · 清凉解腻", "13.00", "经典", 10),
        ]

        dish_map = {}
        for category_name, name, desc, price, badge, priority in dishes:
            dish, _ = Dish.objects.update_or_create(
                name=name,
                defaults={
                    "category": category_map[category_name],
                    "description": desc,
                    "price": Decimal(price),
                    "badge": badge,
                    "priority": priority,
                    "active": True,
                },
            )
            dish_map[name] = dish

        ingredients = [
            ("青提", "20.00", "颗"),
            ("脆啵啵", "12.00", "勺"),
            ("茶底", "8.00", "杯"),
            ("桃子", "10.00", "份"),
            ("布丁", "9.00", "份"),
            ("芒果", "10.00", "份"),
            ("豆花", "8.00", "碗"),
            ("小薯角", "15.00", "份"),
            ("桂花", "6.00", "勺"),
            ("小圆子", "12.00", "份"),
            ("红糖", "8.00", "勺"),
            ("冰粉", "10.00", "碗"),
        ]
        ingredient_map = {}
        for name, quantity, unit in ingredients:
            ingredient, _ = Ingredient.objects.update_or_create(
                name=name,
                defaults={"quantity": Decimal(quantity), "unit": unit},
            )
            ingredient_map[name] = ingredient

        requirements = {
            "青提啵啵茶": [("青提", "6.00"), ("脆啵啵", "2.00"), ("茶底", "1.00")],
            "桃桃布丁杯": [("桃子", "1.00"), ("布丁", "1.00")],
            "芒果冰豆花": [("芒果", "1.00"), ("豆花", "1.00")],
            "脆脆小薯角": [("小薯角", "1.00")],
            "荔枝冰茶": [("茶底", "1.00")],
            "桂花酒酿小圆子": [("桂花", "1.00"), ("小圆子", "1.00")],
            "双倍脆啵啵": [("脆啵啵", "2.00")],
            "红糖冰粉": [("红糖", "1.00"), ("冰粉", "1.00")],
        }
        for dish_name, ingredient_rows in requirements.items():
            for ingredient_name, quantity in ingredient_rows:
                DishIngredient.objects.update_or_create(
                    dish=dish_map[dish_name],
                    ingredient=ingredient_map[ingredient_name],
                    defaults={"quantity": Decimal(quantity)},
                )

        self.stdout.write(self.style.SUCCESS("Demo ordering data is ready."))
