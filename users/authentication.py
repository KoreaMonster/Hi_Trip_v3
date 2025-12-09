"""Demo-friendly authentication backend.

When DEMO_MODE is enabled, every request is automatically authenticated as a
predefined demo super admin user so the API can be exercised without login.
"""

from __future__ import annotations

from datetime import datetime

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication

User = get_user_model()


class DemoAuthentication(BaseAuthentication):
    """Authenticate any request as a demo super admin when DEMO_MODE is on."""

    def authenticate(self, request):
        if not getattr(settings, "DEMO_MODE", False):
            return None

        user, created = User.objects.get_or_create(
            username="demo_admin",
            defaults={
                "first_name": "Demo",
                "last_name": "Admin",
                "first_name_kr": "데모",
                "last_name_kr": "관리자",
                "role": "super_admin",
                "is_staff": True,
                "is_superuser": True,
                "is_approved": True,
                "last_login": datetime.utcnow(),
            },
        )

        updates = {}
        if not user.is_approved:
            updates["is_approved"] = True
        if user.role != "super_admin":
            updates["role"] = "super_admin"
        if not user.is_staff:
            updates["is_staff"] = True
        if not user.is_superuser:
            updates["is_superuser"] = True
        if updates:
            for key, value in updates.items():
                setattr(user, key, value)
            user.save(update_fields=list(updates.keys()))

        return user, None


__all__ = ["DemoAuthentication"]
