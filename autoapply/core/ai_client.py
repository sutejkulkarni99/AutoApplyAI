"""
Google AI Studio client with strict rate limiting and token bucket throttling.
Uses the official `google-genai` SDK (v1 API).
"""

import json
import logging
import re
import time
from collections import deque
from datetime import datetime, date
from typing import Any, Callable, Dict, List, Optional

from google import genai
from google.genai import types

from config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Token bucket and sliding window rate limiter to guarantee compliance with
    Google AI Studio free/tier rate limits (10 RPM / 1500 RPD).
    Enforces a conservative ceiling (default 6 RPM) to prevent any 429 quota exhaustion.
    """

    def __init__(self, max_rpm: int = 6, max_rpd: int = 1500):
        self.max_rpm = max_rpm
        self.max_rpd = max_rpd
        self.minute_timestamps: deque = deque()
        self.day_timestamps: deque = deque()
        self.current_day: date = datetime.now().date()
        self.on_cooldown_callback: Optional[Callable[[str], None]] = None

    def _cleanup_old_records(self, now: float):
        # Clean timestamps older than 60 seconds
        cutoff_minute = now - 60.0
        while self.minute_timestamps and self.minute_timestamps[0] < cutoff_minute:
            self.minute_timestamps.popleft()

        # Reset daily counter on date rollover
        today = datetime.now().date()
        if today != self.current_day:
            self.day_timestamps.clear()
            self.current_day = today

    def get_remaining_rpm(self) -> int:
        self._cleanup_old_records(time.time())
        return max(0, self.max_rpm - len(self.minute_timestamps))

    def get_remaining_rpd(self) -> int:
        self._cleanup_old_records(time.time())
        return max(0, self.max_rpd - len(self.day_timestamps))

    def acquire(self):
        """Block until an API token is safely available under both RPM and RPD limits."""
        while True:
            now = time.time()
            self._cleanup_old_records(now)

            # Check daily quota
            if len(self.day_timestamps) >= self.max_rpd:
                msg = "Daily rate limit reached (1500 RPD). Please try again tomorrow."
                if self.on_cooldown_callback:
                    self.on_cooldown_callback(msg)
                raise RuntimeError(msg)

            # Check minute quota
            if len(self.minute_timestamps) < self.max_rpm:
                self.minute_timestamps.append(now)
                self.day_timestamps.append(now)
                break

            # Calculate sleep duration to clear the oldest request in the window
            oldest = self.minute_timestamps[0]
            sleep_duration = max(0.5, (oldest + 60.0) - now + 0.1)
            msg = f"Rate limit throttling: cooling down for {sleep_duration:.1f}s (Queue safety)..."
            logger.info(msg)
            if self.on_cooldown_callback:
                self.on_cooldown_callback(msg)
            time.sleep(sleep_duration)


class GeminiClient:
    """
    Client for interacting with Google AI Studio using the `google-genai` SDK.
    Features automated retry logic with exponential backoff and JSON mode enforcement.
    """

    SYSTEM_PROMPT = (
        "You are a professional career document assistant. "
        "You may ONLY use information explicitly present in the user's profile. "
        "You must NEVER invent skills, jobs, metrics, or qualifications. "
        "If information is missing, state it clearly as a gap."
    )

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.google_ai_studio_api_key
        if not self.api_key:
            logger.warning("GOOGLE_AI_STUDIO_API_KEY is not set. Requests will fail until configured.")
        
        self.client = genai.Client(api_key=self.api_key) if self.api_key else None
        self.rate_limiter = RateLimiter(
            max_rpm=settings.rate_limit_rpm,
            max_rpd=settings.rate_limit_rpd
        )

    def set_api_key(self, api_key: str):
        self.api_key = api_key
        self.client = genai.Client(api_key=self.api_key)

    def _execute_with_retry(self, prompt: str, schema: Optional[Dict[str, Any]] = None, max_retries: int = 4) -> Dict[str, Any]:
        if not self.client:
            raise ValueError("Google AI Studio API key not configured. Set GOOGLE_AI_STUDIO_API_KEY in environment or settings.")

        config = types.GenerateContentConfig(
            system_instruction=self.SYSTEM_PROMPT,
            temperature=0.2,
            response_mime_type="application/json"
        )

        last_error = None
        for attempt in range(1, max_retries + 1):
            try:
                self.rate_limiter.acquire()
                logger.info(f"Dispatching Gemini request (Attempt {attempt}/{max_retries})...")
                
                response = self.client.models.generate_content(
                    model=settings.ai_model,
                    contents=prompt,
                    config=config
                )
                
                raw_text = response.text or "{}"
                # Clean any stray markdown ticks if present
                clean_json = re.sub(r"^```json\s*", "", raw_text, flags=re.MULTILINE)
                clean_json = re.sub(r"^```\s*$", "", clean_json, flags=re.MULTILINE).strip()
                
                return json.loads(clean_json)

            except Exception as e:
                last_error = e
                err_str = str(e)
                logger.warning(f"Gemini API call failed on attempt {attempt}: {err_str}")
                if attempt < max_retries:
                    # Longer exponential backoff for high demand 503 or rate limit 429
                    backoff = 4.0 * (2.0 ** (attempt - 1))
                    logger.info(f"Retrying in {backoff:.1f}s...")
                    time.sleep(backoff)
                else:
                    break

        raise RuntimeError(f"Google AI Studio request failed after {max_retries} attempts: {str(last_error)}")

    def analyze_job(self, profile_yaml_str: str, job_description: str) -> Dict[str, Any]:
        """
        Pass 1: Analyze job description against profile YAML.
        Strictly outputs JSON plan with indices referencing profile data without hallucination.
        """
        prompt = f"""
TASK: Pass 1 Job Analysis & Tailoring Blueprint
You must analyze the following job description against the provided candidate profile YAML.

RULES:
1. Identify Must-Have and Nice-to-Have job requirements.
2. Select only existing profile skills, experiences, and education entries.
3. Every selected bullet index MUST refer to an existing bullet in experience[i].bullets.
4. If a job requirement is NOT present in the candidate profile, DO NOT invent experience. List it in "gaps.missing_skills" or "gaps.missing_requirements".
5. Estimate word counts to ensure the CV fits comfortably within 2 pages (max 450 words) and Cover Letter within 1 page (max 300 words).

CANDIDATE MASTER PROFILE (YAML):
```yaml
{profile_yaml_str}
```

JOB DESCRIPTION:
```
{job_description}
```

Respond with strict JSON matching this structure:
{{
  "job_analysis": {{
    "title": "Exact or inferred role title",
    "company": "Company name",
    "must_have": ["key requirement 1", "key requirement 2"],
    "nice_to_have": ["optional requirement 1"],
    "tone": "formal|casual|technical|creative"
  }},
  "content_plan": {{
    "summary_variant": "technical|leadership|general",
    "dynamic_header_title": "Targeted title for CV header",
    "selected_skills": [
      {{"name": "Exact skill name from profile", "category": "Category name"}}
    ],
    "selected_experience": [
      {{
        "company": "Company from profile",
        "title": "Title from profile",
        "selected_bullets": [0, 1, 2],
        "priority": 1
      }}
    ],
    "education_entries": [0, 1, 2],
    "include_projects": true,
    "certifications_to_include": [0, 1]
  }},
  "gaps": {{
    "missing_skills": ["List of missing skills not in profile"],
    "missing_requirements": ["Requirements candidate does not meet"],
    "strategy": "How to highlight adjacent candidate strengths truthfully"
  }},
  "estimated_length": {{
    "cv_words": 380,
    "cover_words": 260
  }}
}}
"""
        return self._execute_with_retry(prompt)

    def generate_cv_fragments(self, analysis: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Pass 2: Generate tailored LaTeX string fragments for the CV template.
        LaTeX special characters must be properly escaped.
        """
        prompt = f"""
TASK: Pass 2 LaTeX CV Fragment Generator
Generate clean LaTeX code fragments to be injected into the candidate's LaTeX CV template based on the Pass 1 analysis.

RULES:
1. ONLY rephrase and reorder candidate bullets from their profile. DO NOT hallucinate any new metrics, companies, or tools.
2. Escape all LaTeX special characters: & -> \\&, % -> \\%, $ -> \\$, # -> \\#, _ -> \\_, {{ -> \\{{, }} -> \\}}.
3. Ensure the formatting aligns cleanly with the LaTeX template structure.
4. Total length must fit within 2 pages.

PASS 1 ANALYSIS:
```json
{json.dumps(analysis, indent=2)}
```

CANDIDATE MASTER PROFILE:
```json
{json.dumps(profile, indent=2)}
```

Respond with strict JSON matching this structure:
{{
  "dynamic_header_title": "Battery Systems \\textbar\\ Electronics \\textbar\\ Test \\& Validation",
  "professional_summary": "Tailored summary paragraph (LaTeX-escaped)...",
  "skills_section": "\\textbf{{Battery Systems}}\n\\begin{{itemize}}\n    \\item 48V hybrid systems, ultracapacitor packs...\n\\end{{itemize}}\n...",
  "experience_sections": "\\textbf{{Working Student --- Hardware Development (BMW Project)}} \\hfill \\textit{{Oct 2023 -- Mar 2025}}\\\\\n\\textit{{Accenture (umlaut systems), Böblingen, Germany}}\n\\begin{{itemize}}\n    \\item Tailored bullet 1...\n    \\item Tailored bullet 2...\n\\end{{itemize}}\n\n...",
  "education_section": "\\textbf{{M.Sc. Electromobility (ACES)}} \\hfill \\textit{{2025 -- Present}}\\\\\n\\textit{{FAU Erlangen--Nürnberg, Germany}}\n\\begin{{itemize}}\n    \\item Focus on battery systems...\n\\end{{itemize}}\n...",
  "projects_section": "\\textbf{{Personal Battery Systems Exploration (ongoing)}}\n\\begin{{itemize}}\n    \\item Collecting and reviving used lithium-ion cells...\n\\end{{itemize}}",
  "languages_section": "English --- Fluent\\\\\nGerman --- A2 (improving; reading stronger than speaking)"
}}
"""
        return self._execute_with_retry(prompt)

    def generate_cover_letter(self, analysis: Dict[str, Any], profile: Dict[str, Any]) -> Dict[str, Any]:
        """
        Pass 3: Generate a tailored 1-page Cover Letter matching the target job tone.
        """
        job_info = analysis.get("job_analysis", {})
        tone = job_info.get("tone", "formal")
        
        prompt = f"""
TASK: Pass 3 Cover Letter Generator
Generate a compelling, 1-page LaTeX cover letter for the specified role.

RULES:
1. Candidate profile facts ONLY. No invented projects or experiences.
2. Tone matching: If job tone is '{tone}', adapt writing accordingly (crisp & professional for formal; warmer for casual).
3. Escape LaTeX characters: & -> \\&, % -> \\%, $ -> \\$, # -> \\_, etc.
4. Total length MUST be under 300 words to strictly enforce the 1-page limit.

PASS 1 ANALYSIS & TARGET ROLE:
```json
{json.dumps(analysis, indent=2)}
```

CANDIDATE MASTER PROFILE:
```json
{json.dumps(profile, indent=2)}
```

Respond with strict JSON matching this structure:
{{
  "recipient_company": "{job_info.get('company', 'Hiring Company GmbH')}",
  "recipient_location": "Recruitment Department / Germany",
  "subject_line": "Application as {job_info.get('title', 'Engineer')} — {profile.get('personal', {}).get('name', 'Candidate')}",
  "salutation": "Dear Hiring Team,",
  "body_paragraph_1": "Opening motivation referencing the specific company and role, explaining enthusiasm for their hardware/product domain...",
  "body_paragraph_2": "Core relevant technical achievements directly bridging profile experiences (e.g. 48V hybrid, BMS load testing, BMW validation) to their must-have requirements...",
  "body_paragraph_3": "Independent drive and hands-on laboratory capabilities that demonstrate fast onboarding and reliable execution...",
  "closing": "Thank you for considering my application. I look forward to the opportunity of discussing my contributions in an interview."
}}
"""
        return self._execute_with_retry(prompt)
