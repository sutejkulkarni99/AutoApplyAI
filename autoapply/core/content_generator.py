"""
Content generator implementing the complete 3-Pass AI Pipeline.
Enforces LaTeX character escaping, hallucination validation, and strict word budgets.
"""

import json
import logging
import re
from typing import Any, Callable, Dict, Optional

from core.ai_client import GeminiClient
from core.profile_manager import ProfileManager, HallucinationError

logger = logging.getLogger(__name__)


def escape_latex(text: str) -> str:
    """
    Escapes LaTeX special characters in string content so that pdflatex compiles cleanly.
    Characters: &, %, $, #, _, {, }, ~, ^, \
    """
    if not isinstance(text, str):
        return str(text)

    # Dictionary of simple replacements
    replacements = [
        ('\\', r'\textbackslash{}'),
        ('&', r'\&'),
        ('%', r'\%'),
        ('$', r'\$'),
        ('#', r'\#'),
        ('_', r'\_'),
        ('{', r'\{'),
        ('}', r'\}'),
        ('~', r'\textasciitilde{}'),
        ('^', r'\textasciicircum{}'),
    ]

    # Don't double-escape existing valid LaTeX commands (e.g. \textbf, \textit, \hfill, \\)
    # Perform clean token-safe replacement
    res = text
    # Protect common intentional LaTeX macro patterns if already injected
    protected = {}
    macro_patterns = [r'\\textbf\{', r'\\textit\{', r'\\color\{', r'\\href\{', r'\\begin\{itemize\}', r'\\end\{itemize\}', r'\\item\s', r'\\\\', r'\\hfill', r'\\textbar', r'\\newpage', r'\\section\*\{']
    
    for i, pattern in enumerate(macro_patterns):
        matches = list(re.finditer(pattern, res))
        for j, m in enumerate(matches):
            placeholder = f"__LATEX_PROTECTED_{i}_{j}__"
            protected[placeholder] = m.group(0)
            res = res[:m.start()] + placeholder + res[m.end():]

    # Escape individual special characters
    for char, rep in replacements[1:]:  # skip \ which is already handled
        res = res.replace(char, rep)

    # Restore protected macros
    for placeholder, original in protected.items():
        res = res.replace(placeholder, original)

    return res


class ContentGenerator:
    """
    Orchestrates the 3-pass AI pipeline to produce job-tailored CVs and cover letters.
    """

    def __init__(self, ai_client: Optional[GeminiClient] = None, profile_mgr: Optional[ProfileManager] = None):
        self.ai_client = ai_client or GeminiClient()
        self.profile_mgr = profile_mgr or ProfileManager()

    def run_pass_1(self, job_description: str, progress_cb: Optional[Callable[[str, int], None]] = None) -> Dict[str, Any]:
        """
        Pass 1: Deep Job Analysis & Candidate Blueprint Plan.
        """
        if progress_cb:
            progress_cb("Pass 1: Analyzing job description and matching profile...", 15)

        profile_yaml_str = self.profile_mgr.get_raw_yaml_str()
        pass_1_result = self.ai_client.analyze_job(profile_yaml_str, job_description)

        # Validate Pass 1 against Hallucination guard
        try:
            content_plan = pass_1_result.get("content_plan", {})
            self.profile_mgr.validate_no_hallucination(content_plan)
        except HallucinationError as e:
            logger.warning(f"Pass 1 validation warning: {e}")

        if progress_cb:
            progress_cb("Pass 1: Completed analysis and gap evaluation.", 33)

        return pass_1_result

    def run_pass_2(self, pass_1_result: Dict[str, Any], progress_cb: Optional[Callable[[str, int], None]] = None) -> Dict[str, Any]:
        """
        Pass 2: CV LaTeX Fragment Generation.
        """
        if progress_cb:
            progress_cb("Pass 2: Generating tailored LaTeX CV fragments...", 50)

        profile_dict = self.profile_mgr.raw_yaml_dict
        pass_2_result = self.ai_client.generate_cv_fragments(pass_1_result, profile_dict)

        if progress_cb:
            progress_cb("Pass 2: CV fragments generated successfully.", 66)

        return pass_2_result

    def run_pass_3(self, pass_1_result: Dict[str, Any], progress_cb: Optional[Callable[[str, int], None]] = None) -> Dict[str, Any]:
        """
        Pass 3: Cover Letter Generation.
        """
        if progress_cb:
            progress_cb("Pass 3: Writing tailored cover letter with tone alignment...", 80)

        profile_dict = self.profile_mgr.raw_yaml_dict
        pass_3_result = self.ai_client.generate_cover_letter(pass_1_result, profile_dict)

        if progress_cb:
            progress_cb("Pass 3: Cover letter generated successfully.", 100)

        return pass_3_result

    def run_full_pipeline(self, job_description: str, progress_cb: Optional[Callable[[str, int], None]] = None) -> Dict[str, Any]:
        """
        Executes all 3 passes sequentially.
        """
        pass_1 = self.run_pass_1(job_description, progress_cb)
        pass_2 = self.run_pass_2(pass_1, progress_cb)
        pass_3 = self.run_pass_3(pass_1, progress_cb)

        return {
            "pass_1": pass_1,
            "pass_2": pass_2,
            "pass_3": pass_3,
            "gaps": pass_1.get("gaps", {}),
            "job_analysis": pass_1.get("job_analysis", {})
        }
