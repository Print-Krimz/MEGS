export const isAllUpper = (str: string): boolean => {
  return str === str.toUpperCase() && /[A-Z]/.test(str);
};

export const MINOR_WORDS = new Set([
  "a", "an", "the",
  "and", "but", "or", "nor", "for", "yet", "so",
  "at", "by", "in", "of", "on", "to", "up", "as", "with",
  "de", "del", "dela", "da", "di", "von", "van", "ng", "sa", "mga"
]);

export const SPECIAL_CASING: Record<string, string> = {
  "IT": "IT",
  "HR": "HR",
  "QA": "QA",
  "QC": "QC",
  "UI": "UI",
  "UX": "UX",
  "AI": "AI",
  "ML": "ML",
  "VR": "VR",
  "AR": "AR",
  "BI": "BI",
  "CI": "CI",
  "CD": "CD",
  "DEVOPS": "DevOps",
  "PHP": "PHP",
  "SQL": "SQL",
  "AWS": "AWS",
  "GCP": "GCP",
  "CSS": "CSS",
  "HTML": "HTML",
  "XML": "XML",
  "JSON": "JSON",
  "REST": "REST",
  "API": "API",
  "APIS": "APIs",
  "SDK": "SDK",
  "SDKS": "SDKs",
  "ERP": "ERP",
  "SAP": "SAP",
  "CRM": "CRM",
  "SAAS": "SaaS",
  "PAAS": "PaaS",
  "IAAS": "IaaS",
  "TCP": "TCP",
  "IP": "IP",
  "DNS": "DNS",
  "URL": "URL",
  "HTTP": "HTTP",
  "HTTPS": "HTTPS",
  "VPN": "VPN",
  "LAN": "LAN",
  "WAN": "WAN",
  "OS": "OS",
  "DB": "DB",
  "DBMS": "DBMS",
  "RDBMS": "RDBMS",
  "ETL": "ETL",
  "CMS": "CMS",
  "SEO": "SEO",
  "SEM": "SEM",
  "PMP": "PMP",
  "CISSP": "CISSP",
  "CEH": "CEH",
  "BS": "BS",
  "BA": "BA",
  "BSC": "BSc",
  "MS": "MS",
  "MA": "MA",
  "MSC": "MSc",
  "MBA": "MBA",
  "PHD": "PhD",
  "MD": "MD",
  "JD": "JD",
  "CPA": "CPA",
  "RN": "RN",
  "LPT": "LPT",
  "CEO": "CEO",
  "CTO": "CTO",
  "CFO": "CFO",
  "COO": "COO",
  "CIO": "CIO",
  "CMO": "CMO",
  "VP": "VP",
  "SVP": "SVP",
  "AVP": "AVP",
  "NCR": "NCR",
  "CAR": "CAR",
  "ARMM": "ARMM",
  "BARMM": "BARMM",
  "USA": "USA",
  "UK": "UK",
  "UAE": "UAE",
  "KSA": "KSA",
  "PH": "PH",
  "BPO": "BPO",
  "TESDA": "TESDA",
  "NC": "NC",
  "PRC": "PRC",
  "NBI": "NBI",
  "BIR": "BIR",
  "SSS": "SSS",
  "TIN": "TIN",
  "DOLE": "DOLE",
  "DTI": "DTI",
  "DEPED": "DepEd",
  "CHED": "CHED",
  "I": "I",
  "II": "II",
  "III": "III",
  "IV": "IV",
  "V": "V",
  "VI": "VI",
  "VII": "VII",
  "VIII": "VIII",
  "IX": "IX",
  "X": "X",
  "JR": "Jr.",
  "JR.": "Jr.",
  "SR": "Sr.",
  "SR.": "Sr.",
  "NODE.JS": "Node.js",
  "REACT": "React",
  "REACT.JS": "React.js",
  "VUE": "Vue",
  "VUE.JS": "Vue.js",
  "NEXT.JS": "Next.js",
  "EXPRESS.JS": "Express.js",
  "TYPESCRIPT": "TypeScript",
  "JAVASCRIPT": "JavaScript",
  "POSTGRESQL": "PostgreSQL",
  "MONGODB": "MongoDB",
  "GRAPHQL": "GraphQL",
  "DOCKER": "Docker",
  "KUBERNETES": "Kubernetes",
  "GIT": "Git",
  "GITHUB": "GitHub",
  "GITLAB": "GitLab",
  "LINUX": "Linux",
  "BRGY": "Brgy.",
  "BRGY.": "Brgy.",
};

const ABBREVIATIONS_NOT_SENTENCE_END = new Set([
  "MR.", "MS.", "MRS.", "DR.", "ENGR.", "PROF.", "SR.", "JR.", "BRGY.", "ETC.", "VS.", "E.G.", "I.E."
]);

export const formatSingleWord = (word: string, isFirst: boolean, isLast: boolean): string => {
  if (!word) return word;
  const wordUpper = word.toUpperCase();
  if (SPECIAL_CASING[wordUpper]) {
    return SPECIAL_CASING[wordUpper];
  }

  // Check leading/trailing punctuation
  const trailingMatch = word.match(/([,.!?;:()]+)$/);
  const trailing = trailingMatch ? trailingMatch[1] : "";
  const withoutTrailing = trailing ? word.slice(0, -trailing.length) : word;

  const leadingMatch = withoutTrailing.match(/^([([{"'“‘]+)/);
  const leading = leadingMatch ? leadingMatch[1] : "";
  const core = leading ? withoutTrailing.slice(leading.length) : withoutTrailing;

  if (!core) return word;

  const coreUpper = core.toUpperCase();
  if (SPECIAL_CASING[coreUpper]) {
    return leading + SPECIAL_CASING[coreUpper] + trailing;
  }

  // Handle slashes like UI/UX
  if (core.includes("/")) {
    const parts = core.split("/").map((part) => {
      const pUpper = part.toUpperCase();
      return SPECIAL_CASING[pUpper] || (part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    });
    return leading + parts.join("/") + trailing;
  }

  // Handle hyphens like Full-Stack, Mary-Jane
  if (core.includes("-")) {
    const parts = core.split("-").map((part) => {
      const pUpper = part.toUpperCase();
      return SPECIAL_CASING[pUpper] || (part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    });
    return leading + parts.join("-") + trailing;
  }

  // Handle apostrophes like O'Connor
  if (core.includes("'")) {
    const parts = core.split("'").map((part) => {
      const pUpper = part.toUpperCase();
      return SPECIAL_CASING[pUpper] || (part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    });
    return leading + parts.join("'") + trailing;
  }

  const coreLower = core.toLowerCase();
  if (!isFirst && !isLast && MINOR_WORDS.has(coreLower)) {
    return leading + coreLower + trailing;
  }

  return leading + core.charAt(0).toUpperCase() + core.slice(1).toLowerCase() + trailing;
};

export const normalizeTitleCase = (str?: string): string | undefined => {
  if (!str) return undefined;
  const trimmed = str.trim();
  if (!trimmed) return undefined;
  if (!isAllUpper(trimmed)) return trimmed;

  const words = trimmed.split(/\s+/);
  const formatted = words.map((w, idx) =>
    formatSingleWord(w, idx === 0, idx === words.length - 1)
  );
  return formatted.join(" ");
};

export const normalizeSentenceCase = (text?: string): string | undefined => {
  if (!text) return undefined;
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  if (!isAllUpper(trimmed)) return trimmed;

  const tokens = trimmed.split(/(\s+)/);
  let newSentence = true;

  const result = tokens.map((token) => {
    if (/^\s+$/.test(token)) {
      if (token.includes("\n")) {
        newSentence = true;
      }
      return token;
    }

    const trailingMatch = token.match(/([,.!?;:()]+)$/);
    const trailing = trailingMatch ? trailingMatch[1] : "";
    const withoutTrailing = trailing ? token.slice(0, -trailing.length) : token;

    const leadingMatch = withoutTrailing.match(/^([([{"'“‘]+)/);
    const leading = leadingMatch ? leadingMatch[1] : "";
    const core = leading ? withoutTrailing.slice(leading.length) : withoutTrailing;

    if (!core) return token;

    const coreUpper = core.toUpperCase();
    let formattedCore = "";

    if (SPECIAL_CASING[coreUpper]) {
      formattedCore = SPECIAL_CASING[coreUpper];
    } else if (newSentence) {
      formattedCore = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
    } else {
      formattedCore = core.toLowerCase();
    }

    if (trailing.includes(".") || trailing.includes("!") || trailing.includes("?")) {
      if (!ABBREVIATIONS_NOT_SENTENCE_END.has(coreUpper + ".")) {
        newSentence = true;
      } else {
        newSentence = false;
      }
    } else {
      newSentence = false;
    }

    return leading + formattedCore + trailing;
  });

  return result.join("");
};

export const normalizeSkill = (val: any): string => {
  const str = typeof val === "string" ? val.trim() : String(val || "").trim();
  if (!str) return "";
  if (!isAllUpper(str)) return str;
  const upper = str.toUpperCase();
  if (SPECIAL_CASING[upper]) return SPECIAL_CASING[upper];
  return normalizeTitleCase(str) || str;
};
