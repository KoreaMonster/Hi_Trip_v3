"""Lightweight pytest plugin providing essential Django test helpers."""
from __future__ import annotations

import os
from contextlib import contextmanager

import django
import pytest
from django.test.runner import DiscoverRunner
from django.test.utils import setup_test_environment, teardown_test_environment


def pytest_addoption(parser):
    parser.addini(
        "DJANGO_SETTINGS_MODULE",
        "Django settings module for tests.",
        default="",
    )


def pytest_configure(config):
    settings_module = config.getini("DJANGO_SETTINGS_MODULE") or os.environ.get("DJANGO_SETTINGS_MODULE")
    if settings_module:
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", settings_module)

    if os.environ.get("DJANGO_SETTINGS_MODULE"):
        django.setup()
        config.addinivalue_line(
            "markers",
            "django_db: mark a test as requiring the Django test database.",
        )


@pytest.fixture(scope="session")
def django_test_environment():
    setup_test_environment()
    yield
    teardown_test_environment()


@pytest.fixture(scope="session")
def django_db_setup(django_test_environment):
    runner = DiscoverRunner(verbosity=0, interactive=False)
    old_config = runner.setup_databases()
    yield
    runner.teardown_databases(old_config)


@contextmanager
def _database_block(using="default"):
    from django.db import transaction

    transaction.set_autocommit(False, using=using)
    try:
        yield
    finally:
        transaction.rollback(using=using)
        transaction.set_autocommit(True, using=using)


@pytest.fixture
def db(django_db_setup):
    with _database_block():
        yield
