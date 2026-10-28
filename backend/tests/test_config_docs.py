"""The README's configuration table must list every setting with its real default."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.config import Settings

README = Path(__file__).resolve().parents[2] / "README.md"
ROW = re.compile(r"^\| `(VISION_[A-Z_]+)` \| `([^`]*)` \|", re.MULTILINE)


def _documented() -> dict[str, str]:
    if not README.exists():
        pytest.skip("README.md is not part of this checkout")
    section = README.read_text(encoding="utf-8").split("### Configuration", 1)[1]
    return dict(ROW.findall(section.split("\n## ", 1)[0]))


def test_every_setting_is_documented() -> None:
    documented = {name.removeprefix("VISION_").lower() for name in _documented()}

    assert documented == set(Settings.model_fields)


def test_documented_defaults_parse_to_the_real_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    # Reading each documented default back through the environment, the way an operator
    # would set it, must reproduce the default the service actually uses.
    for variable, value in _documented().items():
        monkeypatch.setenv(variable, value)

    assert Settings(_env_file=None) == Settings.model_construct()
