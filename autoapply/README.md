# AutoApply — Python GUI Job Application Assistant

AutoApply is a desktop application powered by **Google AI Studio (`gemini-2.5-flash`)** and **PyQt6** that automates the tailoring of your LaTeX CV and Cover Letter with zero hallucination and hard page-count constraints.

---

## 🌟 Key Features

1. **Sacred LaTeX Template Preservation**:
   - Injects dynamic content into your exact templates (`cv_template.tex` and `cover_template.tex`) via Jinja2 placeholders.
2. **3-Pass AI Pipeline**:
   - **Pass 1 (`analyze_job`)**: Analyzes JD, extracts must-haves, maps candidate profile indices, and flags missing skill gaps.
   - **Pass 2 (`generate_cv_fragments`)**: Generates LaTeX-escaped fragments tailored strictly to target role keywords.
   - **Pass 3 (`generate_cover_letter`)**: Writes a 1-page cover letter adapting tone (formal vs. casual) and highlighting relevant achievements.
3. **Zero Hallucination Architecture**:
   - The AI only selects and reorders profile items.
   - `ProfileManager.validate_no_hallucination()` cross-checks all selected companies and bullet indices.
4. **Hard Document Bounds**:
   - **CV**: Max 2 pages.
   - **Cover Letter**: Max 1 page.
5. **Built-in Rate Limiting**:
   - Sliding window token bucket limiter enforcing ≤ 6 RPM (well below the 10 RPM free-tier limit) and ≤ 1,500 RPD.
6. **SQLite Application Tracker**:
   - 5-stage Kanban board (`Scraped`, `Tailored`, `Applied`, `Active`, `Closed`) with stats, search, and notes.

---

## 🚀 Quickstart & Installation

### 1. Prerequisites
- Python 3.11+
- LaTeX compiler installed (`pdflatex`, `xelatex`, or `lualatex` via TeX Live, MiKTeX, or MacTeX)

### 2. Install Python Dependencies
```bash
cd autoapply
pip install -r requirements.txt
playwright install chromium
```

### 3. Set Your Google AI Studio API Key
Get your key from [Google AI Studio](https://aistudio.google.com/):

**Linux / macOS:**
```bash
export GOOGLE_AI_STUDIO_API_KEY="your-gemini-api-key-here"
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_AI_STUDIO_API_KEY="your-gemini-api-key-here"
```

**Windows (Command Prompt):**
```cmd
set GOOGLE_AI_STUDIO_API_KEY=your-gemini-api-key-here
```

*(Alternatively, you can paste the API key directly in the GUI under **Settings → API & Compiler Settings**).*

### 4. Run the Application
```bash
python main.py
```

---

## 📂 Project Structure

```
autoapply/
├── main.py                     # Application entry point (PyQt6)
├── config.py                   # Central settings & rate limit constants
├── requirements.txt            # Pinned dependencies
├── README.md                   # Setup and usage guide
├── assets/
│   ├── master_profile.yaml     # Your candidate profile data
│   ├── cv_template.tex         # Your sacred LaTeX CV template
│   └── cover_template.tex      # Your sacred LaTeX Cover Letter template
├── core/
│   ├── ai_client.py            # Google AI Studio client + token bucket rate limiter
│   ├── scraper.py              # LinkedIn, StepStone & generic JD scraper (Playwright)
│   ├── profile_manager.py      # YAML schema validator & hallucination guard
│   ├── content_generator.py    # 3-Pass AI orchestration pipeline
│   ├── latex_renderer.py       # Jinja2 injection & pdflatex compilation runner
│   ├── page_enforcer.py        # 2-Page CV & 1-Page Cover Letter enforcer
│   └── tracker.py              # SQLite applications tracker (applications.db)
└── gui/
    ├── main_window.py          # PyQt6 QMainWindow with dark theme
    ├── input_tab.py            # Scraping & 3-pass processing
    ├── preview_tab.py          # Side-by-side preview, edit modals & PDF generator
    └── dashboard_tab.py        # 5-Column Kanban Application Tracker
```

---

## 🛠️ How to Customize `assets/master_profile.yaml`

Edit `assets/master_profile.yaml` with your real data:
- `personal`: Name, title, email, phone, location, LinkedIn.
- `summary`: 3 variations (`technical`, `leadership`, `general`).
- `skills`: Categorized list with proficiency levels.
- `experience`: List of companies, roles, and comprehensive bullet points.
- `education`: University, degrees, and focus areas.
- `certifications` & `languages`.
- `cover_letter_snippets`: Reusable paragraphs for different job themes.

---

## 🔧 Troubleshooting

### 1. `pdflatex` Not Found
If PDF compilation fails, ensure `pdflatex` is available on your system path.
- **Ubuntu/Debian**: `sudo apt-get install texlive-latex-base texlive-latex-extra texlive-fonts-recommended`
- **macOS**: `brew install --cask mactex`
- **Windows**: Install [MiKTeX](https://miktex.org/) or [TeX Live](https://www.tug.org/texlive/).

*Note: Even without `pdflatex`, AutoApply always generates the complete `.tex` files in `./output/YYYY-MM-DD_Company_Role/` ready for TeXStudio or Overleaf.*

### 2. Playwright Browser Download
If scraping gives a browser executable error:
```bash
playwright install chromium
```

### 3. Rate Limit Throttling
If you see "Rate limit throttling: cooling down...", AutoApply is safely pacing requests to protect your quota.
