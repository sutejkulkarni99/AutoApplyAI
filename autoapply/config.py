"""
Configuration module for AutoApply.
Centralizes environment variables, rate limits, model parameters, and file paths.
"""

import os
import shutil
from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Google AI Studio API Configuration
    google_ai_studio_api_key: str = Field(
        default="",
        validation_alias="GOOGLE_AI_STUDIO_API_KEY"
    )
    ai_model: str = "gemini-3.7-flash"
    
    # Rate Limiter Parameters (Safe limits for Google AI Studio)
    rate_limit_rpm: int = 6       # Maximum 6 requests per minute
    rate_limit_rpd: int = 1500    # Maximum 1500 requests per day
    request_timeout: int = 60     # Network timeout in seconds

    # Hard Document Constraints
    max_cv_pages: int = 2
    max_cover_pages: int = 1
    cv_word_target_max: int = 480
    cover_word_target_max: int = 320

    # Paths & Directories
    base_dir: Path = Path(__file__).resolve().parent
    assets_dir: Path = base_dir / "assets"
    output_dir: Path = base_dir / "output"
    db_path: Path = base_dir / "applications.db"
    
    master_profile_path: Path = assets_dir / "master_profile.yaml"
    cv_template_path: Path = assets_dir / "cv_template.tex"
    cover_template_path: Path = assets_dir / "cover_template.tex"

    # LaTeX Compiler Selection with auto-detection
    latex_compiler: str = "pdflatex"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def __init__(self, **values):
        super().__init__(**values)
        # Ensure output directory exists
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.assets_dir.mkdir(parents=True, exist_ok=True)

        # Fallback to GEMINI_API_KEY if GOOGLE_AI_STUDIO_API_KEY is not set
        if not self.google_ai_studio_api_key:
            self.google_ai_studio_api_key = os.environ.get("GEMINI_API_KEY", "")

        # Auto-detect available LaTeX compiler
        self.latex_compiler = self.detect_latex_compiler()

    def detect_latex_compiler(self) -> str:
        """Auto-detect pdflatex, xelatex, or lualatex on the system path."""
        for compiler in ["pdflatex", "xelatex", "lualatex"]:
            if shutil.which(compiler):
                return compiler
        return "pdflatex"


# Global singleton settings instance
settings = Settings()
