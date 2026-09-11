from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import user_passes_test
from django.contrib.auth import get_user_model
from .models import Employee


User = get_user_model()


def is_admin(user):
    return (
        user.is_authenticated
        and user.role in [User.Role.ADMIN, User.Role.HR]
    )


def employee_list(request):
    employees = Employee.objects.select_related("user").all()

    return render(
        request,
        "employees/employee_list.html",
        {"employees": employees},
    )


def employee_detail(request, pk):
    employee = get_object_or_404(
        Employee.objects.select_related("user"),
        pk=pk,
    )

    return render(
        request,
        "employees/employee_detail.html",
        {"employee": employee},
    )


@user_passes_test(is_admin)
def employee_create(request):
    if request.method == "POST":

        username = request.POST["username"]
        employee_id = request.POST["employee_id"]

        if User.objects.filter(username=username).exists():
            return render(
                request,
                "employees/employee_form.html",
                {"error": "Username already exists."},
            )

        if Employee.objects.filter(employee_id=employee_id).exists():
            return render(
                request,
                "employees/employee_form.html",
                {"error": "Employee ID already exists."},
            )

        user = User.objects.create_user(
            username=username,
            password=request.POST["password"],
            first_name=request.POST["first_name"],
            last_name=request.POST["last_name"],
            email=request.POST["email"],
            role=User.Role.EMPLOYEE,
        )

        Employee.objects.create(
            user=user,
            employee_id=employee_id,
            department=request.POST["department"],
            designation=request.POST["designation"],
            date_of_joining=request.POST["date_of_joining"],
        )

        return redirect("employee_list")

    return render(request, "employees/employee_form.html")


@user_passes_test(is_admin)
def employee_update(request, pk):
    employee = get_object_or_404(Employee, pk=pk)
    user = employee.user

    if request.method == "POST":

        username = request.POST["username"]
        employee_id = request.POST["employee_id"]

        if User.objects.filter(
            username=username
        ).exclude(pk=user.pk).exists():

            return render(
                request,
                "employees/employee_form.html",
                {
                    "employee": employee,
                    "error": "Username already exists.",
                },
            )

        if Employee.objects.filter(
            employee_id=employee_id
        ).exclude(pk=pk).exists():

            return render(
                request,
                "employees/employee_form.html",
                {
                    "employee": employee,
                    "error": "Employee ID already exists.",
                },
            )

        user.username = username
        user.first_name = request.POST["first_name"]
        user.last_name = request.POST["last_name"]
        user.email = request.POST["email"]
        user.save()

        employee.employee_id = employee_id
        employee.department = request.POST["department"]
        employee.designation = request.POST["designation"]
        employee.date_of_joining = request.POST["date_of_joining"]
        employee.save()

        return redirect("employee_list")

    return render(
        request,
        "employees/employee_form.html",
        {"employee": employee},
    )


@user_passes_test(is_admin)
def employee_delete(request, pk):
    employee = get_object_or_404(Employee, pk=pk)

    if request.method == "POST":
        employee.user.delete()
        return redirect("employee_list")

    return render(
        request,
        "employees/employee_confirm_delete.html",
        {"employee": employee},
    )


@user_passes_test(is_admin)
def employee_deactivate(request, pk):
    employee = get_object_or_404(Employee, pk=pk)

    if request.method == "POST":
        employee.is_active = False
        employee.save()

        return redirect("employee_list")

    return render(
        request,
        "employees/employee_detail.html",
        {"employee": employee},
    )
def employee_profile(request):
    employee = get_object_or_404(
        Employee.objects.select_related("user"),
        user=request.user,
    )

    return render(
        request,
        "employees/employee_profile.html",
        {"employee": employee},
    )