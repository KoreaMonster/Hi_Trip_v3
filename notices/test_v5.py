import pytest
from django.apps import apps


@pytest.mark.django_db
def test_notices_app_is_installed():
    config = apps.get_app_config("notices")
    assert config.module.__name__ == "notices"
    assert "notices" in [app.label for app in apps.get_app_configs()]