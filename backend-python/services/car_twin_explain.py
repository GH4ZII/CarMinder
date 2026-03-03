"""
Ownership twin explanation layer.

Uses OpenAI when configured, and falls back to deterministic rule-based
text when API key/model are not available or request fails.
"""
from __future__ import annotations

import json
from typing import Any, Optional

import httpx

from config.settings import get_settings


def generate_twin_explanation(
    *,
    car_name: str,
    action: str,
    event_type: str,
    assumptions: list[str],
    baseline_score: int,
    projected_score: int,
    baseline_grade: str,
    projected_grade: str,
    baseline_urgency: Optional[str],
    projected_urgency: Optional[str],
    category_deltas: list[dict[str, Any]],
    default_recommendations: list[str],
    fallback_narrative: str,
) -> tuple[str, list[str], str]:
    """Return (narrative, recommendations, source)."""
    settings = get_settings()
    api_key = settings.get("OPENAI_API_KEY")
    model = settings.get("OPENAI_MODEL") or "gpt-4o-mini"
    base_url = settings.get("OPENAI_BASE_URL") or "https://api.openai.com/v1"

    if not api_key:
        return fallback_narrative, _sanitize_recommendations(default_recommendations), "rule_based"

    try:
        prompt_data = {
            "car_name": car_name,
            "action": action,
            "event_type": event_type,
            "assumptions": assumptions,
            "baseline": {
                "score": baseline_score,
                "grade": baseline_grade,
                "urgency": baseline_urgency,
            },
            "projected": {
                "score": projected_score,
                "grade": projected_grade,
                "urgency": projected_urgency,
            },
            "category_deltas": category_deltas,
            "default_recommendations": default_recommendations[:5],
        }

        system_prompt = (
            "You explain maintenance what-if simulations for a car app. "
            "Be concise, practical, and avoid certainty claims. "
            "Return valid JSON with keys: narrative (string), recommendations (array of <=5 strings)."
        )
        user_prompt = (
            "Generate a user-facing explanation for this ownership twin simulation.\n"
            f"Input JSON:\n{json.dumps(prompt_data, ensure_ascii=True)}"
        )

        with httpx.Client(timeout=12.0) as client:
            res = client.post(
                f"{base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
            )
            res.raise_for_status()
            payload = res.json()

        content = (
            payload.get("choices", [{}])[0]
            .get("message", {})
            .get("content", "{}")
        )
        parsed = json.loads(content) if isinstance(content, str) else {}
        narrative = str(parsed.get("narrative") or "").strip()
        recommendations = parsed.get("recommendations") if isinstance(parsed, dict) else []

        if not narrative:
            narrative = fallback_narrative
        recs = _sanitize_recommendations(recommendations)
        if not recs:
            recs = _sanitize_recommendations(default_recommendations)

        return narrative, recs, "llm"
    except Exception:
        return fallback_narrative, _sanitize_recommendations(default_recommendations), "rule_based"


def _sanitize_recommendations(recommendations: Any) -> list[str]:
    if not isinstance(recommendations, list):
        return []
    out: list[str] = []
    for item in recommendations:
        text = str(item).strip()
        if not text:
            continue
        if len(text) > 240:
            text = text[:237].rstrip() + "..."
        out.append(text)
        if len(out) >= 5:
            break
    return out
