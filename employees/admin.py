from django.contrib import admin

from .models import Employee


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "employee_id",
        "user",
        "department",
        "designation",
        "date_of_joining",
        "is_active",
    )

    list_filter = (
        "department",
        "designation",
        "is_active",
    )

    search_fields = (
        "employee_id",
        "user__username",
        "user__first_name",
        "user__last_name",
        "user__email",
    )