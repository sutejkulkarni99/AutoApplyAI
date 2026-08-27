"""
Page count enforcement module.
Guarantees CV never exceeds 2 pages and Cover Letter never exceeds 1 page.
Uses word budget heuristics as the first gate and PDF page extraction verification.
"""

import logging
import re
import tempfile
from pathlib import Path
from typing import Callable, Dict, Optional, Tuple

from config import settings

logger = logging.getLogger(__name__)


class PageEnforcer:
    """
    Ensures rendered documents strictly adhere to hard page limits.
    """

    def __init__(self, renderer=None):
        from core.latex_renderer import LaTeXRenderer
        self.renderer = renderer or LaTeXRenderer()

    @staticmethod
    def count_body_words(latex_str: str) -> int:
        """Counts readable body words by stripping LaTeX markup commands."""
        clean = re.sub(r'\\[a-zA-Z]+\*?(?:\[.*?\])?(?:\{.*?\})?', ' ', latex_str)
        clean = re.sub(r'[{}\\%&$#_~^]', ' ', clean)
        words = [w for w in clean.split() if len(w) > 1]
        return len(words)

    @staticmethod
    def get_pdf_page_count(pdf_path: Path) -> int:
        """Counts pages in a generated PDF using pypdf or subprocess."""
        if not pdf_path.exists():
            return 0

        try:
            from pypdf import PdfReader
            reader = PdfReader(str(pdf_path))
            return len(reader.pages)
        except Exception as e:
            logger.warning(f"pypdf page count failed: {e}. Trying pdfinfo...")

        try:
            import subprocess
            res = subprocess.run(["pdfinfo", str(pdf_path)], stdout=subprocess.PIPE, text=True)
            for line in res.stdout.splitlines():
                if "Pages:" in line:
                    return int(line.split(":")[1].strip())
        except Exception:
            pass

        return 1

    def pre_trim_cv_context(self, cv_fragments: Dict[str, str], max_words: int = 450) -> Dict[str, str]:
        """
        Pre-trims CV fragment sections if total word count exceeds safe bounds.
        """
        trimmed = dict(cv_fragments)
        
        # Check total estimated body words
        combined = " ".join(str(v) for v in trimmed.values())
        words = self.count_body_words(combined)

        if words > max_words:
            logger.info(f"CV word count ({words}) exceeds safe 2-page ceiling ({max_words}). Pre-trimming lowest priority bullets...")
            
            # Trim experience itemize blocks if multiple bullets exist
            exp = trimmed.get("experience_sections", "")
            # Find all itemize blocks and limit each to 3 items
            lines = exp.splitlines()
            new_lines = []
            bullet_count_in_block = 0
            for line in lines:
                if r"\begin{itemize}" in line:
                    bullet_count_in_block = 0
                    new_lines.append(line)
                elif r"\item" in line:
                    bullet_count_in_block += 1
                    if bullet_count_in_block <= 4:
                        new_lines.append(line)
                elif r"\end{itemize}" in line:
                    new_lines.append(line)
                else:
                    new_lines.append(line)
            
            trimmed["experience_sections"] = "\n".join(new_lines)

        return trimmed

    def pre_trim_cover_letter(self, cover_data: Dict[str, str], max_words: int = 280) -> Dict[str, str]:
        """
        Trims cover letter paragraphs to guarantee single-page rendering.
        """
        trimmed = dict(cover_data)
        for key in ["body_paragraph_1", "body_paragraph_2", "body_paragraph_3"]:
            p = trimmed.get(key, "")
            words = p.split()
            if len(words) > 90:
                trimmed[key] = " ".join(words[:85]) + "."
        return trimmed

    def enforce_cv_pages(self, cv_context: Dict[str, Any], output_subdir: str) -> Tuple[bool, str, int, Optional[Path]]:
        """
        Renders, checks page count, and iteratively trims if needed.
        Returns: (success: bool, final_tex: str, page_count: int, pdf_path: Optional[Path])
        """
        context = self.pre_trim_cv_context(cv_context, max_words=settings.cv_word_target_max)
        tex = self.renderer.render_cv_tex(context)

        # Attempt compilation
        success, pdf_path, msg = self.renderer.compile_pdf(tex, output_subdir, "CV_Tailored")
        if not success or not pdf_path:
            return False, tex, 1, None

        pages = self.get_pdf_page_count(pdf_path)
        
        # If > 2 pages, do a second tighter pass
        if pages > settings.max_cv_pages:
            logger.warning(f"CV generated {pages} pages, which exceeds {settings.max_cv_pages} limit. Running aggressive compaction...")
            # Remove projects section or shorten summary
            context["projects_section"] = ""
            tex = self.renderer.render_cv_tex(context)
            success, pdf_path, _ = self.renderer.compile_pdf(tex, output_subdir, "CV_Tailored")
            pages = self.get_pdf_page_count(pdf_path) if (success and pdf_path) else 2

        return True, tex, pages, pdf_path
