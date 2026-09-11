from django.urls import path
from . import views

urlpatterns = [
    path("", views.employee_list, name="employee_list"),
    path("add/", views.employee_create, name="employee_create"),
    path("<str:pk>/", views.employee_detail, name="employee_detail"),
    path("<str:pk>/edit/", views.employee_update, name="employee_update"),
    path("<str:pk>/delete/", views.employee_delete, name="employee_delete"),
]