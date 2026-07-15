"""Per-source-type logical chunking for knowledge base ingestion."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Literal

SourceType = Literal["resume", "cover_letter", "project", "note"]

TARGET_MAX_WORDS = 300
# Only glue true PDF fragments (not whole short sections).
TINY_FRAGMENT_WORDS = 12


@dataclass
class ChunkDraft:
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


def chunk_text(source_type: SourceType, text: str) -> list[ChunkDraft]:
    cleaned = _normalize(text)
    if not cleaned:
        return []

    if source_type == "resume":
        drafts = _chunk_resume(cleaned)
    elif source_type == "cover_letter":
        drafts = _chunk_paragraphs(cleaned, kind="cover_letter")
    else:
        # project / note — by heading or whole note
        drafts = _chunk_notes(cleaned, source_type)

    drafts = [d for d in drafts if d.content.strip()]
    return _coalesce_tiny(drafts)


def _normalize(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # PDF extractors often emit one visual line per newline with no blank
    # lines — reflow those into paragraphs so we don't get 1-word chunks.
    text = _reflow_broken_lines(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _reflow_broken_lines(text: str) -> str:
    """Join hard-wrapped PDF lines; keep bullets / headers as breaks."""
    lines = text.split("\n")
    if not lines:
        return text

    # If the text already has real paragraph breaks, only lightly fix.
    blank_ratio = sum(1 for ln in lines if not ln.strip()) / max(len(lines), 1)
    out: list[str] = []
    buf = ""

    def flush() -> None:
        nonlocal buf
        if buf.strip():
            out.append(buf.strip())
        buf = ""

    for raw in lines:
        line = raw.strip()
        if not line:
            flush()
            continue

        is_bullet = bool(re.match(r"^[-•*▪◦]\s+", line)) or bool(
            re.match(r"^\d+[.)]\s+", line)
        )
        is_header = bool(_SECTION_HEADERS.match(line)) or (
            len(line) < 48 and line.isupper() and " " in line
        )

        if is_header or is_bullet:
            flush()
            out.append(line)
            continue

        # Short leftover tokens from PDF wrapping → glue to previous
        if buf and (
            len(line) < 28
            or not line[0].isupper()
            or buf[-1:] not in ".!?:;"
        ):
            # Prefer space join; keep hyphenated wraps
            if buf.endswith("-"):
                buf = buf[:-1] + line
            else:
                buf = f"{buf} {line}"
        else:
            flush()
            buf = line

    flush()

    # Rebuild: headers/bullets as own lines; prose blocks separated by blank line
    paragraphs: list[str] = []
    for item in out:
        if re.match(r"^[-•*▪◦]\s+", item) or re.match(r"^\d+[.)]\s+", item):
            if paragraphs and not paragraphs[-1].startswith(("-", "•", "*")):
                paragraphs[-1] = paragraphs[-1] + "\n" + item
            else:
                paragraphs.append(item)
        elif _SECTION_HEADERS.match(item) or (len(item) < 48 and item.isupper()):
            paragraphs.append(item)
        else:
            paragraphs.append(item)

    # When original had almost no blanks, separate prose with blank lines
    if blank_ratio < 0.08:
        return "\n\n".join(paragraphs)
    return "\n\n".join(paragraphs)


def _coalesce_tiny(drafts: list[ChunkDraft]) -> list[ChunkDraft]:
    """Glue only tiny PDF fragments onto the previous chunk."""
    if not drafts:
        return []

    merged: list[ChunkDraft] = []
    for draft in drafts:
        words = _word_count(draft.content)
        if merged and words < TINY_FRAGMENT_WORDS:
            prev = merged[-1]
            prev_section = str(prev.metadata.get("section") or "")
            cur_section = str(draft.metadata.get("section") or "")
            # Don't glue across resume sections (e.g. Skills into Experience)
            same_section = (
                not prev_section
                or not cur_section
                or prev_section.lower() == cur_section.lower()
            )
            if same_section:
                prev.content = f"{prev.content.rstrip()}\n\n{draft.content.strip()}"
                for key, val in draft.metadata.items():
                    if key not in prev.metadata or not prev.metadata.get(key):
                        prev.metadata[key] = val
                continue
        merged.append(
            ChunkDraft(content=draft.content.strip(), metadata=dict(draft.metadata))
        )

    if len(merged) >= 2 and _word_count(merged[-1].content) < TINY_FRAGMENT_WORDS:
        last = merged[-1]
        prev = merged[-2]
        prev_section = str(prev.metadata.get("section") or "").lower()
        last_section = str(last.metadata.get("section") or "").lower()
        if not prev_section or not last_section or prev_section == last_section:
            merged.pop()
            prev.content = f"{prev.content.rstrip()}\n\n{last.content}"
    return merged



def _word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def _split_long(text: str, base_meta: dict[str, Any]) -> list[ChunkDraft]:
    """Split oversized units on paragraph boundaries."""
    if _word_count(text) <= TARGET_MAX_WORDS:
        return [ChunkDraft(content=text.strip(), metadata=dict(base_meta))]

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if len(paragraphs) <= 1:
        # Fall back to sentence-ish splits on newlines / periods
        sentences = re.split(r"(?<=[.!?])\s+", text)
        paragraphs = [s.strip() for s in sentences if s.strip()]

    chunks: list[ChunkDraft] = []
    buf: list[str] = []
    for para in paragraphs:
        candidate = "\n\n".join(buf + [para]).strip()
        if buf and _word_count(candidate) > TARGET_MAX_WORDS:
            chunks.append(
                ChunkDraft(content="\n\n".join(buf).strip(), metadata=dict(base_meta))
            )
            buf = [para]
        else:
            buf.append(para)
    if buf:
        chunks.append(
            ChunkDraft(content="\n\n".join(buf).strip(), metadata=dict(base_meta))
        )
    return chunks


_ROLE_AT_COMPANY = re.compile(
    r"^(?P<role>.+?)\s+at\s+(?P<company>.+?)$",
    re.IGNORECASE,
)
_ROLE_SEP_COMPANY = re.compile(
    r"^(?P<role>.+?)\s*[-–—|@]\s*(?P<company>.+?)$",
)

_DATE_LINE = re.compile(
    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|"
    r"January|February|March|April|May|June|July|August|September|October|November|"
    r"December)\s+\d{4}|\d{4})\s*[-–—to]+\s*"
    r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|"
    r"January|February|March|April|May|June|July|August|September|October|November|"
    r"December)\s+\d{4}|\d{4}|Present|Current)",
    re.IGNORECASE,
)

_SECTION_HEADERS = re.compile(
    r"^(experience|work experience|employment|professional experience|"
    r"education|skills|technical skills|summary|profile|objective|"
    r"projects|achievements|certifications)"
    r"(?:\s*:\s*[^\n]*)?\s*$",
    re.IGNORECASE | re.MULTILINE,
)


def _chunk_resume(text: str) -> list[ChunkDraft]:
    sections = _split_resume_sections(text)
    drafts: list[ChunkDraft] = []

    for title, body in sections:
        title_l = title.lower()
        if any(k in title_l for k in ("skill",)):
            skills = _extract_skills(body)
            meta: dict[str, Any] = {"section": title or "skills", "skills": skills}
            drafts.extend(_split_long(body if body else title, meta))
        elif any(k in title_l for k in ("summary", "profile", "objective")):
            meta = {"section": title or "summary", "skills": _extract_skills(body)}
            drafts.extend(_split_long(body, meta))
        elif any(
            k in title_l
            for k in ("experience", "employment", "work", "project", "achievement")
        ):
            drafts.extend(_chunk_experience_block(body, section=title))
        else:
            # Try experience-style parsing; else one section chunk
            experience_chunks = _chunk_experience_block(body, section=title)
            if experience_chunks and len(experience_chunks) > 1:
                drafts.extend(experience_chunks)
            else:
                meta = {
                    "section": title or "resume",
                    "skills": _extract_skills(body),
                }
                drafts.extend(_split_long(body or text, meta))

    if not drafts:
        meta = {"section": "resume", "skills": _extract_skills(text)}
        drafts = _split_long(text, meta)

    return drafts


def _split_resume_sections(text: str) -> list[tuple[str, str]]:
    matches = list(_SECTION_HEADERS.finditer(text))
    if not matches:
        return [("Experience", text)]

    sections: list[tuple[str, str]] = []
    # Preamble before first header
    if matches[0].start() > 0:
        preamble = text[: matches[0].start()].strip()
        if preamble:
            sections.append(("Summary", preamble))

    for i, match in enumerate(matches):
        title = match.group(1).strip()
        # For headers like "Skills: Python, …", keep the line remainder in body
        full = match.group(0)
        remainder = full.split(":", 1)[1].strip() if ":" in full else ""
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        if remainder:
            body = f"{remainder}\n{body}".strip() if body else remainder
        if body:
            sections.append((title, body))
    return sections or [("Experience", text)]


def _chunk_experience_block(body: str, section: str) -> list[ChunkDraft]:
    # Split on blank lines into candidate role blocks
    blocks = [b.strip() for b in re.split(r"\n\s*\n", body) if b.strip()]
    if not blocks:
        return []

    # Merge short bullet-only blocks into previous role
    merged: list[str] = []
    for block in blocks:
        lines = block.split("\n")
        first_line = lines[0].strip()
        looks_like_role = bool(
            _ROLE_AT_COMPANY.match(first_line)
            or (
                _ROLE_SEP_COMPANY.match(first_line)
                and not _DATE_LINE.search(first_line)
            )
            or (len(lines) > 1 and _DATE_LINE.search(lines[1]))
        )
        if merged and not looks_like_role and block.lstrip().startswith(("-", "•", "*")):
            merged[-1] = merged[-1] + "\n\n" + block
        else:
            merged.append(block)

    drafts: list[ChunkDraft] = []
    for block in merged:
        meta = _extract_role_meta(block)
        meta["section"] = section
        if "skills" not in meta:
            meta["skills"] = _extract_skills(block)
        drafts.extend(_split_long(block, meta))
    return drafts


def _extract_role_meta(block: str) -> dict[str, Any]:
    lines = [ln.strip() for ln in block.split("\n") if ln.strip()]
    meta: dict[str, Any] = {}
    if not lines:
        return meta

    # Skip leading date-only lines when choosing the role title line
    title_idx = 0
    for i, line in enumerate(lines[:3]):
        if _DATE_LINE.fullmatch(line.strip()) or (
            _DATE_LINE.search(line) and len(line) < 40
        ):
            meta["dates"] = _DATE_LINE.search(line).group(0).strip()  # type: ignore[union-attr]
            if i == title_idx:
                title_idx = i + 1
            continue
        break

    if title_idx >= len(lines):
        title_idx = 0
    first = lines[title_idx]

    m = _ROLE_AT_COMPANY.match(first)
    if not m and not _DATE_LINE.search(first):
        m = _ROLE_SEP_COMPANY.match(first)
    if m:
        meta["role"] = m.group("role").strip(" -–—|,")
        company = m.group("company").strip(" -–—|,")
        dm_inline = _DATE_LINE.search(company)
        if dm_inline:
            meta["dates"] = dm_inline.group(0).strip()
            company = company[: dm_inline.start()].strip(" -–—|,")
        meta["company"] = company
    else:
        meta["role"] = first

    if "dates" not in meta:
        for line in lines[:4]:
            dm = _DATE_LINE.search(line)
            if dm:
                meta["dates"] = dm.group(0).strip()
                break

    meta["skills"] = _extract_skills(block)
    return meta


def _extract_skills(text: str) -> list[str]:
    # Comma / bullet separated skill-ish tokens from short lines or lists
    skills: list[str] = []
    # Explicit "Skills: a, b, c"
    for match in re.finditer(
        r"(?:skills|technologies|tech stack)\s*[:\-]\s*(.+)",
        text,
        flags=re.IGNORECASE,
    ):
        skills.extend(_split_skill_list(match.group(1)))

    # Bullet lines that look like skill lists (short, comma-heavy)
    for line in text.split("\n"):
        line = line.strip().lstrip("-•* ").strip()
        if not line or len(line) > 120:
            continue
        if line.count(",") >= 2:
            skills.extend(_split_skill_list(line))

    # Dedupe preserving order
    seen: set[str] = set()
    out: list[str] = []
    for s in skills:
        key = s.lower()
        if key not in seen and 1 < len(s) < 48:
            seen.add(key)
            out.append(s)
    return out[:40]


def _split_skill_list(raw: str) -> list[str]:
    parts = re.split(r"[,;/|•]+", raw)
    return [p.strip() for p in parts if p.strip()]


def _chunk_paragraphs(text: str, kind: str) -> list[ChunkDraft]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        paragraphs = [text]
    drafts: list[ChunkDraft] = []
    for i, para in enumerate(paragraphs):
        meta = {"section": kind, "paragraph_index": i, "skills": _extract_skills(para)}
        drafts.extend(_split_long(para, meta))
    return drafts


def _chunk_notes(text: str, source_type: SourceType) -> list[ChunkDraft]:
    # Split on markdown-style headings or ALL-CAPS short headers
    heading = re.compile(
        r"^(#{1,3}\s+.+|[A-Z][A-Z0-9 /&'\-]{2,40})\s*$",
        re.MULTILINE,
    )
    matches = list(heading.finditer(text))
    if not matches:
        meta = {
            "section": source_type,
            "skills": _extract_skills(text),
        }
        return _split_long(text, meta)

    drafts: list[ChunkDraft] = []
    if matches[0].start() > 0:
        preamble = text[: matches[0].start()].strip()
        if preamble:
            meta = {
                "section": "intro",
                "skills": _extract_skills(preamble),
            }
            drafts.extend(_split_long(preamble, meta))

    for i, match in enumerate(matches):
        title = match.group(0).lstrip("#").strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        content = f"{title}\n\n{body}".strip() if body else title
        meta = {
            "section": title,
            "skills": _extract_skills(content),
        }
        if source_type == "project":
            meta["role"] = title
        drafts.extend(_split_long(content, meta))

    return drafts
