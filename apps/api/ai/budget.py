"""Daily Cloudflare Neurons budget — estimate + hard stop for Paid plans.

Cloudflare Workers Paid does not auto-stop at the free 10k Neurons/day;
it bills overage. This module tracks *estimated* Neurons from returned
token counts (using Workers AI published rates) and refuses new calls
once the configured daily budget is reached. Resets at 00:00 UTC.

Estimates are best-effort (not Cloudflare's billing meter). Prefer a
budget slightly under 10_000 (default 9_000) for a safety margin.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from ai.errors import ProviderError
from ai.types import Capability

logger = logging.getLogger(__name__)

PROVIDER_NAME = "cloudflare"
DEFAULT_DAILY_BUDGET = 9_000
# Neurons per 1M tokens — from Cloudflare Workers AI pricing.
_NEURON_RATES: dict[str, tuple[float, float]] = {
    # model: (input_per_M, output_per_M)
    "@cf/zai-org/glm-4.7-flash": (5_500.0, 36_400.0),
    "@cf/baai/bge-large-en-v1.5": (18_582.0, 0.0),
    "@cf/baai/bge-base-en-v1.5": (6_058.0, 0.0),
    "@cf/baai/bge-small-en-v1.5": (1_841.0, 0.0),
    "@cf/ibm-granite/granite-4.0-h-micro": (1_542.0, 10_158.0),
    "@cf/meta/llama-3.2-1b-instruct": (2_457.0, 18_252.0),
    "@cf/qwen/qwen3-30b-a3b-fp8": (4_625.0, 30_475.0),
}
# Conservative fallback when model rates are unknown.
_FALLBACK_INPUT_PER_M = 10_000.0
_FALLBACK_OUTPUT_PER_M = 40_000.0

_lock = threading.Lock()


def _utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def daily_budget() -> int | None:
    """Configured daily Neuron budget, or None if tracking is disabled.

    ``AI_DAILY_NEURON_BUDGET`` — default 9000. Set to ``0`` or ``off`` to
    disable the hard stop (still logs estimates when tokens are known).
    """
    raw = os.environ.get("AI_DAILY_NEURON_BUDGET", str(DEFAULT_DAILY_BUDGET))
    cleaned = (raw or "").strip().lower()
    if cleaned in {"", "0", "off", "false", "disabled", "none"}:
        return None
    try:
        value = int(cleaned)
    except ValueError:
        return DEFAULT_DAILY_BUDGET
    return value if value > 0 else None


def _state_path() -> Path:
    override = os.environ.get("AI_BUDGET_STATE_PATH", "").strip()
    if override:
        return Path(override)
    return Path("/tmp/careeragent_ai_neuron_budget.json")


def _load_state() -> dict:
    path = _state_path()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and data.get("day") == _utc_day():
            used = data.get("used_neurons", 0)
            return {
                "day": _utc_day(),
                "used_neurons": float(used) if isinstance(used, (int, float)) else 0.0,
            }
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        pass
    return {"day": _utc_day(), "used_neurons": 0.0}


def _save_state(state: dict) -> None:
    path = _state_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(state), encoding="utf-8")
    except OSError as exc:
        logger.warning("ai_budget_persist_failed path=%s error=%s", path, exc)


def used_neurons_today() -> float:
    with _lock:
        return float(_load_state()["used_neurons"])


def estimate_neurons(
    *,
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None = None,
) -> float:
    """Estimate Neurons from token counts using published per-model rates."""
    prompt = max(int(prompt_tokens or 0), 0)
    completion = max(int(completion_tokens or 0), 0)
    if prompt == 0 and completion == 0:
        return 0.0
    rates = _NEURON_RATES.get(model)
    if rates is None:
        inp, out = _FALLBACK_INPUT_PER_M, _FALLBACK_OUTPUT_PER_M
    else:
        inp, out = rates
    return (prompt / 1_000_000.0) * inp + (completion / 1_000_000.0) * out


def check_budget(*, capability: Capability) -> None:
    """Raise if today's estimated usage already meets/exceeds the budget."""
    budget = daily_budget()
    if budget is None:
        return
    used = used_neurons_today()
    if used >= budget:
        raise ProviderError(
            capability=capability,
            provider=PROVIDER_NAME,
            message=(
                f"daily Neuron budget reached "
                f"(~{used:.0f}/{budget} estimated, resets 00:00 UTC)"
            ),
            status_code=429,
        )


def record_usage(
    *,
    capability: Capability,
    model: str,
    prompt_tokens: int | None,
    completion_tokens: int | None = None,
) -> float:
    """Add estimated Neurons for a completed call; return amount added."""
    added = estimate_neurons(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
    )
    budget = daily_budget()
    with _lock:
        state = _load_state()
        state["used_neurons"] = float(state["used_neurons"]) + added
        used = float(state["used_neurons"])
        _save_state(state)

    logger.info(
        "ai_budget provider=%s capability=%s model=%s "
        "neurons_est=%.2f used_today=%.2f budget=%s",
        PROVIDER_NAME,
        capability,
        model,
        added,
        used,
        budget if budget is not None else "off",
    )
    return added
