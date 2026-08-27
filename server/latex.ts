import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export function escapeLatex(str?: string): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

export function sanitizeAiLatexContent(text?: string): string {
  if (!text) return "";
  // Escape unescaped %, &, #, _, $ in AI blocks so TeX compiler never crashes
  return text
    .replace(/(?<!\\)%/g, "\\%")
    .replace(/(?<!\\)&/g, "\\&")
    .replace(/(?<!\\)#/g, "\\#")
    .replace(/(?<!\\)_/g, "\\_")
    .replace(/(?<!\\)\$/g, "\\$");
}

export function buildFullCVTex(personal: any, pass1: any, pass2: any, language: "en" | "de" = "en"): string {
  const isGerman = language === "de";
  const name = escapeLatex(personal?.name || "Candidate Name");
  const headerTitle = escapeLatex(pass2?.dynamic_header_title || personal?.title || (isGerman ? "Spezialist" : "Specialist"));
  const email = escapeLatex(personal?.email || "candidate@example.com");
  const phone = escapeLatex(personal?.phone || "");
  const address = escapeLatex(personal?.address || "");
  const linkedin = escapeLatex(personal?.linkedin || "");
  const portfolio = escapeLatex(personal?.portfolio || "");

  const summary = sanitizeAiLatexContent(pass2?.professional_summary || personal?.summary?.technical || "");
  const skills = sanitizeAiLatexContent(pass2?.skills_section || "% No skills specified");
  const experience = sanitizeAiLatexContent(pass2?.experience_sections || "% No experience specified");
  const education = sanitizeAiLatexContent(pass2?.education_section || "% No education specified");
  
  const projectsTitle = isGerman ? "Projekte & Initiativen" : "Projects";
  const languagesTitle = isGerman ? "Sprachkenntnisse" : "Languages";
  const summaryTitle = isGerman ? "Kurzprofil & Expertise" : "Professional Summary";
  const expTitle = isGerman ? "Berufliche Erfahrung" : "Experience";
  const skillsTitle = isGerman ? "Fachliche & Technische Kompetenzen" : "Technical & Core Skills";
  const eduTitle = isGerman ? "Ausbildung & Qualifikationen" : "Education";

  const projects = pass2?.projects_section ? `\\section{${projectsTitle}}\n${sanitizeAiLatexContent(pass2.projects_section)}\n` : "";
  const languages = pass2?.languages_section ? `\\section{${languagesTitle}}\n${sanitizeAiLatexContent(pass2.languages_section)}\n` : "";

  return `\\documentclass[10pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
${isGerman ? "\\usepackage[ngerman]{babel}" : "\\usepackage[english]{babel}"}
\\usepackage[margin=0.65in]{geometry}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{xcolor}
\\usepackage{microtype}

\\definecolor{primary}{RGB}{27, 42, 74}
\\definecolor{accent}{RGB}{43, 84, 126}
\\definecolor{textdark}{RGB}{33, 37, 41}

\\hypersetup{
    colorlinks=true,
    linkcolor=accent,
    urlcolor=accent,
    pdfauthor={${name}},
    pdftitle={${isGerman ? "Lebenslauf" : "CV"} - ${name}}
}

\\titleformat{\\section}{\\color{primary}\\bfseries\\large}{}{0em}{}[\\color{primary}\\titlerule]
\\titlespacing*{\\section}{0pt}{10pt}{5pt}
\\setlist[itemize]{leftmargin=1.5em, itemsep=2pt, topsep=2pt}

\\begin{document}
\\pagestyle{empty}

% HEADER
\\begin{center}
    {\\color{primary}\\LARGE\\bfseries ${name}} \\\\[3pt]
    {\\color{accent}\\bfseries\\small ${headerTitle}} \\\\[5pt]
    \\small ${phone} $\\cdot$ \\href{mailto:${email}}{${email}} $\\cdot$ ${address}
    ${linkedin ? `\\\\ \\href{${linkedin}}{${linkedin}}` : ""}
    ${portfolio ? ` $\\cdot$ \\href{${portfolio}}{${portfolio}}` : ""}
\\end{center}

\\vspace{-8pt}

% SUMMARY
\\section{${summaryTitle}}
${summary}

% EXPERIENCE
\\section{${expTitle}}
${experience}

% SKILLS
\\section{${skillsTitle}}
${skills}

% EDUCATION
\\section{${eduTitle}}
${education}

${projects}
${languages}

\\end{document}`;
}

export function buildFullCoverTex(personal: any, pass1: any, pass3: any, language: "en" | "de" = "en"): string {
  const isGerman = language === "de";
  const name = escapeLatex(personal?.name || "Candidate Name");
  const email = escapeLatex(personal?.email || "candidate@example.com");
  const phone = escapeLatex(personal?.phone || "");
  const address = escapeLatex(personal?.address || "");

  const company = escapeLatex(pass3?.recipient_company || pass1?.job_analysis?.company || (isGerman ? "Personalabteilung" : "Hiring Team"));
  const location = escapeLatex(pass3?.recipient_location || (isGerman ? "Unternehmensstandort" : "Headquarters"));
  const subject = escapeLatex(pass3?.subject_line || (isGerman ? `Bewerbung als ${pass1?.job_analysis?.title || "Spezialist"}` : `Application for ${pass1?.job_analysis?.title || "Role"}`));
  const salutation = escapeLatex(pass3?.salutation || (isGerman ? "Sehr geehrte Damen und Herren," : "Dear Hiring Manager,"));
  const p1 = sanitizeAiLatexContent(pass3?.body_paragraph_1 || "");
  const p2 = sanitizeAiLatexContent(pass3?.body_paragraph_2 || "");
  const p3 = sanitizeAiLatexContent(pass3?.body_paragraph_3 || "");
  const closing = escapeLatex(pass3?.closing || (isGerman ? "Mit freundlichen Grüßen," : "Sincerely,"));

  const today = isGerman
    ? new Date().toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" })
    : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
${isGerman ? "\\usepackage[ngerman]{babel}" : "\\usepackage[english]{babel}"}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{microtype}
\\usepackage{parskip}

\\definecolor{primary}{RGB}{27, 42, 74}
\\definecolor{accent}{RGB}{43, 84, 126}

\\begin{document}
\\pagestyle{empty}

% SENDER DETAILS
{\\bfseries\\large ${name}} \\\\
${address} \\\\
${phone} \\\\
\\href{mailto:${email}}{${email}}

\\vspace{16pt}
${today}

\\vspace{16pt}
% RECIPIENT
{\\bfseries ${company}} \\\\
${location}

\\vspace{14pt}
{\\bfseries\\color{primary} ${isGerman ? "Betreff:" : "Subject:"} ${subject}}

\\vspace{12pt}
${salutation}

${p1}

${p2}

${p3}

\\vspace{16pt}
${closing} \\\\[24pt]
{\\bfseries ${name}}

\\end{document}`;
}

// Compile LaTeX to PDF with local engine + online cloud compiler fallback
export async function compileLaTeX(
  texSource: string,
  outFilename: string = "document"
): Promise<{ success: boolean; pdfBuffer?: Buffer; log: string; error?: string }> {
  // 1. Try local pdflatex command if available
  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "autoapply-latex-"));
    const texFile = path.join(tempDir, `${outFilename}.tex`);
    const pdfFile = path.join(tempDir, `${outFilename}.pdf`);
    fs.writeFileSync(texFile, texSource, "utf-8");

    const cmd = `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="${tempDir}" "${texFile}"`;
    const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
    const compileLog = stdout + "\n" + stderr;

    if (fs.existsSync(pdfFile)) {
      const pdfBuffer = fs.readFileSync(pdfFile);
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      return { success: true, pdfBuffer, log: compileLog };
    }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  } catch (localErr: any) {
    // Local pdflatex not present or failed - fall through to online compilation engines
  }

  // 2. Primary Online Compiler Fallback: latex.ytotech.com
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch("https://latex.ytotech.com/builds/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: "pdflatex",
        resources: [{ main: true, content: texSource }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuf);
      if (pdfBuffer.length > 500) {
        return { success: true, pdfBuffer, log: "Compiled successfully via Ytotech LaTeX Cloud Compiler" };
      }
    }
  } catch (onlineErr: any) {
    console.warn("Ytotech LaTeX compiler fallback failed or timed out:", onlineErr);
  }

  // 3. Secondary Online Compiler Fallback: latex.online
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const res = await fetch("https://latex.online/compile", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "text=" + encodeURIComponent(texSource),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuf);
      if (pdfBuffer.length > 500) {
        return { success: true, pdfBuffer, log: "Compiled successfully via LaTeX Online Compiler" };
      }
    }
  } catch (onlineErr2: any) {
    console.warn("LaTeX Online compiler fallback failed:", onlineErr2);
  }

  return {
    success: false,
    log: "All LaTeX compilation engines (local pdflatex and cloud compilers) failed or timed out.",
    error: "LaTeX compilation failed. Please verify syntax or download .tex file directly.",
  };
}
