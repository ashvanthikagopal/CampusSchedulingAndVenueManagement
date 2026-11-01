"""
Multi-tier AI orchestration layer.
Supports:
1. Primary: Groq (high-speed LLaMA/Qwen API)
2. Secondary: Google Gemini API (automatic fallback on Groq error, rate limits, or token exhaustion)
3. Tertiary: Deterministic Pure-Python Rules Engine (100% offline fallback)
"""
import os
import json
import logging
from typing import Dict, Any, List, Optional, Tuple, Callable
from backend.app.core.config import settings

logger = logging.getLogger("cit_scheduler.ai")


def call_llm_json(system_instruction: str, user_content: str) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    Calls primary LLM (Groq) for JSON output; falls back to secondary (Gemini) on any failure.
    Returns (parsed_json_dict, provider_name).
    provider_name is one of 'groq', 'gemini', or 'rule_fallback'.
    """
    # --- 1. Primary: Groq ---
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": user_content}
                ],
                response_format={"type": "json_object"},
                temperature=0.1
            )
            raw_text = response.choices[0].message.content or "{}"
            parsed = json.loads(raw_text)
            logger.info(f"[AI Multi-Tier] Successfully served JSON request via primary provider Groq ({settings.GROQ_MODEL}).")
            return parsed, "groq"
        except Exception as groq_err:
            logger.warning(
                f"[AI Multi-Tier] Primary provider Groq failed: {groq_err}. "
                "Failing over to secondary provider Gemini..."
            )

    # --- 2. Secondary: Gemini ---
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            gemini_models = [settings.GEMINI_MODEL, "gemini-3.5-flash-lite", "gemini-3.5-flash"]
            last_gemini_err = None

            for model_name in gemini_models:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=user_content,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            temperature=0.1,
                            response_mime_type="application/json"
                        )
                    )
                    raw_text = response.text or "{}"
                    parsed = json.loads(raw_text)
                    logger.info(f"[AI Multi-Tier] Successfully served JSON request via secondary provider Gemini ({model_name}).")
                    return parsed, "gemini"
                except Exception as m_err:
                    last_gemini_err = m_err
                    if "503" in str(m_err) or "UNAVAILABLE" in str(m_err) or "404" in str(m_err):
                        continue
                    raise m_err

            if last_gemini_err:
                raise last_gemini_err

        except Exception as gemini_err:
            logger.warning(
                f"[AI Multi-Tier] Secondary provider Gemini failed: {gemini_err}. "
                "Failing over to tertiary deterministic rules engine..."
            )

    # --- 3. Tertiary Fallback ---
    logger.info("[AI Multi-Tier] Using tertiary deterministic fallback engine.")
    return None, "rule_fallback"

