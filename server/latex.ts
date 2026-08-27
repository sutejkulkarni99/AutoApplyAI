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

export function buildFullCVTex(personal: any, pass1: any, pass2: any, language: "en" | "de" = "en"): string {
  const isGerman = language === "de";
  const name = escapeLatex(personal?.name || "Candidate Name");
  const headerTitle = escapeLatex(pass2?.dynamic_header_title || personal?.title || (isGerman ? "Spezialist" : "Specialist"));
  const email = escapeLatex(personal?.email || "candidate@example.com");
  const phone = escapeLatex(personal?.phone || "");
  const address = escapeLatex(personal?.address || "");
  const linkedin = escapeLatex(personal?.linkedin || "");
  const portfolio = escapeLatex(personal?.portfolio || "");

  const summary = escapeLatex(pass2?.professional_summary || personal?.summary?.technical || "");
  const skills = pass2?.skills_section || "% No skills specified";
  const experience = pass2?.experience_sections || "% No experience specified";
  const education = pass2?.education_section || "% No education specified";
  
  const projectsTitle = isGerman ? "Projekte & Initiativen" : "Projects";
  const languagesTitle = isGerman ? "Sprachkenntnisse" : "Languages";
  const summaryTitle = isGerman ? "Kurzprofil & Expertise" : "Professional Summary";
  const expTitle = isGerman ? "Berufliche Erfahrung" : "Experience";
  const skillsTitle = isGerman ? "Fachliche & Technische Kompetenzen" : "Technical & Core Skills";
  const eduTitle = isGerman ? "Ausbildung & Qualifikationen" : "Education";

  const projects = pass2?.projects_section ? `\\section{${projectsTitle}}\n${pass2.projects_section}\n` : "";
  const languages = pass2?.languages_section ? `\\section{${languagesTitle}}\n${pass2.languages_section}\n` : "";

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
  const p1 = escapeLatex(pass3?.body_paragraph_1 || "");
  const p2 = escapeLatex(pass3?.body_paragraph_2 || "");
  const p3 = escapeLatex(pass3?.body_paragraph_3 || "");
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

// Compile LaTeX to PDF using pdflatex
export async function compileLaTeX(
  texSource: string,
  outFilename: string = "document"
): Promise<{ success: boolean; pdfBuffer?: Buffer; log: string; error?: string }> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "autoapply-latex-"));
  const texFile = path.join(tempDir, `${outFilename}.tex`);
  const pdfFile = path.join(tempDir, `${outFilename}.pdf`);
  const logFile = path.join(tempDir, `${outFilename}.log`);

  try {
    fs.writeFileSync(texFile, texSource, "utf-8");

    // Execute pdflatex (2 passes for hyperref / references)
    const cmd = `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="${tempDir}" "${texFile}"`;
    
    let compileLog = "";
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      compileLog = stdout + "\n" + stderr;
    } catch (execErr: any) {
      compileLog = (execErr.stdout || "") + "\n" + (execErr.stderr || "") + "\n" + execErr.message;
      
      // If pdflatex binary was not found
      if (execErr.message?.includes("not found") || execErr.code === 127) {
        return {
          success: false,
          log: compileLog,
          error: "pdflatex binary not found on this system. In Docker/Fedora, install TeX Live via: sudo dnf install texlive-scheme-medium",
        };
      }
    }

    if (fs.existsSync(pdfFile)) {
      const pdfBuffer = fs.readFileSync(pdfFile);
      // Clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      return { success: true, pdfBuffer, log: compileLog };
    }

    let errorDetail = "LaTeX compilation failed to produce a PDF.";
    if (fs.existsSync(logFile)) {
      const fullLog = fs.readFileSync(logFile, "utf-8");
      const errorLines = fullLog.split("\n").filter((l) => l.startsWith("!")).join("\n");
      if (errorLines) {
        errorDetail = `LaTeX Error:\n${errorLines}`;
      }
    }

    return {
      success: false,
      log: compileLog,
      error: errorDetail,
    };
  } catch (err: any) {
    return {
      success: false,
      log: err.message,
      error: err.message,
    };
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}
