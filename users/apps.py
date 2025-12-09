from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        # Register drf-spectacular OpenAPI extensions (e.g., DemoAuthenticationScheme)
        from . import openapi  # noqa: F401
