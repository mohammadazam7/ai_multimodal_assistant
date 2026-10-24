"""The version is declared in pyproject.toml and in app/__init__.py; a release bumps both."""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

from app import __version__

PYPROJECT = Path(__file__).resolve().parents[1] / "pyproject.toml"
CHANGELOG = Path(__file__).resolve().parents[2] / "CHANGELOG.md"


def test_package_and_app_versions_match() -> None:
    declared = tomllib.loads(PYPROJECT.read_text())["project"]["version"]

    assert __version__ == declared


def test_version_is_semver() -> None:
    assert re.fullmatch(r"\d+\.\d+\.\d+", __version__), __version__


def test_released_version_has_a_changelog_entry() -> None:
    headings = re.findall(r"^## \[(\d+\.\d+\.\d+)\]", CHANGELOG.read_text(), re.MULTILINE)

    assert __version__ in headings
