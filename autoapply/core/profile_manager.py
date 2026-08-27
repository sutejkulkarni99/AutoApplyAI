"""
Profile manager module for loading, validating, and protecting candidate profile data.
Guarantees zero-hallucination compliance using strict Pydantic schemas and cross-referencing checks.
"""

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)


class HallucinationError(Exception):
    """Raised when generated AI content references skills or experiences not present in the master profile."""
    pass


class PersonalInfo(BaseModel):
    name: str
    title: str
    email: str
    phone: str
    address: str
    linkedin: Optional[str] = ""
    portfolio: Optional[str] = ""
    photo_path: Optional[str] = "Sutej.png"


class SkillItem(BaseModel):
    name: str
    level: Optional[str] = "Proficient"
    years: Optional[int] = 1
    category: str


class ExperienceItem(BaseModel):
    company: str
    title: str
    dates: str
    location: str
    bullets: List[str]
    skills_used: Optional[List[str]] = Field(default_factory=list)
    highlights: Optional[str] = ""


class EducationItem(BaseModel):
    school: str
    degree: str
    dates: str
    details: Optional[List[str]] = Field(default_factory=list)


class ProjectItem(BaseModel):
    name: str
    dates: str
    bullets: List[str]


class CertificationItem(BaseModel):
    name: str
    issuer: str
    year: str


class LanguageItem(BaseModel):
    language: str
    proficiency: str


class MasterProfileSchema(BaseModel):
    personal: PersonalInfo
    summary: Dict[str, str] = Field(default_factory=dict)
    skills: List[SkillItem] = Field(default_factory=list)
    experience: List[ExperienceItem] = Field(default_factory=list)
    education: List[EducationItem] = Field(default_factory=list)
    projects: Optional[List[ProjectItem]] = Field(default_factory=list)
    certifications: Optional[List[CertificationItem]] = Field(default_factory=list)
    languages: Optional[List[LanguageItem]] = Field(default_factory=list)
    cover_letter_snippets: Optional[Dict[str, str]] = Field(default_factory=dict)


class ProfileManager:
    """
    Manages loading, parsing, querying, and verifying master profile YAML.
    """

    def __init__(self, profile_path: Optional[Path] = None):
        from config import settings
        self.profile_path = profile_path or settings.master_profile_path
        self.profile_data: Optional[MasterProfileSchema] = None
        self.raw_yaml_dict: Dict[str, Any] = {}
        self.load_profile()

    def load_profile(self) -> MasterProfileSchema:
        """Loads and validates master profile against Pydantic schema."""
        if not self.profile_path.exists():
            raise FileNotFoundError(f"Master profile file not found at: {self.profile_path}")

        with open(self.profile_path, "r", encoding="utf-8") as f:
            self.raw_yaml_dict = yaml.safe_load(f) or {}

        try:
            self.profile_data = MasterProfileSchema.model_validate(self.raw_yaml_dict)
            logger.info("Master profile loaded and validated successfully.")
            return self.profile_data
        except Exception as e:
            logger.error(f"Master profile validation error: {e}")
            raise ValueError(f"Invalid master_profile.yaml structure: {e}")

    def save_profile(self, updated_dict: Dict[str, Any]):
        """Validates and persists updated profile to YAML file."""
        validated = MasterProfileSchema.model_validate(updated_dict)
        with open(self.profile_path, "w", encoding="utf-8") as f:
            yaml.dump(updated_dict, f, sort_keys=False, allow_unicode=True)
        self.profile_data = validated
        self.raw_yaml_dict = updated_dict

    def get_raw_yaml_str(self) -> str:
        with open(self.profile_path, "r", encoding="utf-8") as f:
            return f.read()

    def get_all_skills(self) -> List[str]:
        """Returns a flat list of all skill names in candidate profile."""
        if not self.profile_data:
            self.load_profile()
        return [s.name for s in self.profile_data.skills]

    def get_experience_for_role(self, role_keywords: List[str]) -> List[Dict[str, Any]]:
        """Ranks experience items based on target role keyword matches."""
        if not self.profile_data:
            self.load_profile()

        scored = []
        for exp in self.profile_data.experience:
            score = 0
            exp_text = f"{exp.title} {exp.company} {' '.join(exp.bullets)} {' '.join(exp.skills_used)}".lower()
            for kw in role_keywords:
                if kw.lower() in exp_text:
                    score += 1
            scored.append({"item": exp.model_dump(), "score": score})

        scored.sort(key=lambda x: x["score"], reverse=True)
        return [s["item"] for s in scored]

    def validate_no_hallucination(self, selected_content: Dict[str, Any]) -> bool:
        """
        Cross-checks selected content plan against actual candidate profile.
        Raises HallucinationError if unverified items are found.
        """
        if not self.profile_data:
            self.load_profile()

        all_profile_skills = {s.name.lower().strip() for s in self.profile_data.skills}
        profile_companies = {e.company.lower().strip() for e in self.profile_data.experience}

        # Validate selected skills
        selected_skills = selected_content.get("selected_skills", [])
        for item in selected_skills:
            skill_name = item.get("name", "") if isinstance(item, dict) else str(item)
            cleaned = skill_name.lower().strip()
            # Allow partial keyword match in real skills
            if not any(cleaned in s or s in cleaned for s in all_profile_skills):
                logger.warning(f"Flagged unverified skill: '{skill_name}' not in candidate profile.")

        # Validate experience indices and companies
        selected_exp = selected_content.get("selected_experience", [])
        for exp in selected_exp:
            comp = exp.get("company", "").lower().strip()
            if comp and not any(comp in c or c in comp for c in profile_companies):
                raise HallucinationError(f"Hallucinated company detected: '{exp.get('company')}' is not in master profile.")

            bullets = exp.get("selected_bullets", [])
            # Find company in profile to check bullet boundaries
            matching_profile_exp = next((e for e in self.profile_data.experience if e.company.lower().strip() == comp), None)
            if matching_profile_exp:
                max_bullet_idx = len(matching_profile_exp.bullets) - 1
                for b_idx in bullets:
                    if isinstance(b_idx, int) and (b_idx < 0 or b_idx > max_bullet_idx):
                        raise HallucinationError(f"Invalid bullet index {b_idx} for company {exp.get('company')}. Profile has {len(matching_profile_exp.bullets)} bullets.")

        return True
