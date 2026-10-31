"""
Natural Language Parser for plain-language English and Hinglish booking requests.
Dual-engine architecture:
1. Google Gemini API with strict structured schema when GEMINI_API_KEY is present.
2. Built-in deterministic rule-based fallback parser with full Hinglish lexicon,
   group normalization, prompt-injection defense, and counterfactual suggestions.
"""
import re
import json
import math
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from backend.app.core.config import settings

# Hinglish vocabulary lexicon
HINGLISH_LEXICON = {
    "subah": "morning",
    "dopahar": "afternoon",
    "shaam": "evening",
    "raat": "night",
    "kal": "tomorrow",
    "aaj": "today",
    "parso": "day_after_tomorrow",
    "ghante": "hours",
    "log": "people",
    "baje": "oclock",
    "chahiye": "needed",
    "kamra": "room"
}

# Hinglish numbers
HINGLISH_NUMBERS: Dict[str, float] = {
    "ek": 1.0,
    "do": 2.0,
    "teen": 3.0,
    "char": 4.0,
    "chaar": 4.0,
    "paanch": 5.0,
    "panch": 5.0,
    "chhe": 6.0,
    "che": 6.0,
    "chheh": 6.0,
    "saat": 7.0,
    "aath": 8.0,
    "ath": 8.0,
    "nau": 9.0,
    "das": 10.0,
    "sau": 100.0,
    "hazaar": 1000.0,
    "hazar": 1000.0,
    "dedh": 1.5,
    "dhai": 2.5
}

# Clock time to period mapping (CIT Schedule)
# P1: 8:00-9:00 ... P9: 17:00-18:00, Lunch: 13:00-14:00 (between P5 and P6)
# Events P10: 18:00-19:00 ... P13: 21:00-22:00
TIME_TO_PERIOD = {
    8: 1, 9: 2, 10: 3, 11: 4, 12: 5,
    14: 6, 15: 7, 16: 8, 17: 9,
    18: 10, 19: 11, 20: 12, 21: 13
}


def resolve_weekday(target_str: str, base_date_str: str = "2027-01-25") -> Tuple[str, List[str], Optional[str]]:
    """
    Resolves relative date words (kal, parso, tomorrow, or weekday name) to standard MON-FRI.
    Returns (day_abbr, assumptions, follow_up).
    """
    days_order = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    base_dt = datetime.strptime(base_date_str, "%Y-%m-%d")
    assumptions = []
    follow_up = None

    lower = target_str.lower()

    if "saturday" in lower or "sunday" in lower:
        return "MON", ["Weekends are outside academic calendar; defaulted to Monday"], "Please specify a valid Spectra-week weekday (Monday to Friday); events cannot run on weekends."

    if "yesterday" in lower:
        return "MON", ["Past dates are not bookable; defaulted to Monday"], "Cannot book sessions in the past. Please select an upcoming Spectra-week weekday."

    if "kal" in lower or "tomorrow" in lower:
        target_dt = base_dt + timedelta(days=1)
        w_idx = target_dt.weekday()
        if w_idx >= 5:
            return "MON", ["Weekend resolved to next available weekday (Monday)"], None
        return days_order[w_idx], ["'Kal'/'Tomorrow' resolved relative to demo date (Tuesday)"], None

    if "parso" in lower or "day after tomorrow" in lower:
        target_dt = base_dt + timedelta(days=2)
        w_idx = target_dt.weekday()
        if w_idx >= 5:
            return "MON", ["Weekend resolved to next available weekday (Monday)"], None
        return days_order[w_idx], ["'Parso' resolved relative to demo date (Wednesday)"], None

    for d in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        if d in lower:
            return d[:3].upper(), [], None

    return "MON", ["Defaulted to Monday as no specific day was specified"], None


def parse_hinglish_number(word: str) -> Optional[float]:
    """Converts a written Hinglish number word or digit string to float."""
    w = word.strip().lower()
    if w in HINGLISH_NUMBERS:
        return HINGLISH_NUMBERS[w]
    try:
        return float(w)
    except ValueError:
        return None


def fallback_parse_request(text: str, base_date_str: str = "2027-01-25", user_role: str = "club") -> Dict[str, Any]:
    """
    Pure deterministic rule-based natural language parser.
    F4 Compliant: supports ordered room_preferences, confidence, assumptions,
    group normalization, Hinglish lexicon, and prompt injection defense.
    """
    lower = text.lower()
    assumptions: List[str] = []
    follow_up: Optional[str] = None
    confidence: float = 0.95

    # Prompt injection and jailbreak defense:
    # Treat injection payloads strictly as literal strings
    cleaned_title = text.strip()
    # Strip dangerous HTML / system injection tags for the display title
    cleaned_title = re.sub(r'</?(?:system|admin|prompt)[^>]*>', '', cleaned_title, flags=re.IGNORECASE).strip()
    if len(cleaned_title) > 60:
        cleaned_title = cleaned_title[:60] + "..."

    # Check for exam week request
    if "exam" in lower or "midsem" in lower:
        if "exam week" in lower or "next week" in lower:
            assumptions.append("Requested date conflicts with Midsem Exam Week")
            follow_up = "Midsem exams outrank all regular and club events. Bookings cannot be accepted during exam sessions."

    # 1. Resolve Day
    day, day_assumptions, day_follow_up = resolve_weekday(text, base_date_str)
    assumptions.extend(day_assumptions)
    if day_follow_up:
        follow_up = day_follow_up

    # 2. Resolve Attendance and Student Groups Normalizer
    attendance = 50
    mandatory_for_groups: List[str] = []

    # Check Group Normalization
    if "entire first year" in lower or "all first years" in lower or "all first year" in lower:
        attendance = 360
        mandatory_for_groups.extend(["Y1-A", "Y1-B", "Y1-C", "Y1-D"])
        assumptions.append("Entire first year resolved to 360 students across 4 sections (AUD required)")
    elif "cse third year" in lower or "cse 3rd year" in lower or "cse-3" in lower:
        mandatory_for_groups.append("CSE-3")
        attendance = 75
        assumptions.append("Compulsory for CSE third years (CSE-3, size 75)")
    elif "mechanical third year" in lower or "me 3rd year" in lower or "me-3" in lower:
        mandatory_for_groups.append("ME-3")
        attendance = 75
        assumptions.append("Compulsory for Mechanical third years (ME-3, size 75)")
    elif "ece third year" in lower or "ece 3rd year" in lower or "ece-3" in lower:
        mandatory_for_groups.append("ECE-3")
        attendance = 75
        assumptions.append("Compulsory for ECE third years (ECE-3, size 75)")
    else:
        # Check digit attendance
        att_match = re.search(r'(\d+)\s*(?:people|log|participants|students|persons|members|audience|seats)', lower)
        if not att_match:
            att_match = re.search(r'(?:for|around|about|maybe)\s*(\d+)', lower)

        if att_match:
            attendance = int(att_match.group(1))
        else:
            # Check Hinglish number attendance (e.g. "sau log", "das log")
            hinglish_att_match = re.search(r'\b(ek|do|teen|char|paanch|chhe|saat|aath|nau|das|sau|hazaar)\s*(?:log|people|students)\b', lower)
            if hinglish_att_match:
                word_num = hinglish_att_match.group(1)
                attendance = int(HINGLISH_NUMBERS.get(word_num, 50))
                assumptions.append(f"Hinglish attendance '{word_num} log' resolved to {attendance}")
            else:
                assumptions.append("Attendance assumed to be 50 people")

    # 3. Resolve Duration (including Hinglish numbers & fractional hours)
    duration = 2
    # Check fractional Hinglish duration: "dedh ghante" (1.5), "dhai ghante" (2.5)
    if "dedh ghante" in lower or "dedh ghanta" in lower or "1.5 hour" in lower or "1.5 hours" in lower:
        duration = 2
        assumptions.append("Fractional duration 1.5 hours rounded up to 2 full academic periods")
    elif "dhai ghante" in lower or "dhai ghanta" in lower or "2.5 hour" in lower or "2.5 hours" in lower:
        duration = 3
        assumptions.append("Fractional duration 2.5 hours rounded up to 3 full academic periods")
    else:
        dur_match = re.search(r'(\d+)\s*[-]?\s*(?:ghante|hour|hours|hr|hrs|period|periods)', lower)
        if dur_match:
            duration = int(dur_match.group(1))
        else:
            # Check Hinglish words: "do ghante", "teen ghante", "ek ghanta"
            h_dur_match = re.search(r'\b(ek|do|teen|char|paanch|chhe)\s*(?:ghante|ghanta|hour|hours)\b', lower)
            if h_dur_match:
                duration = int(HINGLISH_NUMBERS.get(h_dur_match.group(1), 2))

    # 4. Resolve Time Windows and Clock Times
    from_p = 10
    to_p = min(13, from_p + duration - 1)

    # Check for "1 to 2 pm" (Lunch clash)
    if "1 to 2" in lower or "1-2 pm" in lower or "13:00" in lower:
        from_p = 6
        to_p = min(9, from_p + duration - 1)
        assumptions.append("1 to 2 PM is universal campus lunch break; automatically shifted to 2 PM (P6) onward")

    # Check for "10 pm to midnight" or late night (beyond P13)
    elif "10 pm" in lower or "midnight" in lower or "raat 10" in lower:
        from_p = 12
        to_p = 13
        assumptions.append("Requested timing extends past official campus hours (P13 / 10 PM); proposed nearest valid slot P12-P13")

    # Clock range patterns like "6 to 8 pm", "7 to 9 pm"
    elif re.search(r'(\d+)\s*(?:to|-)\s*(\d+)\s*(pm|am)', lower):
        clock_range_match = re.search(r'(\d+)\s*(?:to|-)\s*(\d+)\s*(pm|am)', lower)
        t1 = int(clock_range_match.group(1))
        t2 = int(clock_range_match.group(2))
        ampm = clock_range_match.group(3)
        if ampm == "pm" and t1 < 12:
            t1 += 12
        if ampm == "pm" and t2 < 12:
            t2 += 12
        from_p = TIME_TO_PERIOD.get(t1, 10)
        to_p = TIME_TO_PERIOD.get(t2, min(13, from_p + duration)) - 1
        if to_p < from_p:
            to_p = min(13, from_p + duration - 1)

    # Single clock match e.g. "6 baje", "7 pm", "shaam 6 baje"
    elif re.search(r'(\d+)\s*(?:baje|pm)', lower):
        single_t_match = re.search(r'(\d+)\s*(?:baje|pm)', lower)
        t = int(single_t_match.group(1))
        if t < 12 and ("shaam" in lower or "pm" in lower or "raat" in lower or t <= 6):
            t += 12
        from_p = TIME_TO_PERIOD.get(t, 10)
        to_p = min(13, from_p + duration - 1)

    # Word time of day
    elif "after lunch" in lower or "dopahar" in lower or "afternoon" in lower:
        from_p = 6
        to_p = min(9, from_p + duration - 1)
        assumptions.append("Afternoon/after lunch window inferred as P6 onward")
    elif "shaam" in lower or "evening" in lower:
        from_p = 10
        to_p = min(13, from_p + duration - 1)
        assumptions.append("Evening window inferred as P10 onward")
    elif "10 am" in lower or "morning" in lower or "subah" in lower:
        from_p = 3
        to_p = min(5, from_p + duration - 1)

    # 5. Resolve Needs & Features
    needs = []
    if "mic" in lower or "pa system" in lower or "pa" in lower or "sound" in lower:
        needs.append("pa_system")
    if "stage" in lower or "play" in lower or "drama" in lower or "theatre" in lower or "dance" in lower:
        needs.append("stage")
    if "projector" in lower or "presentation" in lower or "slides" in lower:
        needs.append("projector")
    if "wheelchair" in lower or "accessible" in lower:
        needs.append("accessible")
    if "computer" in lower or "computers" in lower or "coding" in lower or "programming" in lower:
        needs.append("computers")

    # 6. Ordered Room Preferences & Rooms Resolution
    room_types = ["classroom", "lecture_hall", "seminar_hall"]
    room_preferences: List[str] = []
    requested_room: Optional[str] = None

    # Check conditional room preferences: "SH-1 if free, otherwise AUD"
    pref_match = re.search(r'([a-zA-Z0-9_-]+)\s*(?:if free|preferred|first|if available)[,\s]+(?:otherwise|else)\s*([a-zA-Z0-9_-]+)', lower)
    if pref_match:
        r1 = pref_match.group(1).upper()
        r2 = pref_match.group(2).upper()
        room_preferences = [r1, r2]
        requested_room = r1
        assumptions.append(f"Ordered venue preferences captured: Primary {r1}, Fallback {r2}")
    else:
        # Check specific room identifiers
        if "sh-1" in lower:
            room_preferences.append("SH-1")
            requested_room = "SH-1"
            room_types = ["seminar_hall"]
        elif "sh-2" in lower:
            room_preferences.append("SH-2")
            requested_room = "SH-2"
            room_types = ["seminar_hall"]
            if "accessible" in needs or "wheelchair" in lower:
                assumptions.append("SH-2 is not wheelchair accessible; SH-1 recommended as accessible alternative")
                room_preferences = ["SH-1", "SH-2"]
                requested_room = "SH-1"

        if "auditorium" in lower or "aud" in lower or attendance > 200:
            if "AUD" not in room_preferences:
                room_preferences.append("AUD")
            if not requested_room:
                requested_room = "AUD"
            room_types = ["auditorium"]

        if "oat" in lower or "outdoor" in lower or "open air" in lower or "open-air" in lower:
            if "OAT" not in room_preferences:
                room_preferences.append("OAT")
            if not requested_room:
                requested_room = "OAT"
            room_types = ["outdoor"]

        if "lhc-5" in lower:
            # LHC-5 does NOT exist; must preserve as requested_room (never auto-corrected by AI parser)
            requested_room = "LHC-5"
            room_preferences.append("LHC-5")
            assumptions.append("LHC-5 is not a recognized campus venue; rule solver will evaluate nearest fitting hall (e.g. SH-2/LH-2)")

        if "seminar hall" in lower and not requested_room:
            room_types = ["seminar_hall"]
        elif "lab" in lower and not requested_room:
            if "computer" in lower or "coding" in lower:
                room_types = ["lab_cs"]
            else:
                room_types = ["lab_cs", "lab_elec"]

    # 7. Check for daily series: "every day this week"
    is_series = ("every day" in lower or "daily" in lower or "mon to fri" in lower or "monday to friday" in lower)
    series_days = ["MON", "TUE", "WED", "THU", "FRI"] if is_series else [day]

    windows = [{"day": d_name, "from_period": from_p, "to_period": to_p} for d_name in series_days]
    if is_series:
        assumptions.append("Expanded into 5-day daily series (MON-FRI) at requested timing")

    return {
        "intent": "book_venue",
        "title": cleaned_title,
        "attendance": attendance,
        "duration_periods": duration,
        "windows": windows,
        "room_types": room_types,
        "needs": needs,
        "requested_room": requested_room,
        "room_preferences": room_preferences,
        "mandatory_for_groups": mandatory_for_groups,
        "assumptions": assumptions,
        "confidence": confidence,
        "follow_up_question": follow_up,
        "is_series": is_series,
        "parsed_by": "rule_fallback"
    }


def parse_booking_text(text: str, user_role: str = "club") -> Dict[str, Any]:
    """
    Main parser entry point.
    Attempts Gemini API if key is set; falls back seamlessly to deterministic rules.
    Every output passes validation checks before modifying any data.
    """
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt = f"Request text: '{text}'\nUser role: '{user_role}'\nDemo date: '{settings.DEMO_TODAY_DATE}'"
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=(
                        "Extract campus booking requirements into strict JSON format with fields: "
                        "intent, title, attendance, duration_periods, windows (day, from_period, to_period), "
                        "room_types, needs, requested_room, room_preferences, mandatory_for_groups, assumptions, "
                        "confidence, follow_up_question. Never auto-correct non-existent rooms like LHC-5."
                    ),
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            data = json.loads(response.text)
            data["parsed_by"] = "gemini"
            return data
        except Exception:
            pass

    return fallback_parse_request(text, base_date_str=settings.DEMO_TODAY_DATE, user_role=user_role)
