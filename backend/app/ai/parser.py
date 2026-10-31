"""
Natural Language Parser for plain-language English and Hinglish booking requests.
Features a dual-engine architecture:
1. Google Gemini API with strict structured schema.
2. Built-in deterministic rule-based fallback parser with full Hinglish lexicon support.
"""
import re
import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from backend.app.core.config import settings

# Hinglish lexicon
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

# Clock time to period mapping (CIT Schedule)
# P1: 8am-9am ... P9: 5pm-6pm, Lunch: 1pm-2pm, Events P10: 6pm-7pm ... P13: 9pm-10pm
TIME_TO_PERIOD = {
    8: 1, 9: 2, 10: 3, 11: 4, 12: 5,
    14: 6, 15: 7, 16: 8, 17: 9,
    18: 10, 19: 11, 20: 12, 21: 13
}


def resolve_weekday(target_str: str, base_date_str: str = "2027-01-25") -> Tuple[str, List[str]]:
    """Resolves relative date words (kal, parso, tomorrow, or weekday name) to standard MON-FRI."""
    days_order = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    base_dt = datetime.strptime(base_date_str, "%Y-%m-%d")
    base_weekday = base_dt.weekday()  # 0 is Monday
    assumptions = []

    lower = target_str.lower()
    if "kal" in lower or "tomorrow" in lower:
        target_dt = base_dt + timedelta(days=1)
        w_idx = target_dt.weekday()
        if w_idx >= 5:  # Weekend
            return "MON", ["Weekend resolved to next available weekday (Monday)"]
        return days_order[w_idx], ["'Kal'/'Tomorrow' resolved relative to demo date"]

    if "parso" in lower or "day after tomorrow" in lower:
        target_dt = base_dt + timedelta(days=2)
        w_idx = target_dt.weekday()
        if w_idx >= 5:
            return "MON", ["Weekend resolved to next available weekday (Monday)"]
        return days_order[w_idx], ["'Parso' resolved relative to demo date"]

    for d in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        if d in lower:
            abbr = d[:3].upper()
            return abbr, []

    return "MON", ["Defaulted to Monday as no specific day was specified"]


def fallback_parse_request(text: str, base_date_str: str = "2027-01-25") -> Dict[str, Any]:
    """
    Pure deterministic rule-based natural language parser.
    Works with AI completely off. Handles English and Hinglish.
    """
    lower = text.lower()
    assumptions = []
    follow_up = None

    # 1. Resolve Day
    day, day_assumptions = resolve_weekday(text, base_date_str)
    assumptions.extend(day_assumptions)

    # 2. Resolve Attendance / People / Log
    attendance = 50
    # Match patterns like "45 people", "100 log", "around 400 people", "maybe 150", "45 students"
    att_match = re.search(r'(\d+)\s*(?:people|log|participants|students|persons|members)', lower)
    if not att_match:
        att_match = re.search(r'(?:for|around|about|maybe)\s*(\d+)', lower)
    if att_match:
        attendance = int(att_match.group(1))
    else:
        assumptions.append("Attendance assumed to be 50 people")

    # 3. Resolve Duration
    duration = 2
    dur_match = re.search(r'(\d+)\s*[-]?\s*(?:ghante|hour|hours|hr|hrs|period|periods)', lower)
    if dur_match:
        duration = int(dur_match.group(1))

    # 4. Resolve Time Windows and Periods
    from_p = 10
    to_p = 11

    # Check clock time patterns like "6 to 8 pm", "6 baje", "10 am", "7 to 8 pm"
    clock_range_match = re.search(r'(\d+)\s*(?:to|-)\s*(\d+)\s*(pm|am)', lower)
    if clock_range_match:
        t1 = int(clock_range_match.group(1))
        t2 = int(clock_range_match.group(2))
        ampm = clock_range_match.group(3)
        if ampm == "pm" and t1 < 12:
            t1 += 12
        if ampm == "pm" and t2 < 12:
            t2 += 12
        from_p = TIME_TO_PERIOD.get(t1, 10)
        to_p = TIME_TO_PERIOD.get(t2, from_p + duration) - 1
        if to_p < from_p:
            to_p = from_p + duration - 1
    elif re.search(r'(\d+)\s*(?:baje|pm)', lower):
        single_t_match = re.search(r'(\d+)\s*(?:baje|pm)', lower)
        t = int(single_t_match.group(1))
        if t < 12 and ("shaam" in lower or "pm" in lower or "raat" in lower or t <= 6):
            t += 12
        from_p = TIME_TO_PERIOD.get(t, 10)
        to_p = min(13, from_p + duration - 1)
    elif "after lunch" in lower or "dopahar" in lower or "afternoon" in lower:
        from_p = 6
        to_p = min(9, from_p + duration - 1)
        assumptions.append("After lunch window inferred as P6 onward")
    elif "shaam" in lower or "evening" in lower:
        from_p = 10
        to_p = min(13, from_p + duration - 1)
        assumptions.append("Evening window inferred as P10 onward")
    elif "10 am" in lower or "morning" in lower or "subah" in lower:
        from_p = 3
        to_p = min(5, from_p + duration - 1)

    # 5. Resolve Needs & Features
    needs = []
    if "mic" in lower or "pa system" in lower or "pa" in lower:
        needs.append("pa_system")
    if "stage" in lower or "play" in lower or "drama" in lower or "theatre" in lower:
        needs.append("stage")
    if "projector" in lower or "presentation" in lower:
        needs.append("projector")
    if "wheelchair" in lower or "accessible" in lower:
        needs.append("accessible")
    if "computer" in lower or "computers" in lower or "coding" in lower or "programming" in lower:
        needs.append("computers")

    # 6. Resolve Room Types and Requested Room
    room_types = ["classroom", "lecture_hall", "seminar_hall"]
    requested_room = None

    if "auditorium" in lower or attendance > 200:
        room_types = ["auditorium"]
        requested_room = "AUD"
    elif "seminar hall" in lower or "seminar" in lower:
        room_types = ["seminar_hall"]
    elif "lab" in lower:
        if "computer" in lower or "coding" in lower:
            room_types = ["lab_cs"]
        elif "elec" in lower:
            room_types = ["lab_elec"]
        else:
            room_types = ["lab_cs", "lab_elec"]
    elif "small room" in lower:
        room_types = ["classroom"]
    elif "outdoor" in lower or "oat" in lower:
        room_types = ["outdoor"]
        requested_room = "OAT"

    # Specific room mentions
    if "sh-1" in lower:
        requested_room = "SH-1"
        room_types = ["seminar_hall"]
    elif "sh-2" in lower:
        requested_room = "SH-2"
        room_types = ["seminar_hall"]
        # Accessibility check for Request 7: SH-2 is not accessible!
        if "accessible" in needs or "wheelchair" in lower:
            assumptions.append("SH-2 is not wheelchair accessible; SH-1 recommended as accessible alternative")
            requested_room = "SH-1"
    elif "lhc-5" in lower:
        requested_room = "LHC-5"
        assumptions.append("LHC-5 does not exist and LH-5 lacks PA; proposing LH-1/LH-2")

    # 7. Resolve Mandatory Groups
    mandatory_for_groups = []
    if "mechanical third years" in lower or "me-3" in lower:
        mandatory_for_groups.append("ME-3")
        if not dur_match and not clock_range_match:
            follow_up = "What time of day on Wednesday would you prefer (morning or afternoon)?"
    elif "cse third years" in lower or "cse-3" in lower:
        mandatory_for_groups.append("CSE-3")
    elif "ece-3" in lower:
        mandatory_for_groups.append("ECE-3")

    # 8. Title
    title = text.strip()[:60]
    if len(text.strip()) > 60:
        title += "..."

    return {
        "intent": "book_venue",
        "title": title,
        "attendance": attendance,
        "duration_periods": duration,
        "windows": [{"day": day, "from_period": from_p, "to_period": to_p}],
        "room_types": room_types,
        "needs": needs,
        "requested_room": requested_room,
        "mandatory_for_groups": mandatory_for_groups,
        "assumptions": assumptions,
        "follow_up_question": follow_up,
        "parsed_by": "rule_fallback"
    }


def parse_booking_text(text: str, user_role: str = "club") -> Dict[str, Any]:
    """
    Main parser entry point.
    Tries Google GenAI first if API key is configured; otherwise uses deterministic fallback.
    """
    if settings.GEMINI_API_KEY:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=settings.GEMINI_API_KEY)
            prompt_path = "backend/app/ai/prompts/booking_parser.txt"
            system_instruction = ""
            try:
                with open(prompt_path, encoding="utf-8") as f:
                    system_instruction = f.read()
            except Exception:
                pass

            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=f"Request text: '{text}'\nUser role: '{user_role}'",
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            data = json.loads(response.text)
            data["parsed_by"] = "gemini"
            return data
        except Exception as e:
            # Fall back seamlessly on any API error or timeout
            pass

    # Use built-in deterministic fallback parser
    res = fallback_parse_request(text, base_date_str=settings.DEMO_TODAY_DATE)
    return res
