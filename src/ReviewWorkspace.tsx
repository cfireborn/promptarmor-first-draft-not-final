import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  CircleCheck,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  Flag,
  History,
  MessageSquare,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  addFinding,
  approveReview,
  canVerifyFix,
  current,
  policies,
  requestChanges,
  updateFinding,
  type Creative,
  type Finding,
  type Review,
} from "./model";
import { closeAllowed, dateLabel, Modal, Status } from "./ui";
import Submission from "./Submission";

const fieldNames: Record<keyof Creative, string> = {
  headline: "Headline",
  body: "Body copy",
  cta: "Call to action",
  disclosure: "Disclosure",
};
const fields = Object.keys(fieldNames) as (keyof Creative)[];
export default function ReviewWorkspace({
  review,
  onUpdate,
  onBack,
  onNext,
  notify,
}: {
  review: Review;
  onUpdate: (review: Review, message?: string) => void;
  onBack: () => void;
  onNext: () => void;
  notify: (text: string) => void;
}) {
  const version = current(review),
    previous = review.versions.at(-2);
  const [tab, setTab] = useState<"creative" | "changes" | "history">(
    previous ? "changes" : "creative",
  );
  const [active, setActive] = useState<keyof Creative | null>(null);
  const [modal, setModal] = useState<
    | "request"
    | "approve"
    | "revision"
    | "add"
    | "policy"
    | "dismiss"
    | "resolve"
    | null
  >(null);
  const [findingId, setFindingId] = useState("");
  const [note, setNote] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [error, setError] = useState("");
  const [attested, setAttested] = useState(false);
  const [newFinding, setNewFinding] = useState({
    title: "",
    field: "body" as keyof Creative,
    reason: "",
    suggestion: "",
  });
  const [contextOpen, setContextOpen] = useState(true);
  const openFindings = version.findings.filter((f) => f.status === "open");
  const changed = previous
    ? fields.filter(
        (field) => version.creative[field] !== previous.creative[field],
      )
    : [];
  const policy = policies.find((p) => p.id === policyId);
  const finish = () => {
    setModal(null);
    setError("");
    setNote("");
    setAttested(false);
  };
  const close = () => {
    if (closeAllowed()) finish();
  };
  const run = (action: () => Review, message: string) => {
    try {
      onUpdate(action(), message);
      setError("");
      finish();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  const mark = (finding: Finding, status: Finding["status"]) =>
    run(
      () => updateFinding(review, finding.id, status),
      status === "open" ? "Finding reopened." : "Finding verified.",
    );
  const exportRecord = () => {
    const lines = [
      "CLEARPATH REVIEW — DEMO DECISION RECORD",
      "Fictional content. Local prototype history; not an authenticated compliance record.",
      "Scope: copy review only. Final rendered placement, offer accuracy, and legal compliance require separate verification.",
      "",
      `${review.id} · ${review.title}`,
      `Status: ${review.status}`,
      `Version: ${version.number}`,
      `Owner: ${review.owner}`,
      `Product: ${review.product}`,
      `Channel: ${review.channel}`,
      `Placement: ${review.placement}`,
      `Audience: ${review.audience}`,
      `Partner: ${review.partner}`,
      "",
      ...(review.approval
        ? [
            `Approved by: ${review.approval.by}`,
            `Approved at: ${review.approval.at}`,
            `Approved scope: ${review.approval.scope}`,
          ]
        : ["Not approved."]),
      "",
      ...review.versions.flatMap((v) => [
        `VERSION ${v.number}`,
        `Submitted: ${v.submittedAt} by ${v.submittedBy}`,
        `Response: ${v.response || "Initial submission"}`,
        ...fields.map((f) => `${fieldNames[f]}: ${v.creative[f]}`),
        "FINDINGS",
        ...v.findings.flatMap((f) => [
          `${f.title} — ${f.status} (${f.policyId}, ${fieldNames[f.field]})`,
          `Reason: ${f.reason}`,
          `Requested fix: ${f.suggestion}`,
          `Reviewer note: ${f.note || "None"}`,
        ]),
        "",
      ]),
      "HISTORY",
      ...review.events.map((e) => `${e.at} · ${e.actor}: ${e.message}`),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${review.id}-v${version.number}-review-record.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Review record downloaded.");
  };
  return (
    <div className="review-page">
      <div className="review-breadcrumb">
        <button onClick={onBack}>
          <ArrowLeft size={15} />
          Review queue
        </button>
        <span>/</span>
        <span>{review.id}</span>
        <span className="review-save">
          <Check size={13} />
          Version history retained
        </span>
      </div>
      <div className="review-heading">
        <div>
          <div className="review-heading-meta">
            <span className="eyebrow">{review.id}</span>
            <Status review={review} />
          </div>
          <h1>{review.title}</h1>
          <p>
            {review.partner}
            <span>·</span>
            {review.product}
            <span>·</span>
            {review.channel}
          </p>
        </div>
        <div className="review-heading-actions">
          <button className="btn" onClick={exportRecord}>
            <Download size={15} />
            Export record
          </button>
          <span className="version-pill">
            Version {version.number}
            <span>Current</span>
          </span>
        </div>
      </div>
      {review.status === "approved" ? (
        <div className="approval-banner">
          <span className="approval-seal">
            <ShieldCheck size={26} />
          </span>
          <div>
            <strong>
              Copy version {version.number} is approved for its stated use.
            </strong>
            <p>
              {review.approval?.by} · {dateLabel(review.approval!.at)} · Any
              creative or placement change needs a new review.
            </p>
          </div>
          <button className="btn" onClick={onNext}>
            Next review
            <ArrowRight size={16} />
          </button>
        </div>
      ) : review.status === "changes_requested" ? (
        <div className="handoff-banner">
          <MessageSquare size={23} />
          <div>
            <strong>The next move is with {review.owner.split(" ")[0]}.</strong>
            <p>
              {openFindings.length}{" "}
              {openFindings.length === 1 ? "finding is" : "findings are"} ready
              to become an actionable revision.
            </p>
          </div>
          <button className="btn primary" onClick={() => setModal("revision")}>
            Prepare revision
            <ArrowRight size={16} />
          </button>
        </div>
      ) : previous ? (
        <div className="revision-banner">
          <span className="revision-badge">
            <History size={19} />
          </span>
          <div>
            <strong>
              Back for review{" "}
              <span>
                · {changed.length} copy{" "}
                {changed.length === 1 ? "section" : "sections"} changed
              </span>
            </strong>
            <p>
              {version.submittedBy} returned v{version.number}. Verify the
              changes in the context of the full creative.
            </p>
          </div>
          <span className="outline-label">
            v{previous.number}
            <ArrowRight size={13} />v{version.number}
          </span>
        </div>
      ) : null}
      <div className="review-grid">
        <section className="creative-column">
          <div className="creative-toolbar">
            <div className="tabs" role="group" aria-label="Creative view">
              <button
                aria-pressed={tab === "creative"}
                onClick={() => setTab("creative")}
                className={tab === "creative" ? "active" : ""}
              >
                <FileText size={15} />
                Creative
              </button>
              {previous && (
                <button
                  aria-pressed={tab === "changes"}
                  onClick={() => setTab("changes")}
                  className={tab === "changes" ? "active" : ""}
                >
                  <History size={15} />
                  What changed<span>{changed.length}</span>
                </button>
              )}
              <button
                aria-pressed={tab === "history"}
                onClick={() => setTab("history")}
                className={tab === "history" ? "active" : ""}
              >
                History
              </button>
            </div>
            <span className="creative-type">{review.channel}</span>
          </div>
          <div className="creative-body">
            {tab === "creative" ? (
              <>
                <div className="preview-caption">
                  <span>Copy preview</span>
                  <span>v{version.number} · Current submission</span>
                </div>
                <article
                  className={`ad-preview ${review.product === "Credit cards" ? "ad-card" : review.product === "Mortgage" ? "ad-home" : ""}`}
                >
                  <div className="ad-brand">
                    <LayersMark />
                    ClearPath<span>FINANCIAL</span>
                  </div>
                  <div className="ad-art" aria-hidden="true">
                    <div />
                    <div />
                    <div />
                  </div>
                  <div className="ad-copy">
                    {(["headline", "body"] as const).map((field) => (
                      <button
                        key={field}
                        className={`ad-field ${field} ${active === field ? "highlighted" : ""}`}
                        onClick={() =>
                          setActive(active === field ? null : field)
                        }
                        aria-label={`Inspect ${fieldNames[field]}: ${version.creative[field]}`}
                      >
                        <span>{version.creative[field]}</span>
                        {version.findings.some((f) => f.field === field) && (
                          <span className="annotation-pin">
                            {version.findings.findIndex(
                              (f) => f.field === field,
                            ) + 1}
                          </span>
                        )}
                      </button>
                    ))}
                    <button
                      className={`ad-cta ad-field ${active === "cta" ? "highlighted" : ""}`}
                      onClick={() => setActive(active === "cta" ? null : "cta")}
                      aria-label={`Inspect call to action: ${version.creative.cta}`}
                    >
                      {version.creative.cta}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  <button
                    className={`ad-disclosure ad-field ${active === "disclosure" ? "highlighted" : ""}`}
                    onClick={() =>
                      setActive(active === "disclosure" ? null : "disclosure")
                    }
                    aria-label={`Inspect disclosure: ${version.creative.disclosure}`}
                  >
                    {version.creative.disclosure}
                  </button>
                </article>
                <p className="preview-footnote">
                  Illustrative layout. Review the copy here; final placement
                  fidelity requires a rendered asset.
                </p>
              </>
            ) : tab === "changes" && previous ? (
              <>
                <div className="diff-legend">
                  <span>
                    <i className="removed-dot" />
                    Previous · v{previous.number}
                  </span>
                  <span>
                    <i className="added-dot" />
                    Current · v{version.number}
                  </span>
                </div>
                <div className="response-note">
                  <span className="avatar small">{review.initials}</span>
                  <div>
                    <strong>
                      {version.submittedBy}
                      <span>What I changed</span>
                    </strong>
                    <p>{version.response}</p>
                  </div>
                </div>
                <div className="diff-fields">
                  {fields.map((field) => (
                    <article
                      key={field}
                      className={`diff-field ${active === field ? "focused" : ""}`}
                    >
                      <button
                        className="diff-field-title"
                        onClick={() =>
                          setActive(active === field ? null : field)
                        }
                      >
                        <span>{fieldNames[field]}</span>
                        {changed.includes(field) ? (
                          <span className="changed-label">Changed</span>
                        ) : (
                          <span className="unchanged-label">Unchanged</span>
                        )}
                      </button>
                      {changed.includes(field) ? (
                        <div className="diff-pair">
                          <div className="removed">
                            <span aria-label="Removed">−</span>
                            <p>{previous.creative[field]}</p>
                          </div>
                          <div className="added">
                            <span aria-label="Added">+</span>
                            <p>{version.creative[field]}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="unchanged-text">
                          {version.creative[field]}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                <button
                  className="btn full-creative"
                  onClick={() => setTab("creative")}
                >
                  Inspect the full current creative
                  <ArrowRight size={15} />
                </button>
              </>
            ) : (
              <div className="review-history">
                {[...review.events].reverse().map((event) => (
                  <article key={event.id}>
                    <span className="history-dot" />
                    <small>
                      {dateLabel(event.at)} · {event.actor}
                    </small>
                    <p>{event.message}</p>
                  </article>
                ))}
                <div className="notice compact">
                  <History size={17} />
                  <p>
                    All {review.versions.length} submitted versions are
                    preserved in the exported record.
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="context-panel">
            <button
              className="context-toggle"
              onClick={() => setContextOpen(!contextOpen)}
              aria-expanded={contextOpen}
            >
              <span>
                <FileCheck2 size={17} />
                Intended use & submission context
              </span>
              <ChevronDown size={17} className={contextOpen ? "rotated" : ""} />
            </button>
            {contextOpen && (
              <dl className="context-grid">
                <div>
                  <dt>Product</dt>
                  <dd>{review.product}</dd>
                </div>
                <div>
                  <dt>Channel / placement</dt>
                  <dd>
                    {review.channel} · {review.placement}
                  </dd>
                </div>
                <div>
                  <dt>Audience</dt>
                  <dd>{review.audience}</dd>
                </div>
                <div>
                  <dt>Partner / source</dt>
                  <dd>{review.partner}</dd>
                </div>
                <div>
                  <dt>Submitted by</dt>
                  <dd>{version.submittedBy}</dd>
                </div>
                <div>
                  <dt>Requested launch</dt>
                  <dd>{dateLabel(review.due)}</dd>
                </div>
              </dl>
            )}
          </div>
        </section>
        <aside className="findings-column" aria-label="Review findings">
          <div className="findings-heading">
            <div>
              <span className="eyebrow">YOUR REVIEW</span>
              <h2>
                {review.status === "approved"
                  ? "Decision recorded"
                  : openFindings.length
                    ? `${openFindings.length} ${openFindings.length === 1 ? "finding" : "findings"} to resolve`
                    : "Ready for your decision"}
              </h2>
            </div>
            <span className="review-progress">
              {version.findings.length - openFindings.length}/
              {version.findings.length}
            </span>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${version.findings.length ? ((version.findings.length - openFindings.length) / version.findings.length) * 100 : 100}%`,
              }}
            />
          </div>
          <p className="findings-intro">
            {previous
              ? "The marketer has responded. You decide whether each finding is addressed."
              : "Illustrative checks are a starting point. Review the full creative and add anything they missed."}
          </p>
          <div className="finding-list">
            {version.findings.map((finding, index) => (
              <article
                className={`finding-card ${finding.status !== "open" ? "resolved" : ""} ${active === finding.field ? "focused" : ""}`}
                key={finding.id}
              >
                <div className="finding-top">
                  <button
                    className="finding-number"
                    aria-label={`Highlight finding ${index + 1} in ${fieldNames[finding.field]}`}
                    onClick={() => {
                      setActive(finding.field);
                      if (tab === "history") setTab("creative");
                    }}
                  >
                    {finding.status === "open" ? (
                      index + 1
                    ) : (
                      <Check size={14} />
                    )}
                  </button>
                  <span className="finding-field">
                    {fieldNames[finding.field]}
                  </span>
                  <span className={`finding-status ${finding.status}`}>
                    {finding.status === "verified"
                      ? "Verified"
                      : finding.status === "dismissed"
                        ? "Dismissed"
                        : previous
                          ? "Needs verification"
                          : "Needs review"}
                  </span>
                </div>
                <h3>{finding.title}</h3>
                <p className="concern-label">
                  {previous?.findings.some((f) => f.id === finding.id)
                    ? `Concern carried from v${previous.number}`
                    : "Current review concern"}
                </p>
                <p>{finding.reason}</p>
                {finding.status === "open" ? (
                  <>
                    <div className="requested-fix">
                      <strong>Requested change</strong>
                      <p>{finding.suggestion}</p>
                    </div>
                    {finding.policyId !== "Reviewer" && (
                      <button
                        className="policy-link"
                        onClick={() => {
                          setPolicyId(finding.policyId);
                          setModal("policy");
                        }}
                      >
                        <BookIcon />
                        {finding.policyId} · View policy
                        <ArrowRight size={12} />
                      </button>
                    )}
                    {review.status === "ready" && (
                      <div className="finding-actions">
                        <button
                          className="btn verify"
                          onClick={() => {
                            if (canVerifyFix(review, finding))
                              mark(finding, "verified");
                            else {
                              setFindingId(finding.id);
                              setModal("resolve");
                            }
                          }}
                        >
                          <Check size={14} />
                          {canVerifyFix(review, finding)
                            ? "Verify fix"
                            : "Resolve with note"}
                        </button>
                        <button
                          className="text-btn"
                          onClick={() => {
                            setFindingId(finding.id);
                            setModal("dismiss");
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="finding-resolution">
                    <p>{finding.note || "Reviewed and verified by you."}</p>
                    {review.status === "ready" && (
                      <button onClick={() => mark(finding, "open")}>
                        Reopen
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
          {!version.findings.length && (
            <div className="no-findings">
              <CircleCheck size={26} />
              <strong>No matches in the demo checks</strong>
              <p>
                This is not a compliance decision. Check the claims,
                disclosures, and intended use, then record your judgment.
              </p>
            </div>
          )}
          {review.status === "ready" && (
            <button className="add-finding" onClick={() => setModal("add")}>
              <Plus size={15} />
              Add a reviewer finding
            </button>
          )}
          <div className="decision-panel">
            {review.status === "ready" ? (
              <>
                <div className="decision-context">
                  <ShieldCheck size={17} />
                  <p>
                    {openFindings.length
                      ? `Resolve ${openFindings.length} ${openFindings.length === 1 ? "finding" : "findings"} before approval.`
                      : "Findings are resolved. Review the full creative and intended use before approving."}
                  </p>
                </div>
                <button
                  className="btn primary approve-btn"
                  disabled={!!openFindings.length}
                  onClick={() => setModal("approve")}
                >
                  <ShieldCheck size={16} />
                  Approve version {version.number}
                </button>
                <button
                  className="btn request-btn"
                  disabled={!openFindings.length}
                  onClick={() => {
                    setNote(
                      `Please address the ${openFindings.length} open ${openFindings.length === 1 ? "finding" : "findings"} below and describe your changes when resubmitting.`,
                    );
                    setModal("request");
                  }}
                >
                  <MessageSquare size={15} />
                  Request changes
                </button>
              </>
            ) : review.status === "approved" ? (
              <>
                <FileCheck2 size={26} />
                <strong>Copy review complete.</strong>
                <p>
                  Copy approval applies to v{version.number}. Final rendered
                  placement still needs verification.
                </p>
                <button className="btn" onClick={exportRecord}>
                  <Download size={15} />
                  Download approval record
                </button>
              </>
            ) : (
              <>
                <Clock3 size={24} />
                <strong>Waiting for a revision</strong>
                <p>
                  Try the marketer side of this demo to complete the handoff.
                </p>
                <button
                  className="btn primary"
                  onClick={() => setModal("revision")}
                >
                  Prepare revision
                  <ArrowRight size={15} />
                </button>
              </>
            )}
          </div>
          <p className="assistance-note">
            <ShieldCheck size={12} />
            Human judgment. A clear record.
          </p>
        </aside>
      </div>
      {modal === "revision" && (
        <Modal
          title={`Prepare version ${version.number + 1}`}
          wide
          protectEdits
          close={close}
        >
          <Submission
            review={review}
            onCancel={close}
            onSave={(r) => {
              onUpdate(
                r,
                "Revision submitted. Findings await your verification.",
              );
              setTab("changes");
              setActive(null);
              finish();
            }}
          />
        </Modal>
      )}
      {modal === "policy" && (
        <Modal title={policy?.title || "Reviewer finding"} close={close}>
          <div className="modal-body">
            <span className="outline-label">
              {policy?.id} · Illustrative internal policy
            </span>
            <p>{policy?.body}</p>
            <div className="notice compact">
              <ShieldCheck size={17} />
              <p>
                Apply judgment to the complete creative, offer, and placement.
                This demo policy is not a legal determination.
              </p>
            </div>
            <button className="btn primary" onClick={close}>
              Back to review
            </button>
          </div>
        </Modal>
      )}
      {modal === "dismiss" && (
        <Modal title="Dismiss this finding" protectEdits close={close}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => updateFinding(review, findingId, "dismissed", note),
                "Finding dismissed with your rationale.",
              );
            }}
          >
            <p>
              Explain why this finding doesn’t apply. Your rationale stays with
              this version.
            </p>
            <label className="field">
              Reason for dismissal
              <textarea
                autoFocus
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: this rate refers to rewards, not borrowing costs."
                rows={4}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={close}>
                Cancel
              </button>
              <button className="btn primary" type="submit">
                Dismiss with reason
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "resolve" && (
        <Modal title="Record your review rationale" protectEdits close={close}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => updateFinding(review, findingId, "verified", note),
                "Finding resolved with your rationale.",
              );
            }}
          >
            <p>
              This finding has no verified copy fix. Explain the evidence or
              judgment that addresses the concern; reading it alone does not
              resolve it.
            </p>
            <label className="field">
              Review rationale
              <textarea
                required
                autoFocus
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button className="btn" type="button" onClick={close}>
                Keep open
              </button>
              <button className="btn primary" type="submit">
                Resolve with rationale
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "request" && (
        <Modal
          title={`Request changes to version ${version.number}`}
          protectEdits
          close={close}
        >
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              run(
                () => requestChanges(review, note),
                `Changes requested. Next step: ${review.owner}.`,
              );
            }}
          >
            <p>{review.owner} will get a clear checklist in this workspace.</p>
            <ul className="request-checklist">
              {openFindings.map((f) => (
                <li key={f.id}>
                  <Flag size={15} />
                  <div>
                    <strong>{f.title}</strong>
                    <p>{f.suggestion}</p>
                  </div>
                </li>
              ))}
            </ul>
            <label className="field">
              Note to the marketer
              <textarea
                required
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className="muted small-text">
              Demo handoff only. No email or external message is sent.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={close}>
                Keep reviewing
              </button>
              <button className="btn primary" type="submit">
                Request changes
                <ArrowRight size={15} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "approve" && (
        <Modal title={`Approve version ${version.number}`} close={close}>
          <div className="modal-body">
            <div className="approval-summary">
              <span className="approval-seal">
                <FileCheck2 size={27} />
              </span>
              <h3>{review.title}</h3>
              <p>
                {review.id} · Version {version.number}
              </p>
            </div>
            <dl className="approval-scope">
              <div>
                <dt>Product</dt>
                <dd>{review.product}</dd>
              </div>
              <div>
                <dt>Placement</dt>
                <dd>
                  {review.channel} · {review.placement}
                </dd>
              </div>
              <div>
                <dt>Audience</dt>
                <dd>{review.audience}</dd>
              </div>
              <div>
                <dt>Partner</dt>
                <dd>{review.partner}</dd>
              </div>
            </dl>
            <div className="notice compact">
              <FileText size={17} />
              <p>
                This approves the submitted copy. Final rendered placement,
                offer accuracy, and legal compliance need separate verification.
              </p>
            </div>
            <label className="attestation">
              <input
                type="checkbox"
                checked={attested}
                onChange={(e) => setAttested(e.target.checked)}
              />
              <span>
                I reviewed the full copy, disclosures, and intended use. I
                approve this exact copy version for the scope above.
              </span>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                className="btn"
                onClick={() => {
                  close();
                  setTab("creative");
                }}
              >
                Inspect creative
              </button>
              <button
                className="btn primary"
                disabled={!attested}
                onClick={() =>
                  run(
                    () => approveReview(review, attested),
                    `Version ${version.number} approved. Decision recorded.`,
                  )
                }
              >
                <CheckCheck size={16} />
                Confirm approval
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === "add" && (
        <Modal title="Add a reviewer finding" protectEdits close={close}>
          <form
            className="modal-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (
                run(
                  () => addFinding(review, newFinding),
                  "Reviewer finding added.",
                )
              )
                setNewFinding({
                  title: "",
                  field: "body",
                  reason: "",
                  suggestion: "",
                });
            }}
          >
            <p>Give the marketer enough context to fix this in one pass.</p>
            <label className="field">
              Finding title
              <input
                required
                value={newFinding.title}
                onChange={(e) =>
                  setNewFinding({ ...newFinding, title: e.target.value })
                }
                placeholder="What needs attention?"
              />
            </label>
            <label className="field">
              Creative section
              <select
                value={newFinding.field}
                onChange={(e) =>
                  setNewFinding({
                    ...newFinding,
                    field: e.target.value as keyof Creative,
                  })
                }
              >
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {fieldNames[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Why it matters
              <textarea
                required
                rows={2}
                value={newFinding.reason}
                onChange={(e) =>
                  setNewFinding({ ...newFinding, reason: e.target.value })
                }
              />
            </label>
            <label className="field">
              Requested change
              <textarea
                required
                rows={2}
                value={newFinding.suggestion}
                onChange={(e) =>
                  setNewFinding({ ...newFinding, suggestion: e.target.value })
                }
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button className="btn" type="button" onClick={close}>
                Cancel
              </button>
              <button className="btn primary" type="submit">
                Add finding
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
function LayersMark() {
  return (
    <span className="mini-brand" aria-hidden="true">
      ↗
    </span>
  );
}
function BookIcon() {
  return <FileText size={13} />;
}
