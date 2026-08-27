"""
Job posting scraper for LinkedIn, StepStone, and general job boards.
Built with Playwright (sync API) and BeautifulSoup fallback.
Includes anti-bot evasion headers, realistic user agents, and structured data parsing.
"""

import logging
import random
import re
import time
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]


class JobScraper:
    """
    Scrapes job postings from various portals (LinkedIn, StepStone, Indeed, direct company career pages)
    using Playwright sync API with graceful degradation to raw HTML/HTTP parsing.
    """

    def __init__(self, headless: bool = True):
        self.headless = headless

    def _get_random_user_agent(self) -> str:
        return random.choice(USER_AGENTS)

    def scrape_url(self, url: str) -> Dict[str, Any]:
        """Auto-detects the domain and dispatches to the specialized scraper."""
        domain = urlparse(url).netloc.lower()
        if "linkedin.com" in domain:
            return self.scrape_linkedin(url)
        elif "stepstone" in domain:
            return self.scrape_stepstone(url)
        else:
            return self.scrape_generic(url)

    def scrape_linkedin(self, url: str) -> Dict[str, Any]:
        """Scrapes LinkedIn job posting via Playwright."""
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=self.headless)
                context = browser.new_context(
                    user_agent=self._get_random_user_agent(),
                    viewport={"width": 1280, "height": 800},
                    locale="en-US,en;q=0.9,de;q=0.8"
                )
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=25000)
                time.sleep(random.uniform(1.2, 2.5))

                # Attempt to expand "Show more" description button if present
                try:
                    show_more = page.locator("button.show-more-less-html__button--more, button[aria-label='Show more']")
                    if show_more.is_visible():
                        show_more.click()
                        time.sleep(0.5)
                except Exception:
                    pass

                title = ""
                company = ""
                location = ""
                description = ""

                # Extract title
                for sel in ["h1.top-card-layout__title", "h1.topcard__title", "h1.job-details-jobs-unified-top-card__job-title", "h1"]:
                    el = page.locator(sel).first
                    if el.is_visible():
                        title = el.inner_text().strip()
                        if title:
                            break

                # Extract company
                for sel in ["a.topcard__org-name-link", "span.topcard__flavor", "a.topcard__flavor--black-link", "div.job-details-jobs-unified-top-card__company-name"]:
                    el = page.locator(sel).first
                    if el.is_visible():
                        company = el.inner_text().strip()
                        if company:
                            break

                # Extract location
                for sel in ["span.topcard__flavor--bullet", "span.job-details-jobs-unified-top-card__bullet"]:
                    el = page.locator(sel).first
                    if el.is_visible():
                        location = el.inner_text().strip()
                        if location:
                            break

                # Extract description
                for sel in ["div.show-more-less-html__markup", "div.description__text", "div.jobs-description-content__text"]:
                    el = page.locator(sel).first
                    if el.is_visible():
                        description = el.inner_text().strip()
                        if description:
                            break

                if not description:
                    description = page.inner_text("body")

                browser.close()

                return self._structure_result(
                    source="LinkedIn",
                    url=url,
                    title=title or "Software / Systems Engineer",
                    company=company or "Confidential Company",
                    location=location or "Germany",
                    description=description
                )

        except Exception as e:
            logger.warning(f"Playwright LinkedIn scrape error: {e}. Falling back to generic scraper.")
            return self.scrape_generic(url)

    def scrape_stepstone(self, url: str) -> Dict[str, Any]:
        """Scrapes StepStone job posting."""
        try:
            from playwright.sync_api import sync_playwright

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=self.headless)
                context = browser.new_context(
                    user_agent=self._get_random_user_agent(),
                    viewport={"width": 1366, "height": 768}
                )
                page = context.new_page()
                page.goto(url, wait_until="domcontentloaded", timeout=25000)
                time.sleep(random.uniform(1.0, 2.0))

                title = page.locator("h1").first.inner_text() if page.locator("h1").count() > 0 else ""
                company = page.locator("[data-genesis-element='TEXT_COMPANY_NAME']").first.inner_text() if page.locator("[data-genesis-element='TEXT_COMPANY_NAME']").count() > 0 else ""
                description = page.locator("[data-at='job-description-content']").first.inner_text() if page.locator("[data-at='job-description-content']").count() > 0 else page.inner_text("body")

                browser.close()

                return self._structure_result(
                    source="StepStone",
                    url=url,
                    title=title.strip() or "Engineering Role",
                    company=company.strip() or "StepStone Employer",
                    location="Germany",
                    description=description.strip()
                )
        except Exception as e:
            logger.warning(f"StepStone scraper fallback: {e}")
            return self.scrape_generic(url)

    def scrape_generic(self, url: str) -> Dict[str, Any]:
        """Generic web scraper using requests and BeautifulSoup or Playwright."""
        try:
            import requests

            headers = {"User-Agent": self._get_random_user_agent()}
            resp = requests.get(url, headers=headers, timeout=15)
            soup = BeautifulSoup(resp.text, "html.parser")

            # Remove scripts, styles, navigations
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()

            h1 = soup.find("h1")
            title = h1.get_text().strip() if h1 else "Job Position"
            
            # Heuristic for company name from title or meta tags
            meta_og_site = soup.find("meta", property="og:site_name")
            company = meta_og_site.get("content", "").strip() if meta_og_site else "Company"

            text = soup.get_text(separator="\n")
            clean_lines = [line.strip() for line in text.splitlines() if line.strip()]
            clean_desc = "\n".join(clean_lines)

            return self._structure_result(
                source="Web",
                url=url,
                title=title,
                company=company,
                location="Germany",
                description=clean_desc
            )
        except Exception as e:
            logger.error(f"Failed to scrape URL {url}: {e}")
            return {
                "source": "Manual",
                "url": url,
                "title": "Position",
                "company": "Company",
                "location": "",
                "description": f"Failed to retrieve job description from {url}. Please paste the JD manually.",
                "requirements": [],
                "nice_to_have": []
            }

    def _structure_result(self, source: str, url: str, title: str, company: str, location: str, description: str) -> Dict[str, Any]:
        """Extract requirements heuristics from description."""
        must_haves = []
        nice_to_haves = []

        lines = description.splitlines()
        current_section = None
        for line in lines:
            line_str = line.strip()
            l_lower = line_str.lower()
            if any(k in l_lower for k in ["requirement", "qualifications", "what you bring", "your profile", "must have", "anforderung"]):
                current_section = "must"
                continue
            elif any(k in l_lower for k in ["nice to have", "plus", "bonus", "desirable", "von vorteil"]):
                current_section = "nice"
                continue
            elif any(k in l_lower for k in ["we offer", "about us", "benefits", "what we offer"]):
                current_section = None

            if current_section == "must" and len(line_str) > 10:
                must_haves.append(line_str)
            elif current_section == "nice" and len(line_str) > 10:
                nice_to_haves.append(line_str)

        return {
            "source": source,
            "url": url,
            "title": title,
            "company": company,
            "location": location,
            "description": description,
            "requirements": must_haves[:10],
            "nice_to_have": nice_to_haves[:5]
        }
