import pytest
from django.apps import apps


@pytest.mark.django_db
def test_locations_app_config_name():
    config = apps.get_app_config("locations")
    assert config.name == "locations"
    assert config.verbose_name == "Locations"