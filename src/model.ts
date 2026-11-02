export type Creative = {
  headline: string;
  body: string;
  cta: string;
  disclosure: string;
};
export type Finding = {
  id: string;
  title: string;
  field: keyof Creative;
  policyId: string;
  reason: string;
  suggestion: string;
  status: "open" | "verified" | "dismissed";
  note?: string;
};
export type Version = {
  number: number;
  creative: Creative;
  submittedAt: string;
  submittedBy: string;
  response: string;
  findings: Finding[];
};
export type Review = {
  id: string;
  title: string;
  product: "Personal loans" | "Credit cards" | "Mortgage";
  channel: string;
  placement: string;
  audience: string;
  partner: string;
  owner: string;
  initials: string;
  due: string;
  status: "ready" | "changes_requested" | "approved";
  versions: Version[];
  events: { id: string; at: string; actor: string; message: string }[];
  approval?: { version: number; at: string; by: string; scope: string };
};

export const policies = [
  {
    id: "CP-01",
    title: "Support eligibility claims",
    body: "Illustrative internal policy: avoid unconditional approval promises. Describe eligibility and underwriting accurately. A reviewer must assess the complete offer and supporting evidence.",
  },
  {
    id: "CP-02",
    title: "Make borrowing costs clear",
    body: "Illustrative internal policy: check that a quoted borrowing rate is identified as an APR and that applicable terms are clear. This narrow text check does not assess every disclosure or legal requirement.",
  },
  {
    id: "CP-03",
    title: "Include offer disclosures",
    body: "Illustrative internal policy: include the relevant qualifications with the offer. Presence of disclosure text does not establish accuracy, prominence, completeness, or compliance.",
  },
];

const fields: (keyof Creative)[] = ["headline", "body", "cta", "disclosure"];
const products = ["Personal loans", "Credit cards", "Mortgage"];
const findingStatuses = ["open", "verified", "dismissed"];
export const storageKey = "clearpath-review-v1";
const recoveryKey = `${storageKey}-recovery`;

const nonempty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const normalized = (text: string) =>
  text.trim().replace(/\s+/g, " ").toLowerCase();
const requireThat = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const approvalScope = (review: Review) =>
  `${review.product} · ${review.channel} · ${review.placement} · ${review.audience} · ${review.partner}`;

export function current(review: Review): Version {
  const version = review.versions.at(-1);
  if (!version) throw new Error("This review has no submitted version.");
  return version;
}

function recordEvent(review: Review, actor: string, message: string): Review {
  return {
    ...review,
    events: [...review.events, { id: uid(), at: now(), actor, message }],
  };
}

function replaceCurrent(review: Review, version: Version): Review {
  return { ...review, versions: [...review.versions.slice(0, -1), version] };
}

/** A few deliberately narrow demo checks. No match is not a compliance determination. */
export function checkCreative(creative: Creative): Finding[] {
  const findings: Finding[] = [];
  const combined = fields.map((field) => creative[field]).join(" ");
  for (const field of fields) {
    const text = creative[field];
    if (
      /\bguaranteed\s+approval\b|\bapproval\s+(?:is\s+)?guaranteed\b|\beveryone\s+(?:is\s+)?(?:gets\s+)?approved\b/i.test(
        text,
      )
    ) {
      findings.push({
        id: `claim-${field}`,
        title: "Unconditional approval claim",
        field,
        policyId: "CP-01",
        reason:
          "This copy appears to promise approval without an eligibility qualification.",
        suggestion:
          "Remove the guarantee and explain that approval is subject to eligibility and credit review.",
        status: "open",
      });
    }
    if (
      /\d+(?:\.\d+)?\s*%/.test(text) &&
      /\brate(?:s)?\b|\binterest\b/i.test(text) &&
      !/\bAPRs?\b|annual percentage rates?/i.test(combined)
    ) {
      findings.push({
        id: `rate-${field}`,
        title: "Quoted rate needs APR context",
        field,
        policyId: "CP-02",
        reason:
          "A borrowing rate is quoted, but this creative does not identify an APR.",
        suggestion:
          "Provide the accurate APR and relevant offer terms; verify those terms against the approved offer.",
        status: "open",
      });
    }
  }
  if (!creative.disclosure.trim()) {
    findings.push({
      id: "disclosure-missing",
      title: "Offer disclosure is missing",
      field: "disclosure",
      policyId: "CP-03",
      reason: "No disclosure text was included with this submission.",
      suggestion:
        "Add the qualifications and terms that apply to this exact offer and placement.",
      status: "open",
    });
  }
  return findings;
}

export function addFinding(
  review: Review,
  input: {
    title: string;
    field: keyof Creative;
    reason: string;
    suggestion: string;
  },
): Review {
  requireThat(
    review.status === "ready",
    "Findings can only be added to a ready review.",
  );
  requireThat(
    fields.includes(input.field),
    "Choose a creative field for this finding.",
  );
  requireThat(
    nonempty(input.title) &&
      nonempty(input.reason) &&
      nonempty(input.suggestion),
    "Add a finding title, reason, and requested change.",
  );
  const version = current(review);
  const finding: Finding = {
    id: uid(),
    title: input.title.trim(),
    field: input.field,
    reason: input.reason.trim(),
    suggestion: input.suggestion.trim(),
    policyId: "Reviewer",
    status: "open",
  };
  return recordEvent(
    replaceCurrent(review, {
      ...version,
      findings: [...version.findings, finding],
    }),
    "You",
    `Added “${finding.title}” on v${version.number} (${finding.field}): ${finding.reason} Requested change: ${finding.suggestion}`,
  );
}

export function canVerifyFix(review: Review, finding: Finding): boolean {
  const version = current(review);
  const previous = review.versions.at(-2);
  const active = version.findings.find(
    (item) => item.id === finding.id && item.field === finding.field,
  );
  return (
    review.status === "ready" &&
    !!active &&
    !!previous &&
    previous.findings.some(
      (item) => item.id === finding.id && item.field === finding.field,
    ) &&
    normalized(previous.creative[finding.field]) !==
      normalized(version.creative[finding.field]) &&
    !checkCreative(version.creative).some((item) => item.id === finding.id)
  );
}

export function updateFinding(
  review: Review,
  id: string,
  status: Finding["status"],
  note = "",
): Review {
  requireThat(
    review.status === "ready",
    "Only a review that is ready can have its findings changed.",
  );
  requireThat(
    findingStatuses.includes(status),
    "Choose a valid finding status.",
  );
  requireThat(typeof note === "string", "The finding note must be text.");
  requireThat(
    status !== "dismissed" || nonempty(note),
    "Explain why this finding can be dismissed.",
  );
  const version = current(review);
  const finding = version.findings.find((item) => item.id === id);
  requireThat(finding, "This finding does not belong to the current version.");
  requireThat(
    status !== "verified" || nonempty(note) || canVerifyFix(review, finding!),
    "Add a note explaining your review judgment before resolving this finding.",
  );
  const findings = version.findings.map((item) =>
    item.id === id ? { ...item, status, note: note.trim() } : item,
  );
  const verb =
    status === "verified"
      ? "Verified"
      : status === "dismissed"
        ? "Dismissed"
        : "Reopened";
  return recordEvent(
    replaceCurrent(review, { ...version, findings }),
    "You",
    `${verb} “${finding!.title}” on v${version.number}.${note.trim() ? ` ${note.trim()}` : ""}`,
  );
}

export function requestChanges(review: Review, note: string): Review {
  requireThat(
    review.status === "ready",
    "Changes can only be requested for a ready review.",
  );
  requireThat(
    current(review).findings.some((finding) => finding.status === "open"),
    "Keep at least one finding open before requesting changes.",
  );
  requireThat(
    nonempty(note),
    "Add a note so the marketer knows what to change.",
  );
  return recordEvent(
    { ...review, status: "changes_requested", approval: undefined },
    "You",
    `Requested changes on v${current(review).number}: ${note.trim()}`,
  );
}

function validateCreative(creative: Creative) {
  requireThat(
    creative && fields.every((field) => nonempty(creative[field])),
    "Complete the headline, body, call to action, and disclosure.",
  );
}

export function submitRevision(
  review: Review,
  creative: Creative,
  response: string,
): Review {
  requireThat(
    review.status === "changes_requested",
    "A revision can only be submitted after changes are requested.",
  );
  validateCreative(creative);
  requireThat(nonempty(response), "Explain what changed for the reviewer.");
  const previous = current(review);
  requireThat(
    fields.some(
      (field) =>
        normalized(creative[field]) !== normalized(previous.creative[field]),
    ),
    "Change the creative before submitting a new version.",
  );
  const cleaned = Object.fromEntries(
    fields.map((field) => [field, creative[field].trim()]),
  ) as Creative;
  const findings: Finding[] = previous.findings.map((finding) => ({
    ...finding,
    status: "open",
    note: undefined,
  }));
  for (const finding of checkCreative(cleaned)) {
    if (!findings.some((item) => item.id === finding.id))
      findings.push({ ...finding, note: undefined });
  }
  const version: Version = {
    number: previous.number + 1,
    creative: cleaned,
    submittedAt: now(),
    submittedBy: review.owner,
    response: response.trim(),
    findings,
  };
  return recordEvent(
    {
      ...review,
      status: "ready",
      approval: undefined,
      versions: [...review.versions, version],
    },
    review.owner,
    `Submitted v${version.number}: ${response.trim()}`,
  );
}

export function approveReview(review: Review, attested: boolean): Review {
  requireThat(
    review.status === "ready",
    "Only a ready review can be approved.",
  );
  const version = current(review);
  requireThat(
    version.findings.every((finding) => finding.status !== "open"),
    "Verify or dismiss every open finding before approving.",
  );
  requireThat(
    attested === true,
    "Confirm that you reviewed the full creative, disclosures, and intended use.",
  );
  const approval = {
    version: version.number,
    at: now(),
    by: "You",
    scope: approvalScope(review),
  };
  return recordEvent(
    { ...review, status: "approved", approval },
    "You",
    `Approved v${version.number} for ${approval.scope}. Full creative and intended use reviewed.`,
  );
}

export function createReview(input: {
  title: string;
  product: Review["product"];
  channel: string;
  placement: string;
  audience: string;
  partner: string;
  owner: string;
  creative: Creative;
  due?: string;
}): Review {
  for (const key of [
    "title",
    "channel",
    "placement",
    "audience",
    "partner",
    "owner",
  ] as const) {
    requireThat(nonempty(input[key]), `Complete the ${key} before submitting.`);
  }
  requireThat(products.includes(input.product), "Choose a supported product.");
  if (input.due !== undefined) {
    const validDate =
      typeof input.due === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        input.due,
      ) &&
      timestamp(input.due);
    requireThat(validDate, "Choose a valid requested launch date and time.");
    const calendarDate = input.due.slice(0, 10);
    requireThat(
      new Date(`${calendarDate}T00:00:00Z`)
        .toISOString()
        .startsWith(calendarDate),
      "Choose a valid requested launch date and time.",
    );
  }
  validateCreative(input.creative);
  const creative = Object.fromEntries(
    fields.map((field) => [field, input.creative[field].trim()]),
  ) as Creative;
  const submittedAt = now();
  const review: Review = {
    id: `CP-${uid().replace(/-/g, "").slice(0, 8).toUpperCase()}`,
    title: input.title.trim(),
    product: input.product,
    channel: input.channel.trim(),
    placement: input.placement.trim(),
    audience: input.audience.trim(),
    partner: input.partner.trim(),
    owner: input.owner.trim(),
    initials: input.owner
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase(),
    due: input.due
      ? new Date(input.due).toISOString()
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: "ready",
    versions: [
      {
        number: 1,
        creative,
        submittedAt,
        submittedBy: input.owner.trim(),
        response: "",
        findings: checkCreative(creative),
      },
    ],
    events: [
      {
        id: uid(),
        at: submittedAt,
        actor: input.owner.trim(),
        message: "Submitted v1 for review.",
      },
    ],
  };
  return review;
}

export function makeSeed(): Review[] {
  const seededAt = Date.now();
  const date = (hours: number) =>
    new Date(seededAt + hours * 3600000).toISOString();
  const loanDisclosure =
    "Illustrative offer. Personal loans from $2,000–$35,000. APRs range from 9.99%–29.99%; terms of 24–60 months. Your rate depends on creditworthiness. Approval and terms are subject to eligibility and credit review.";
  const original: Creative = {
    headline: "A little breathing room",
    body: "Life happens. Get guaranteed approval for a personal loan with rates from 9.99%.",
    cta: "Get my loan",
    disclosure: "Loans from $2,000–$35,000. Terms apply.",
  };
  const revised: Creative = {
    headline: "A little breathing room",
    body: "Make room for what comes next. Explore a personal loan with fixed rates from 9.99% APR, subject to credit approval.",
    cta: "Explore my options",
    disclosure: loanDisclosure,
  };
  const build = (
    id: string,
    title: string,
    product: Review["product"],
    channel: string,
    partner: string,
    owner: string,
    hours: number,
    creative: Creative,
  ): Review => ({
    id,
    title,
    product,
    channel,
    partner,
    owner,
    initials: owner
      .split(" ")
      .map((name) => name[0])
      .join(""),
    placement:
      channel === "Paid social"
        ? "Instagram feed · mobile"
        : channel === "Email"
          ? "Email body · desktop and mobile"
          : "Landing page · desktop and mobile",
    audience: "US adults 18+ · prospecting",
    due: date(hours),
    status: "ready",
    versions: [
      {
        number: 1,
        creative,
        submittedAt: date(-30),
        submittedBy: owner,
        response: "",
        findings: checkCreative(creative),
      },
    ],
    events: [
      {
        id: `${id}-submitted`,
        at: date(-30),
        actor: owner,
        message: "Submitted v1 for review.",
      },
    ],
  });
  const returning = build(
    "CP-1042",
    "A little breathing room",
    "Personal loans",
    "Paid social",
    "BrightNest",
    "Maya Chen",
    3,
    original,
  );
  returning.versions.push({
    number: 2,
    creative: revised,
    submittedAt: date(-1),
    submittedBy: "Maya Chen",
    response:
      "Removed the approval guarantee, changed the CTA to “Explore my options,” and added APR, the rate range, and eligibility terms. Please verify the revised copy and disclosure together.",
    findings: checkCreative(original).map((finding) => ({
      ...finding,
      status: "open",
      reason: `Flagged on v1: ${finding.reason} The marketer has revised the copy. Verify the current version before resolving.`,
    })),
  });
  returning.events.push(
    {
      id: "CP-1042-requested",
      at: date(-24),
      actor: "Alex Morgan",
      message:
        "Requested changes on v1: remove guaranteed approval and identify the APR with relevant terms.",
    },
    {
      id: "CP-1042-revised",
      at: date(-1),
      actor: "Maya Chen",
      message:
        "Submitted v2. Removed the guarantee and added APR and eligibility terms. Two findings await reviewer verification.",
    },
  );
  const loans = build(
    "CP-1047",
    "Your next chapter starts here",
    "Personal loans",
    "Email",
    "ClearPath direct",
    "Jordan Lee",
    6,
    {
      headline: "Your next chapter starts here",
      body: "A home project. A fresh start. Explore a fixed-rate personal loan built around your plans.",
      cta: "See loan options",
      disclosure: loanDisclosure,
    },
  );
  const card = build(
    "CP-1046",
    "A little back on the everyday",
    "Credit cards",
    "Paid social",
    "WalletWise",
    "Sam Rivera",
    24,
    {
      headline: "A little back on the everyday",
      body: "Earn 1.5% cash back on eligible purchases with the ClearPath Everyday Card.",
      cta: "Explore the card",
      disclosure:
        "Illustrative offer. 1.5% cash back on eligible net purchases. $0 annual fee. Variable purchase APR 19.99%–29.99%, based on creditworthiness. Subject to credit approval. See full card terms.",
    },
  );
  const mortgage = build(
    "CP-1045",
    "Picture your next place",
    "Mortgage",
    "Affiliate landing page",
    "HomeHarbor",
    "Priya Shah",
    30,
    {
      headline: "Picture your next place",
      body: "Explore what could be possible with mortgage prequalification from ClearPath.",
      cta: "Start prequalification",
      disclosure:
        "Illustrative offer. Prequalification is an estimate based on information you provide, not a commitment to lend. Final approval requires a complete application, verification, and property review. Equal Housing Lender.",
    },
  );
  const waiting = build(
    "CP-1041",
    "Make space for something new",
    "Personal loans",
    "Affiliate landing page",
    "BrightNest",
    "Maya Chen",
    -2,
    {
      headline: "Make space for something new",
      body: "Get guaranteed approval for a personal loan and put your plans in motion.",
      cta: "Apply today",
      disclosure: loanDisclosure,
    },
  );
  waiting.status = "changes_requested";
  waiting.events.push({
    id: "CP-1041-requested",
    at: date(-20),
    actor: "Alex Morgan",
    message:
      "Requested changes on v1: remove the unconditional approval promise and describe eligibility accurately.",
  });
  const approvedCard = build(
    "CP-1039",
    "Meet your everyday card",
    "Credit cards",
    "Email",
    "ClearPath direct",
    "Sam Rivera",
    -24,
    {
      ...card.versions[0].creative,
      headline: "Meet your everyday card",
      body: "Make everyday purchases a little more rewarding. Explore the ClearPath Everyday Card.",
    },
  );
  const approvedMortgage = build(
    "CP-1038",
    "Start with a clearer picture",
    "Mortgage",
    "Paid social",
    "HomeHarbor",
    "Priya Shah",
    -30,
    {
      ...mortgage.versions[0].creative,
      headline: "Start with a clearer picture",
    },
  );
  for (const review of [approvedCard, approvedMortgage]) {
    review.status = "approved";
    review.approval = {
      version: 1,
      at: date(-26),
      by: "Alex Morgan",
      scope: approvalScope(review),
    };
    review.events.push({
      id: `${review.id}-approved`,
      at: date(-26),
      actor: "Alex Morgan",
      message: `Approved v1 for ${review.approval.scope}. Full creative and intended use reviewed.`,
    });
  }
  return [
    returning,
    loans,
    card,
    mortgage,
    waiting,
    approvedCard,
    approvedMortgage,
  ];
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const timestamp = (value: unknown) =>
  nonempty(value) && Number.isFinite(Date.parse(value));
const unique = (values: string[]) => new Set(values).size === values.length;

function validFinding(value: unknown): value is Finding {
  return (
    object(value) &&
    ["id", "title", "policyId", "reason", "suggestion"].every((key) =>
      nonempty(value[key]),
    ) &&
    fields.includes(value.field as keyof Creative) &&
    findingStatuses.includes(value.status as string) &&
    (value.note === undefined || typeof value.note === "string") &&
    (value.status !== "dismissed" || nonempty(value.note))
  );
}

function validVersion(value: unknown, index: number): value is Version {
  if (
    !object(value) ||
    value.number !== index + 1 ||
    !timestamp(value.submittedAt) ||
    !nonempty(value.submittedBy) ||
    typeof value.response !== "string" ||
    (index > 0 && !nonempty(value.response))
  )
    return false;
  if (
    !object(value.creative) ||
    !fields.every((field) =>
      field === "disclosure"
        ? typeof (value.creative as Record<string, unknown>)[field] === "string"
        : nonempty((value.creative as Record<string, unknown>)[field]),
    )
  )
    return false;
  return (
    Array.isArray(value.findings) &&
    value.findings.every(validFinding) &&
    unique(value.findings.map((finding) => finding.id))
  );
}

function validReview(value: unknown): value is Review {
  if (
    !object(value) ||
    ![
      "id",
      "title",
      "channel",
      "placement",
      "audience",
      "partner",
      "owner",
      "initials",
    ].every((key) => nonempty(value[key]))
  )
    return false;
  if (
    !products.includes(value.product as string) ||
    !timestamp(value.due) ||
    !["ready", "changes_requested", "approved"].includes(value.status as string)
  )
    return false;
  if (
    !Array.isArray(value.versions) ||
    value.versions.length === 0 ||
    !value.versions.every(validVersion)
  )
    return false;
  if (
    !Array.isArray(value.events) ||
    !value.events.length ||
    !value.events.every(
      (event) =>
        object(event) &&
        nonempty(event.id) &&
        timestamp(event.at) &&
        nonempty(event.actor) &&
        nonempty(event.message),
    )
  )
    return false;
  const latest = value.versions.at(-1) as Version;
  if (
    value.status === "changes_requested" &&
    !latest.findings.some((finding) => finding.status === "open")
  )
    return false;
  if (value.status === "approved") {
    const approval = value.approval;
    return (
      object(approval) &&
      approval.version === latest.number &&
      timestamp(approval.at) &&
      nonempty(approval.by) &&
      approval.scope === approvalScope(value as Review) &&
      fields.every((field) => nonempty(latest.creative[field])) &&
      latest.findings.every((finding) => finding.status !== "open")
    );
  }
  return value.approval === undefined;
}

function validReviews(value: unknown): value is Review[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(validReview) &&
    unique(value.map((review) => review.id))
  );
}

function parseReviews(raw: string): Review[] | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return validReviews(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function preserveRecovery(raw: string): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    const existing = storage.getItem(recoveryKey);
    if (existing !== null) return existing === raw;
    storage.setItem(recoveryKey, raw);
    return storage.getItem(recoveryKey) === raw;
  } catch {
    return false;
  }
}

/** Returns the original bytes for download; it does not try to repair or execute them. */
export function readRecovery(): string | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const saved = storage.getItem(storageKey);
    if (saved !== null && !parseReviews(saved)) return saved;
    return storage.getItem(recoveryKey);
  } catch {
    return null;
  }
}

export function storageRecoveryNotice(): string | null {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return null;
    const saved = storage.getItem(storageKey);
    const recovery = storage.getItem(recoveryKey);
    if (saved !== null && !parseReviews(saved)) {
      return recovery === saved
        ? "Saved reviews could not be read. Demo data is shown, and the original data is preserved in a recovery copy."
        : "Saved reviews could not be read. Demo data is shown. The original data is untouched, and saving is paused because a recovery copy could not be secured.";
    }
    return recovery !== null
      ? "An earlier saved review could not be read. Its original data is preserved in a recovery copy you can download."
      : null;
  } catch {
    return null;
  }
}

export function loadReviews(): Review[] {
  try {
    const saved = globalThis.localStorage?.getItem(storageKey);
    if (saved !== undefined && saved !== null) {
      const parsed = parseReviews(saved);
      if (parsed) return parsed;
      preserveRecovery(saved);
    }
  } catch {
    /* Unavailable browser storage: show demo data for this session. */
  }
  return makeSeed();
}

export function saveReviews(reviews: Review[]): boolean {
  try {
    const storage = globalThis.localStorage;
    if (!validReviews(reviews) || !storage) return false;
    const saved = storage.getItem(storageKey);
    if (saved !== null && !parseReviews(saved) && !preserveRecovery(saved))
      return false;
    storage.setItem(storageKey, JSON.stringify(reviews));
    return true;
  } catch {
    return false;
  }
}

export function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
