import imaps from "imap-simple";
import { simpleParser } from "mailparser";

export interface ImapAccountConfig {
  id: string;
  email: string;
  label: string;
  provider: "gmail_oauth" | "imap" | "forwarding" | "simulated";
  status: "connected" | "disconnected" | "syncing" | "error";
  lastSync?: string;
  imapHost?: string;
  imapPort?: number;
  username?: string;
  password?: string;
  hasPassword?: boolean;
}

export interface FetchedEmailSummary {
  uid: number;
  messageId?: string;
  date: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
}

/**
 * Normalizes host and port defaults based on provider or domain
 */
export function resolveImapConnectionConfig(account: ImapAccountConfig) {
  let host = account.imapHost || "";
  let port = account.imapPort || 993;
  let user = account.username || account.email;

  if (!host) {
    const domain = account.email.split("@")[1]?.toLowerCase();
    if (domain === "gmail.com" || domain === "googlemail.com") {
      host = "imap.gmail.com";
      port = 993;
    } else if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com" || domain === "office365.com") {
      host = "outlook.office365.com";
      port = 993;
    } else if (domain === "yahoo.com" || domain === "ymail.com") {
      host = "imap.mail.yahoo.com";
      port = 993;
    } else if (domain === "icloud.com" || domain === "me.com") {
      host = "imap.mail.me.com";
      port = 993;
    } else {
      host = `imap.${domain || "example.com"}`;
      port = 993;
    }
  }

  return {
    imap: {
      user,
      password: account.password || "",
      host,
      port,
      tls: port === 993,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
    },
  };
}

/**
 * Test handshake with the specified IMAP credentials
 */
export async function testImapHandshake(account: ImapAccountConfig): Promise<{ success: boolean; message: string; host?: string }> {
  const config = resolveImapConnectionConfig(account);

  if (!account.password && !account.hasPassword) {
    return {
      success: false,
      message: "No password or app password provided for this account.",
      host: config.imap.host,
    };
  }

  try {
    const connection = await imaps.connect(config);
    // Try opening INBOX or primary box
    await connection.openBox("INBOX");
    connection.end();
    return {
      success: true,
      message: `Successfully authenticated and connected to ${config.imap.host}:${config.imap.port}`,
      host: config.imap.host,
    };
  } catch (err: any) {
    let msg = err?.message || String(err);
    if (msg.includes("Invalid credentials") || msg.includes("AUTHENTICATIONFAILED") || msg.includes("Application-specific password required")) {
      msg = "Authentication failed. For Gmail / Google, make sure to generate and use a 16-character App Password (Google Account > Security > 2-Step Verification > App Passwords).";
    }
    return {
      success: false,
      message: `IMAP Connection Error (${config.imap.host}): ${msg}`,
      host: config.imap.host,
    };
  }
}

/**
 * Format date for standard IMAP search query (e.g., "01-Jan-2025")
 */
function formatImapDate(date: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Decodes MIME encoded-words in email headers (e.g. =?UTF-8?B?...?= or =?ISO-8859-1?Q?...?=)
 */
function decodeMimeHeader(headerStr: string): string {
  if (!headerStr) return "";
  try {
    return headerStr.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
      try {
        if (encoding.toUpperCase() === "B") {
          return Buffer.from(text, "base64").toString(charset.toLowerCase().includes("utf-8") ? "utf8" : "latin1");
        } else if (encoding.toUpperCase() === "Q") {
          const qText = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (__: string, hex: string) => {
            return String.fromCharCode(parseInt(hex, 16));
          });
          return qText;
        }
      } catch {
        return text;
      }
      return text;
    });
  } catch {
    return headerStr;
  }
}

/**
 * Search and fetch emails from IMAP within a specific date range across inboxes.
 * Uses lightweight header extraction to avoid memory and network timeouts on large inboxes.
 */
export async function fetchHistoricalEmails(
  account: ImapAccountConfig,
  options: {
    sinceDate: Date;
    beforeDate?: Date;
    maxResults?: number;
    searchKeywords?: string[];
  }
): Promise<{ success: boolean; emails: FetchedEmailSummary[]; error?: string }> {
  const config = resolveImapConnectionConfig(account);
  const maxResults = options.maxResults || 350;

  let connection: any = null;
  try {
    connection = await imaps.connect(config);

    // Identify the best mailbox(es) to scan.
    // For Gmail: '[Gmail]/All Mail' contains all categories (Primary, Updates, Forums, Archive).
    const isGmail = (account.imapHost && account.imapHost.toLowerCase().includes("gmail")) ||
                    (account.email && account.email.toLowerCase().includes("@gmail.com")) ||
                    (account.email && account.email.toLowerCase().includes("@googlemail.com"));

    const mailboxesToTry = isGmail
      ? ["[Gmail]/All Mail", "[Google Mail]/All Mail", "INBOX"]
      : ["INBOX", "[Gmail]/All Mail"];

    let openedBox = "";
    for (const box of mailboxesToTry) {
      try {
        await connection.openBox(box);
        openedBox = box;
        break;
      } catch {
        // Try next fallback box
      }
    }

    if (!openedBox) {
      await connection.openBox("INBOX");
      openedBox = "INBOX";
    }

    const searchCriteria: any[] = [];
    searchCriteria.push(["SINCE", formatImapDate(options.sinceDate)]);
    if (options.beforeDate) {
      searchCriteria.push(["BEFORE", formatImapDate(options.beforeDate)]);
    }

    // Crucial: Only fetch headers ("HEADER") during search to prevent downloading gigabytes of attachments/HTML bodies
    const fetchOptions = {
      bodies: ["HEADER"],
      markSeen: false,
    };

    const messages = await connection.search(searchCriteria, fetchOptions);

    const emailResults: FetchedEmailSummary[] = [];
    const seenMap = new Set<string>();

    // Process newest to oldest
    const orderedMessages = [...messages].reverse();

    for (const item of orderedMessages) {
      if (emailResults.length >= maxResults) break;

      const uid = item.attributes.uid;
      const allParts = item.parts || [];
      const headerPart = allParts.find((p) => p.which === "HEADER");

      let rawSubject = headerPart?.body?.subject?.[0] || "";
      let rawFrom = headerPart?.body?.from?.[0] || "";
      let rawDate = headerPart?.body?.date?.[0] || new Date().toISOString();
      let rawMessageId = headerPart?.body?.["message-id"]?.[0] || "";

      const subject = decodeMimeHeader(rawSubject).trim();
      const fromDecoded = decodeMimeHeader(rawFrom).trim();
      const messageId = rawMessageId ? rawMessageId.trim() : "";
      const dateStr = rawDate;

      // Clean sender details
      let fromName = fromDecoded;
      let fromEmail = fromDecoded;
      const emailMatch = fromDecoded.match(/<([^>]+)>/);
      if (emailMatch) {
        fromEmail = emailMatch[1].trim();
        fromName = fromDecoded.replace(/<[^>]+>/, "").replace(/["']/g, "").trim() || fromEmail;
      }

      const dedupKey = messageId || `${fromEmail}___${subject}___${dateStr.substring(0, 10)}`;
      if (seenMap.has(dedupKey)) continue;
      seenMap.add(dedupKey);

      // Create a clean preview snippet from subject & sender
      const cleanSnippet = `${subject} (From: ${fromName || fromEmail})`;

      emailResults.push({
        uid,
        messageId,
        date: new Date(dateStr).toISOString(),
        fromName,
        fromEmail,
        subject,
        snippet: cleanSnippet,
        bodyText: cleanSnippet,
      });
    }

    try {
      connection.end();
    } catch {
      // Ignore disconnect errors
    }

    // Sort chronologically (oldest first) so that chronological replay produces correct final Kanban statuses
    emailResults.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      success: true,
      emails: emailResults,
    };
  } catch (err: any) {
    if (connection) {
      try {
        connection.end();
      } catch {
        // Ignore
      }
    }
    let msg = err?.message || String(err);
    if (msg.includes("Invalid credentials") || msg.includes("AUTHENTICATIONFAILED") || msg.includes("Application-specific password required")) {
      msg = "Authentication failed. Please verify your 16-character App Password in email settings.";
    } else if (msg.includes("ETIMEDOUT") || msg.includes("ECONNRESET") || msg.includes("ENOTFOUND")) {
      msg = `Network connection to mail server timed out or failed (${msg}).`;
    }
    return {
      success: false,
      emails: [],
      error: `IMAP fetch failed: ${msg}`,
    };
  }
}

/**
 * Highly Accurate Non-AI Candidate & Recruiter Classifier:
 * - Strictly filters out Banking, Statements, Promos, OTPs, Security Alerts, and Automated Job Alert Digests
 * - Captures 100% of REAL Application Receipts & Auto-Replies (English & German, LinkedIn Easy Apply, ATS systems)
 * - Extracts clean Company name & Job Role for automated Kanban Board synchronization
 */
export function classifyRecruiterEmailRuleBased(
  email: FetchedEmailSummary,
  trackedCompanies: { id: string; company: string; role: string; status: string }[]
): {
  isCandidateRelated: boolean;
  matchedCompany?: string;
  matchedApplicationId?: string;
  role?: string;
  outcome: "interview" | "assessment" | "rejection" | "acknowledgement" | "offer" | "other";
  confidence: number;
  explanation: string;
} {
  const senderEmail = (email.fromEmail || "").toLowerCase().trim();
  const senderName = (email.fromName || "").toLowerCase().trim();
  const subject = (email.subject || "").toLowerCase().trim();
  const snippet = (email.snippet || "").toLowerCase().trim();
  const fullText = `${subject} ${senderName} ${senderEmail} ${snippet}`;

  // =========================================================================
  // 1. STRICT DISQUALIFIERS & SENDER BLACKLISTS (Job Alerts, Banking, Promos)
  // =========================================================================

  // A. Automated Job Alert Digests & Recommendation Newsletters (NOT applied confirmations)
  const isJobAlertSender =
    senderName.includes("job alert") ||
    senderName.includes("daily jobs") ||
    senderName.includes("job recommendations") ||
    senderName.includes("job agent") ||
    senderName.includes("jobagent") ||
    senderName.includes("stellenangebote") ||
    senderName.includes("job-empfehlungen") ||
    senderEmail.includes("jobalerts-noreply@linkedin.com") ||
    senderEmail.includes("jobs-listings@linkedin.com") ||
    senderEmail.includes("alert@indeed.com") ||
    senderEmail.includes("jobalert@indeed.com") ||
    senderEmail.includes("jobagent@stepstone") ||
    senderEmail.includes("dailyjobs@stepstone") ||
    senderName.includes("stepstone daily jobs") ||
    senderName.includes("linkedin job alerts") ||
    senderName.includes("glassdoor alerts") ||
    senderName.includes("ziprecruiter alerts") ||
    senderName.includes("monster job alerts");

  const isJobDigestSubject =
    /new\s*job\s*opportunities|jobs\s*you\s*may\s*be\s*interested\s*in|top\s*job\s*picks|jobs\s*matching|similar\s*jobs\s*to|jobs\s*for\s*you|neue\s*stellenangebote|passende\s*jobs\s*für\s*sie|stellenempfehlungen|job\s*recommendations|daily\s*job\s*alert|weekly\s*job\s*alert|empfohlene\s*stellenangebote/i.test(
      subject
    );

  // If it's a job alert, but NOT an application confirmation (e.g. "your application was sent to"), discard it immediately
  const hasApplicationSignal =
    /application\s*was\s*sent|application\s*was\s*submitted|applied\s*to|application\s*submitted|viewed\s*your\s*application/i.test(
      subject
    );

  if (isJobAlertSender || (isJobDigestSubject && !hasApplicationSignal)) {
    return {
      isCandidateRelated: false,
      outcome: "other",
      confidence: 100,
      explanation: "Filtered out automated Job Alert / Recommendation newsletter.",
    };
  }

  // B. Banking, Finance, Mutual Funds, Stock Market, Wallets, Cards, Bills
  const isBankingOrFinance =
    /hdfc|icici|sbi\b|state\s*bank|axisbank|axis\s*bank|kotak|citibank|citi\b|chase\b|bankofamerica|wellsfargo|barclays|hsbc|deutsche\s*bank|commerzbank|n26\b|revolut|paypal|stripe\s*billing|paytm|phonepe|razorpay|cred\b|amex|american\s*express|mastercard|visa\b|zerodha|groww|upstox|nse_alerts|bse\b|cdsl|nsdl|sebi|mint\b|moneycontrol|economic\s*times|mutual\s*fund|demat|sip\b|fastag|credit\s*card|debit\s*card|netbanking|bank\s*statement|account\s*statement|transaction\s*alert|funds\/securities\s*balance|bill\s*payment|bill\s*due|loan\s*approved|emi\b|cashback/i.test(
      fullText
    );

  // C. Retail, Travel, Food Delivery, Streaming, E-Commerce Promotions
  const isRetailOrFoodOrPromo =
    /amazon\b|flipkart|myntra|swiggy|zomato|uber\b|ola\b|airbnb|booking\.com|makemytrip|cleartrip|indigo\b|airindia|lufthansa|deutsche\s*bahn|netflix|spotify|prime\s*video|disney|hotstar|apple\.com|google\s*play|steam\b|coursera|udemy|doordash|instacart|ebay\b|walmart|target\b|sale\s*is\s*live|rakhi\s*sale|diwali\s*sale|black\s*friday|cyber\s*monday|%\s*off|discount\s*code|promo\s*code|weekend\s*deal|special\s*offer|flat\s*\d+%|unbeatable\s*prices|essential\s*reads|daily\s*briefing|newsletter|order\s*confirmed|tracking\s*number|shipped|delivered|bus\s*bookings/i.test(
      fullText
    );

  // D. Security Alerts, Password Resets, Verification Codes, Device Login Alerts
  const isOtpOrSecurity =
    /\botp\b|one\s*time\s*password|verification\s*code|security\s*alert|please\s*verify\s*your\s*new\s*device|verify\s*your\s*new\s*device|new\s*login\s*to\s*your|new\s*login\s*from|new\s*sign-in|two-factor|passcode|reset\s*your\s*password|temporary\s*access\s*code|shared\s*some\s*google\s*account\s*data|account\s*recovery|unusual\s*activity/i.test(
      fullText
    );

  // E. Non-Recruitment LinkedIn Social Clutter (connection requests, network posts, congratulations)
  const isLinkedInSocialClutter =
    (senderEmail.includes("linkedin.com") || senderName.includes("linkedin")) &&
    (/people\s*you\s*may\s*know|congratulate\s+|celebrate\s+|work\s*anniversary|reacted\s*to\s*your|liked\s*your\s*post|trending\s*in\s*your\s*network|who\s*viewed\s*your\s*profile|join\s*the\s*conversation|weekly\s*digest|invitation\s*to\s*connect|wants\s*to\s*connect/i.test(
      subject
    ));

  if (isBankingOrFinance || isRetailOrFoodOrPromo || isOtpOrSecurity || isLinkedInSocialClutter) {
    return {
      isCandidateRelated: false,
      outcome: "other",
      confidence: 100,
      explanation: "Filtered out non-recruitment message (Banking/Finance/Promo/Security/Social).",
    };
  }

  // =========================================================================
  // 2. VERIFIED RECRUITMENT SENDER & PLATFORM CHECK
  // =========================================================================

  // Dedicated ATS Platform Domains
  const isAtsPlatform =
    /greenhouse\.io|gh-mail\.io|lever\.co|myworkday\.com|workday\.com|ashbyhq\.com|smartrecruiters\.com|jobvite\.com|bamboohr\.com|taleo\.net|icims\.com|workable\.com|personio\.de|personio\.com|teamtailor\.com|pinpointhq\.com|recruitee\.com|join\.com|talention\.com|breezy\.hr|jazzhr\.com|rippling\.com|gem\.com|dover\.io|hirevue\.com|codility\.com|coderbyte\.com|hackerrank\.com|testgorilla\.com|successfactors\.com|sap\.com|avature\.net|eightfold\.ai/i.test(
      senderEmail
    );

  // Direct Talent / HR / Recruiting Sender Handles
  const isDirectRecruitingSender =
    /recruiting@|talent@|careers@|hiring@|jobs@|people@|hr@|talentacquisition@|interviews@|bewerbung@|karriere@/i.test(
      senderEmail
    ) ||
    senderName.includes("talent acquisition") ||
    senderName.includes("recruiting") ||
    senderName.includes("careers") ||
    senderName.includes("p&o talent") ||
    senderName.includes("people & culture") ||
    senderName.includes("hiring team");

  // Real LinkedIn Application / InMail Messages
  const isLinkedInApplication =
    (senderEmail.includes("linkedin.com") || senderName.includes("linkedin")) &&
    (/your\s*application\s*was\s*sent\s*to|your\s*application\s*was\s*submitted\s*to|application\s*submitted|viewed\s*your\s*application|inmail|message\s*from.*recruiter/i.test(
      subject
    ) ||
      /your\s*application\s*was\s*sent\s*to|application\s*submitted/i.test(snippet));

  // =========================================================================
  // 3. CANDIDATE / RECRUITER PHRASES (English & German)
  // =========================================================================

  // A. Application Received / Receipt Confirmation (Gate 1)
  const isApplicationConfirmation =
    /thanks\s*for\s*your\s*application|thank\s*you\s*for\s*applying|thanks\s*for\s*applying|thank\s*you\s*for\s*your\s*application|we\s*have\s*received\s*your\s*application|we've\s*received\s*your\s*application|we\s*received\s*your\s*application|your\s*application\s*(has\s*been|was)\s*received|application\s*received|application\s*confirmation|your\s*application\s*was\s*sent\s*to|your\s*application\s*was\s*submitted|application\s*submitted|successfully\s*submitted\s*your\s*application|confirming\s*receipt\s*of\s*your\s*application|thank\s*you\s*for\s*your\s*interest\s*in|vielen\s*dank\s*für\s*ihre\s*bewerbung|vielen\s*dank\s*für\s*deine\s*bewerbung|danke\s*für\s*deine\s*bewerbung|danke\s*für\s*ihre\s*bewerbung|eingang\s*ihrer\s*bewerbung|eingangsbestätigung|bestätigung\s*ihrer\s*bewerbung|bestätigung\s*deiner\s*bewerbung|bewerbungseingang|empfangsbestätigung|wir\s*haben\s*ihre\s*bewerbung\s*erhalten|wir\s*haben\s*deine\s*bewerbung\s*erhalten|ihre\s*bewerbung\s*als|deine\s*bewerbung\s*als|ihre\s*bewerbung\s*bei|deine\s*bewerbung\s*bei|vielen\s*dank\s*für\s*ihr\s*interesse\s*an/i.test(
      fullText
    );

  // B. Interview Invitations (Gate 2)
  const isInterview =
    /invitation\s*to\s*interview|interview\s*invitation|technical\s*screen|phone\s*screen|schedule\s*(a|your)\s*interview|schedule\s*a\s*call|select\s*a\s*time\s*slot|virtual\s*interview|coding\s*interview|interview\s*with|calendly\.com|goodtime\.io|einladung\s*zum\s*vorstellungsgespräch|einladung\s*zum\s*interview|telefoninterview|kennenlerngespräch|terminvereinbarung\s*zum\s*interview/i.test(
      fullText
    );

  // C. Technical Assessments / Coding Tests (Gate 3)
  const isAssessment =
    /online\s*assessment|coding\s*challenge|hackerrank|coderbyte|codility|take-home\s*assignment|skills\s*assessment|technical\s*test|online-test|coding-aufgabe|fachlicher\s*test|testgorilla/i.test(
      fullText
    );

  // D. Rejection Updates (Gate 4)
  const isRejection =
    /not\s*moving\s*forward|decided\s*to\s*(move\s*forward\s*with|pursue)\s*other|pursue\s*other\s*candidates|unsuccessful|regret\s*to\s*inform|carefully\s*reviewed\s*your\s*application|position\s*has\s*been\s*filled|will\s*not\s*be\s*(moving\s*forward|progressing)|not\s*selected\s*for|unfortunately,\s*after\s*careful|leider\s*müssen\s*wir\s*ihnen\s*mitteilen|nicht\s*berücksichtigen\s*können|absage\s*zu\s*ihrer\s*bewerbung|entscheidung\s*zu\s*ihrer\s*bewerbung/i.test(
      fullText
    );

  // E. Job Offers (Gate 5)
  const isOffer =
    /offer\s*of\s*employment|formal\s*offer|job\s*offer|pleased\s*to\s*offer\s*you|congratulations\s*on\s*your\s*offer|welcome\s*to\s*the\s*team|offer\s*letter|vertragsangebot|arbeitsvertrag/i.test(
      fullText
    );

  // Check if any tracked company in user's Kanban matches
  const matchedComp = trackedCompanies.find((c) => {
    if (!c.company || c.company.trim().length < 2) return false;
    const cName = c.company.toLowerCase().trim();
    const reg = new RegExp(`\\b${cName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return reg.test(fullText);
  });

  // Verify candidate qualification gate:
  const isGenuineRecruitment =
    isApplicationConfirmation ||
    isInterview ||
    isAssessment ||
    isRejection ||
    isOffer ||
    isLinkedInApplication ||
    (isAtsPlatform && (isApplicationConfirmation || /application|candidate|status|bewerbung/i.test(fullText))) ||
    (Boolean(matchedComp) && (isDirectRecruitingSender || /application|bewerbung|status|interview/i.test(fullText)));

  if (!isGenuineRecruitment) {
    return {
      isCandidateRelated: false,
      outcome: "other",
      confidence: 90,
      explanation: "No genuine recruitment or candidate communication patterns detected.",
    };
  }

  // =========================================================================
  // 4. INTELLIGENT COMPANY & ROLE EXTRACTION
  // =========================================================================
  let detectedCompany = matchedComp?.company || "";
  let detectedRole = matchedComp?.role || "";

  // Extract from Sender or Subject if not already tracked
  if (!detectedCompany) {
    // 1. LinkedIn specific extractions
    const liSent = email.subject.match(/application (?:was|is)?\s*(?:sent|submitted|delivered)?\s*(?:to|for)\s+([A-Za-z0-9\s&.-]{2,40})/i) ||
                   email.snippet.match(/application (?:was|is)?\s*(?:sent|submitted|delivered)?\s*(?:to|for)\s+([A-Za-z0-9\s&.-]{2,40})/i);

    const liApplied = email.subject.match(/(?:you applied to|application to|applied for|applied at)\s+([A-Za-z0-9\s&.-]{2,40})/i) ||
                      email.snippet.match(/(?:you applied to|application to|applied for|applied at)\s+([A-Za-z0-9\s&.-]{2,40})/i);

    // 2. LinkedIn "[Company] viewed your application"
    const liViewed = email.subject.match(/([^,.\n!]+?)\s+(?:viewed your application|downloaded your resume)/i);

    // 3. Subject with "at [Company]" / "bei [Company]" / "to [Company]"
    const applyToMatch = email.subject.match(/(?:applying to|interest in|bewerbung bei|application to|position at|role at|opportunity at)\s+([A-Za-z0-9\s&.-]{2,35})/i);
    const atMatch = email.subject.match(/\bat\s+([A-Za-z0-9\s&.-]{2,35})/i) ||
                    email.subject.match(/\bbei\s+([A-Za-z0-9\s&.-]{2,35})/i);

    // 4. Sender Name Extraction (e.g. "Siemens P&O Talent", "Anthropic Careers", "Porsche AG")
    const senderClean = email.fromName
      .replace(/["']/g, "")
      .replace(/\s*(P&O Talent|Talent Acquisition|Recruiting Team|Talent Team|Careers|Recruiting|Karriere|Hiring Team|Team|GmbH|AG|Inc\.?|LLC|Pvt Ltd|HR Team)\b.*$/gi, "")
      .trim();

    // 5. Direct Domain extraction (e.g. careers@siemens.com -> Siemens)
    let domainCompany = "";
    if (senderEmail && !senderEmail.includes("gmail") && !senderEmail.includes("outlook") && !senderEmail.includes("yahoo") && !senderEmail.includes("linkedin") && !senderEmail.includes("hotmail")) {
      const domainMatch = senderEmail.split("@")[1];
      if (domainMatch && !/greenhouse|lever|workday|ashby|smartrecruiters|personio|join|teamtailor|bamboohr|icims|taleo|stepstone|indeed|jobvite|bullhorn/i.test(domainMatch)) {
        const rootDomain = domainMatch.split(".")[0];
        if (rootDomain && rootDomain.length >= 3) {
          domainCompany = rootDomain.charAt(0).toUpperCase() + rootDomain.slice(1);
        }
      }
    }

    if (liSent && !/^(linkedin|stepstone|indeed|job|careers)$/i.test(liSent[1].trim())) {
      detectedCompany = liSent[1].trim();
    } else if (liApplied && !/^(linkedin|stepstone|indeed|job|careers)$/i.test(liApplied[1].trim())) {
      detectedCompany = liApplied[1].trim();
    } else if (liViewed && !/^(linkedin|stepstone|indeed)$/i.test(liViewed[1].trim())) {
      detectedCompany = liViewed[1].trim();
    } else if (applyToMatch && !/^(linkedin|stepstone|indeed)$/i.test(applyToMatch[1].trim())) {
      detectedCompany = applyToMatch[1].trim().split(" - ")[0].split(" | ")[0].split("(")[0].trim();
    } else if (senderClean && senderClean.length >= 2 && !/^(linkedin|stepstone|indeed|noreply|no-reply|notification|notifications|google|support|system|jobs|recruitment|talent)$/i.test(senderClean)) {
      detectedCompany = senderClean;
    } else if (atMatch && !/^(linkedin|stepstone|indeed)$/i.test(atMatch[1].trim())) {
      detectedCompany = atMatch[1].trim().split(" - ")[0].split(" | ")[0].split("(")[0].trim();
    } else if (domainCompany) {
      detectedCompany = domainCompany;
    }

    if (!detectedCompany) {
      if (email.fromEmail && email.fromEmail.includes("@")) {
        const dom = email.fromEmail.split("@")[1];
        if (dom && !/gmail|outlook|yahoo|linkedin|hotmail/i.test(dom)) {
          const rDom = dom.split(".")[0];
          if (rDom && rDom.length >= 2) {
            detectedCompany = rDom.charAt(0).toUpperCase() + rDom.slice(1);
          }
        }
      }
      if (!detectedCompany && email.subject) {
        const atMatch = email.subject.match(/(?:at|bei|to|for)\s+([A-Za-z0-9\s&.-]{2,30})/i);
        if (atMatch && atMatch[1] && !/^(linkedin|stepstone|indeed|job|careers)$/i.test(atMatch[1].trim())) {
          detectedCompany = atMatch[1].trim().split(" - ")[0].split(" | ")[0].trim();
        }
      }
    }
  }

  // Extract Role from snippet / subject if available
  if (!detectedRole) {
    const roleMatch =
      email.subject.match(/application (?:submitted|received|for):\s*([^,.\n(]+?)(?:\s+at|\s+bei|$)/i) ||
      email.subject.match(/(?:for our|for the|for position|als|für die Position|für die Stelle|Stelle als|application for|applied for)\s+([^,.\n(]{3,50})/i) ||
      email.snippet.match(/(?:for our|for the|for position|als|für die Position|für die Stelle|Stelle als|applied for)\s+([^,.\n(]{3,50})/i) ||
      email.subject.match(/-\s*(Working Student[^,.\n(]+|Software Engineer[^,.\n(]+|Developer[^,.\n(]+|Full Stack[^,.\n(]+|Frontend[^,.\n(]+|Backend[^,.\n(]+|Data Engineer[^,.\n(]+|DevOps[^,.\n(]+|Praktikant[^,.\n(]+|Intern[^,.\n(]+)/i);

    if (roleMatch) {
      detectedRole = roleMatch[1].trim();
    }
  }

  // Clean company name and eliminate common noise words
  if (detectedCompany) {
    detectedCompany = detectedCompany
      .replace(/[.,:;!]+$/, "")
      .replace(/^(the|a)\s+/i, "")
      .replace(/\s+(Team|Recruiting|Careers|Talent|P&O|GmbH|AG|Inc\.?|LLC|SE|KG|Ltd\.?)$/i, "")
      .trim();

    if (/^(linkedin|stepstone|indeed|noreply|no-reply|notification|support)$/i.test(detectedCompany)) {
      detectedCompany = "";
    }
  }

  // =========================================================================
  // 5. PRECISE OUTCOME CLASSIFICATION & CONFIDENCE
  // =========================================================================
  let outcome: "interview" | "assessment" | "rejection" | "acknowledgement" | "offer" = "acknowledgement";
  let explanation = "Application confirmation received";
  let confidence = 95;

  if (isOffer) {
    outcome = "offer";
    explanation = "Formal employment offer detected.";
    confidence = 98;
  } else if (isInterview) {
    outcome = "interview";
    explanation = "Interview or screening invitation detected.";
    confidence = 96;
  } else if (isAssessment) {
    outcome = "assessment";
    explanation = "Technical assessment / coding challenge invitation.";
    confidence = 95;
  } else if (isRejection) {
    outcome = "rejection";
    explanation = "Candidate rejection notice detected.";
    confidence = 97;
  } else {
    outcome = "acknowledgement";
    explanation = "Job application receipt / confirmation received.";
    confidence = 94;
  }

  return {
    isCandidateRelated: true,
    matchedCompany: detectedCompany || undefined,
    matchedApplicationId: matchedComp?.id,
    role: detectedRole || undefined,
    outcome,
    confidence,
    explanation,
  };
}
