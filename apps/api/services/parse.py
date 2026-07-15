"""Parse uploaded files to plain text. Original bytes are discarded by callers."""

from __future__ import annotations

import io

from docx import Document
from pypdf import PdfReader

from errors import ValidationAppError

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".text", ".md"}
MAX_BYTES = 8 * 1024 * 1024  # 8 MiB


def _ext(filename: str) -> str:
    name = (filename or "").lower().strip()
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1]


def parse_file_bytes(filename: str, data: bytes) -> str:
    if not data:
        raise ValidationAppError("Uploaded file is empty")
    if len(data) > MAX_BYTES:
        raise ValidationAppError("File exceeds 8 MB limit")

    ext = _ext(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationAppError(
            "Unsupported file type. Use PDF, DOCX, or plain text."
        )

    if ext == ".pdf":
        return _parse_pdf(data)
    if ext == ".docx":
        return _parse_docx(data)
    return _parse_text(data)


def _parse_pdf(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text() or ""
            if text.strip():
                parts.append(text)
        content = "\n\n".join(parts).strip()
    except Exception as exc:
        raise ValidationAppError(f"Could not parse PDF: {exc}") from None
    if not content:
        raise ValidationAppError("PDF contained no extractable text")
    return content


def _parse_docx(data: bytes) -> str:
    try:
        doc = Document(io.BytesIO(data))
        parts = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
        content = "\n\n".join(parts).strip()
    except Exception as exc:
        raise ValidationAppError(f"Could not parse DOCX: {exc}") from None
    if not content:
        raise ValidationAppError("DOCX contained no extractable text")
    return content


def _parse_text(data: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            content = data.decode(encoding).strip()
            if content:
                return content
        except UnicodeDecodeError:
            continue
    raise ValidationAppError("Could not decode text file as UTF-8")
