"""Relative links in the project's Markdown files must point at files that exist."""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
DOCS = [REPO / "README.md", REPO / "CHANGELOG.md", *sorted((REPO / "docs").glob("*.md"))]
LINK = re.compile(r"\]\(([^)\s]+)\)")


def _relative_targets(markdown: Path) -> list[str]:
    targets = []
    for target in LINK.findall(markdown.read_text(encoding="utf-8")):
        if re.match(r"^[a-z]+:", target) or target.startswith("#"):
            continue
        targets.append(target.split("#", 1)[0])
    return targets


@pytest.mark.parametrize("markdown", DOCS, ids=lambda p: str(p.relative_to(REPO)))
def test_relative_links_resolve(markdown: Path) -> None:
    if not markdown.exists():
        pytest.skip(f"{markdown.name} is not part of this checkout")
    missing = [t for t in _relative_targets(markdown) if not (markdown.parent / t).exists()]
    assert missing == [], f"broken links in {markdown.name}: {missing}"
