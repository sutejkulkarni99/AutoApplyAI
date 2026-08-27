"""
LaTeX renderer and compilation pipeline.
Renders Jinja2 templates into final LaTeX source files, invokes pdflatex via subprocess,
cleans up temporary auxiliary artifacts, and parses LaTeX error logs.
"""

import logging
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import jinja2
from config import settings

logger = logging.getLogger(__name__)


class LaTeXRenderer:
    """
    Renders LaTeX documents using Jinja2 and compiles them into PDFs.
    """

    def __init__(self, templates_dir: Optional[Path] = None, output_dir: Optional[Path] = None):
        self.templates_dir = templates_dir or settings.assets_dir
        self.output_dir = output_dir or settings.output_dir
        self.compiler = settings.latex_compiler

        # Setup Jinja2 environment
        self.jinja_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(self.templates_dir)),
            autoescape=False,
            trim_blocks=True,
            lstrip_blocks=True
        )

    def render_cv_tex(self, context: Dict[str, Any], template_filename: str = "cv_template.tex") -> str:
        """Renders the CV template with provided context."""
        template = self.jinja_env.get_template(template_filename)
        return template.render(**context)

    def render_cover_tex(self, context: Dict[str, Any], template_filename: str = "cover_template.tex") -> str:
        """Renders the Cover Letter template with provided context."""
        template = self.jinja_env.get_template(template_filename)
        return template.render(**context)

    def compile_pdf(self, tex_content: str, output_subdir_name: str, base_filename: str) -> Tuple[bool, Optional[Path], str]:
        """
        Writes .tex file and runs pdflatex twice.
        Returns: (success: bool, pdf_path: Optional[Path], log_or_error: str)
        """
        target_dir = self.output_dir / output_subdir_name
        target_dir.mkdir(parents=True, exist_ok=True)

        tex_path = target_dir / f"{base_filename}.tex"
        pdf_path = target_dir / f"{base_filename}.pdf"
        log_path = target_dir / f"{base_filename}.log"

        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(tex_content)

        # Check if compiler is available
        if not shutil.which(self.compiler):
            msg = f"LaTeX compiler '{self.compiler}' is not installed on system PATH. Generated .tex saved to {tex_path}."
            logger.warning(msg)
            return False, None, msg

        # Run pdflatex twice for reference resolution
        for pass_num in range(1, 3):
            try:
                cmd = [
                    self.compiler,
                    "-interaction=nonstopmode",
                    "-halt-on-error",
                    f"-output-directory={target_dir}",
                    str(tex_path)
                ]
                res = subprocess.run(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    cwd=str(target_dir),
                    timeout=settings.request_timeout
                )

                if res.returncode != 0:
                    error_snippet = self._extract_log_error(log_path) or res.stdout[-800:]
                    return False, None, f"LaTeX compilation error (Pass {pass_num}):\n{error_snippet}"

            except subprocess.TimeoutExpired:
                return False, None, "LaTeX compilation timed out."
            except Exception as e:
                return False, None, f"Failed to execute LaTeX compiler: {str(e)}"

        # Cleanup auxiliary files
        self._cleanup_aux_files(target_dir, base_filename)

        if pdf_path.exists():
            return True, pdf_path, "Compilation succeeded."
        else:
            return False, None, "PDF was not generated despite 0 exit code."

    def _cleanup_aux_files(self, directory: Path, base_name: str):
        """Removes .aux, .out, .toc intermediate files."""
        for ext in [".aux", ".out", ".toc", ".nav", ".snm"]:
            f = directory / f"{base_name}{ext}"
            if f.exists():
                try:
                    f.unlink()
                except Exception:
                    pass

    def _extract_log_error(self, log_path: Path) -> Optional[str]:
        """Parses pdflatex log file to extract concise error lines."""
        if not log_path.exists():
            return None

        errors = []
        try:
            with open(log_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()

            for i, line in enumerate(lines):
                if line.startswith("!"):
                    context = "".join(lines[max(0, i - 1):min(len(lines), i + 5)])
                    errors.append(context)

            if errors:
                return "\n---\n".join(errors[:3])
        except Exception:
            pass

        return None
