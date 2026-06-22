from django.urls import path

from . import views


urlpatterns = [
    path("health/", views.health_view, name="health"),
    path("auth/session/", views.session_view, name="session"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.logout_view, name="logout"),
    path("tables/", views.tables_view, name="tables"),
    path("menu/", views.menu_view, name="menu"),
    path("basket/", views.basket_view, name="basket"),
    path("basket/update/", views.update_basket_view, name="update_basket"),
    path("basket/clear/", views.clear_basket_view, name="clear_basket"),
    path("order/", views.place_order_view, name="place_order"),
    path("orders/", views.orders_view, name="orders"),
    path("orders/all/", views.all_orders_view, name="all_orders"),
    path("cook/ingredients/", views.cook_ingredients_view, name="cook_ingredients"),
    path("cook/ingredients/<int:ingredient_id>/", views.cook_ingredient_detail_view, name="cook_ingredient_detail"),
    path("cook/dishes/", views.cook_dishes_view, name="cook_dishes"),
    path("cook/checks/<int:check_id>/", views.toggle_ingredient_check_view, name="toggle_ingredient_check"),
    path("cook/orders/<int:order_id>/status/", views.update_order_status_view, name="update_order_status"),
    path("admin/accounts/", views.admin_accounts_view, name="admin_accounts"),
    path("admin/accounts/create/", views.create_account_view, name="create_account"),
    path("admin/accounts/<int:user_id>/role/", views.update_account_role_view, name="update_account_role"),
]
