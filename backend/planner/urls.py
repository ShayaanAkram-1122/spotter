from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("trips/", views.create_trip, name="create_trip"),
]
