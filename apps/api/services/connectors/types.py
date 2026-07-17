"""Normalized posting shape shared by all Module 4 connectors."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

JobSource = Literal["greenhouse", "lever", "ashby"]

ConnectorStatus = Literal["success", "partial", "failed", "skipped"]


@dataclass(frozen=True)
class NormalizedPosting:
    """Canonical shape every connector maps into before storage."""

    company: str
    title: str
    url: str | None
    raw_text: str
    source: JobSource
    external_id: str | None = None


@dataclass
class ConnectorResult:
    """Per-connector outcome for one Run Search invocation."""

    source: JobSource
    status: ConnectorStatus
    fetched: int = 0
    matched: int = 0
    inserted: int = 0
    skipped_duplicates: int = 0
    message: str | None = None
