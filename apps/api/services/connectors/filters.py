"""Client-side role / location / experience filtering for board listings."""

from __future__ import annotations

from services.connectors.types import NormalizedPosting


def _haystack(posting: NormalizedPosting) -> str:
    parts = [
        posting.title or "",
        posting.company or "",
        posting.raw_text or "",
        posting.url or "",
    ]
    return " ".join(parts).lower()


def matches_filters(
    posting: NormalizedPosting,
    *,
    role_keywords: list[str],
    locations: list[str],
    experience_levels: list[str],
) -> bool:
    """
    Keep a posting when it matches configured filters.

    - Empty role_keywords → no role filter (accept all titles).
    - Empty locations → no location filter.
    - Empty experience_levels → no experience filter.
    - Non-empty lists: posting must match at least one keyword in each
      non-empty list (OR within a list, AND across lists).
    """
    text = _haystack(posting)

    if role_keywords:
        roles = [k.strip().lower() for k in role_keywords if k.strip()]
        if roles and not any(k in text for k in roles):
            return False

    if locations:
        locs = [k.strip().lower() for k in locations if k.strip()]
        if locs and not any(k in text for k in locs):
            return False

    if experience_levels:
        levels = [k.strip().lower() for k in experience_levels if k.strip()]
        if levels and not any(k in text for k in levels):
            return False

    return True


def filter_postings(
    postings: list[NormalizedPosting],
    *,
    role_keywords: list[str],
    locations: list[str],
    experience_levels: list[str],
) -> list[NormalizedPosting]:
    return [
        p
        for p in postings
        if matches_filters(
            p,
            role_keywords=role_keywords,
            locations=locations,
            experience_levels=experience_levels,
        )
    ]
