import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, ArrowRight, ClipboardList, FileText } from 'lucide-react';
import { checkCreative, createReview, current, formatTimestamp, submitRevision } from './model';
import type { Creative, Review } from './model';
import './submission.css';

type Props = { review?: Review; onSave: (review: Review) => void; onCancel: () => void };
type Context = { title: string; product: Review['product']; channel: string; placement: string; audience: string; partner: string; owner: string; due: string };

function localDateTime(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const example = {
  context: {
    title: 'Make room for your next chapter', product: 'Personal loans' as const, channel: 'Paid social',
    placement: 'Instagram feed · mobile', audience: 'US adults 18+ · prospecting', partner: 'BrightNest', owner: 'Maya Chen',
  },
  creative: {
    headline: 'Make room for your next chapter',
    body: 'A home project. A fresh start. Explore a fixed-rate personal loan from ClearPath, subject to credit approval.',
    cta: 'Explore loan options',
    disclosure: 'Fictional example offer. Personal loans from $2,000–$35,000. APRs range from 9.99%–29.99%; terms of 24–60 months. Your rate depends on creditworthiness. Approval and terms are subject to eligibility and credit review.',
  },
};

export default function Submission({ review, onSave, onCancel }: Props) {
  const initialVersion = review ? current(review) : undefined;
  const [step, setStep] = useState<'context' | 'creative'>(review ? 'creative' : 'context');
  const [context, setContext] = useState<Context>(() => review ? {
    title: review.title, product: review.product, channel: review.channel, placement: review.placement,
    audience: review.audience, partner: review.partner, owner: review.owner, due: localDateTime(new Date(review.due)),
  } : { title: '', product: 'Personal loans', channel: 'Paid social', placement: '', audience: '', partner: 'ClearPath direct', owner: '', due: '' });
  const [creative, setCreative] = useState<Creative>(() => initialVersion ? { ...initialVersion.creative } : { headline: '', body: '', cta: '', disclosure: '' });
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const firstContext = useRef<HTMLInputElement>(null);
  const firstCreative = useRef<HTMLInputElement>(null);
  const id = useId();
  const findings = checkCreative(creative);
  const hasDraft = Object.values(creative).some((value) => value.trim());
  const openFindings = initialVersion?.findings.filter((finding) => finding.status === 'open') ?? [];
  const reviewerNote = review?.events.slice().reverse().find((event) => event.message.startsWith('Requested changes'))?.message.replace(/^Requested changes on v\d+:\s*/, '');

  function setContextField(field: keyof Context, value: string) {
    setContext((previous) => ({ ...previous, [field]: value }));
    setError('');
    setNotice('');
  }

  function setCreativeField(field: keyof Creative, value: string) {
    setCreative((previous) => ({ ...previous, [field]: value }));
    setError('');
    setNotice('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (step === 'context') {
      const missing = Object.values(context).some((value) => !value.trim());
      if (missing) { setError('Complete every context field before continuing.'); return; }
      if (!Number.isFinite(new Date(context.due).getTime())) { setError('Choose a valid requested launch date and time.'); return; }
      setStep('creative');
      setNotice('');
      requestAnimationFrame(() => firstCreative.current?.focus());
      return;
    }
    try {
      const result = review ? submitRevision(review, creative, response) : createReview({ ...context, due: new Date(context.due).toISOString(), creative });
      onSave(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This submission could not be saved. Please try again.');
    }
  }

  function useExample() {
    setContext({ ...example.context, due: localDateTime(new Date(Date.now() + 48 * 60 * 60 * 1000)) });
    setCreative({ ...example.creative });
    setError('');
    setNotice('Fictional example filled in. Review the details before submitting.');
  }

  function goBack() {
    setStep('context');
    setError('');
    requestAnimationFrame(() => firstContext.current?.focus());
  }

  return <div className="submission">
    <header className="submission-heading">
      <div>
        <span className="eyebrow">{review ? `${review.id} · Marketer view` : 'Marketing intake'}</span>
        <h2>{review ? `Submit version ${initialVersion!.number + 1}` : 'Bring a campaign to review'}</h2>
        <p className="muted">{review ? 'Show what changed. Your reviewer will verify the new version.' : 'Give your reviewer the creative and the context in one place.'}</p>
      </div>
      {!review && <button type="button" className="btn submission-example" onClick={useExample}><FileText size={16} aria-hidden="true" />Use example</button>}
    </header>

    {!review && <ol className="submission-steps" aria-label="Submission progress">
      <li className={step === 'context' ? 'active' : 'complete'} aria-current={step === 'context' ? 'step' : undefined}><span>1</span> Context</li>
      <li className={step === 'creative' ? 'active' : ''} aria-current={step === 'creative' ? 'step' : undefined}><span>2</span> Creative</li>
    </ol>}

    {notice && <p className="submission-notice" role="status">{notice}</p>}

    <form onSubmit={handleSubmit} className="submission-form">
      {step === 'context' ? <div className="submission-context">
        <label className="field submission-full" htmlFor={`${id}-title`}>Campaign name
          <input ref={firstContext} id={`${id}-title`} value={context.title} onChange={(event) => setContextField('title', event.target.value)} required autoFocus />
        </label>
        <label className="field" htmlFor={`${id}-product`}>Product
          <select id={`${id}-product`} value={context.product} onChange={(event) => setContextField('product', event.target.value)} required>
            <option>Personal loans</option><option>Credit cards</option><option>Mortgage</option>
          </select>
        </label>
        <label className="field" htmlFor={`${id}-channel`}>Channel
          <select id={`${id}-channel`} value={context.channel} onChange={(event) => setContextField('channel', event.target.value)} required>
            <option>Paid social</option><option>Email</option><option>Affiliate landing page</option><option>Display advertising</option>
          </select>
        </label>
        <label className="field" htmlFor={`${id}-partner`}>Publishing partner
          <input id={`${id}-partner`} value={context.partner} onChange={(event) => setContextField('partner', event.target.value)} required aria-describedby={`${id}-partner-hint`} />
          <span className="submission-hint" id={`${id}-partner-hint`}>Name the affiliate or use ClearPath direct.</span>
        </label>
        <label className="field" htmlFor={`${id}-owner`}>Campaign owner
          <input id={`${id}-owner`} value={context.owner} onChange={(event) => setContextField('owner', event.target.value)} required aria-describedby={`${id}-owner-hint`} />
          <span className="submission-hint" id={`${id}-owner-hint`}>Use a fictional name in this demo.</span>
        </label>
        <label className="field submission-full" htmlFor={`${id}-placement`}>Placement and format
          <input id={`${id}-placement`} value={context.placement} onChange={(event) => setContextField('placement', event.target.value)} required aria-describedby={`${id}-placement-hint`} />
          <span className="submission-hint" id={`${id}-placement-hint`}>Include where it appears and the device or format.</span>
        </label>
        <label className="field submission-full" htmlFor={`${id}-audience`}>Intended audience
          <input id={`${id}-audience`} value={context.audience} onChange={(event) => setContextField('audience', event.target.value)} required aria-describedby={`${id}-audience-hint`} />
          <span className="submission-hint" id={`${id}-audience-hint`}>Include geography, age range, and targeting restrictions.</span>
        </label>
        <label className="field submission-full" htmlFor={`${id}-due`}>Requested launch
          <input id={`${id}-due`} type="datetime-local" value={context.due} onChange={(event) => setContextField('due', event.target.value)} required aria-describedby={`${id}-due-hint`} />
          <span className="submission-hint" id={`${id}-due-hint`}>Your local date and time. This helps reviewers prioritize; it does not guarantee approval by launch.</span>
        </label>
      </div> : <>
        <div className="submission-scope">
          <strong>{context.title}</strong>
          <dl>
            <div><dt>Product</dt><dd>{context.product}</dd></div>
            <div><dt>Partner</dt><dd>{context.partner}</dd></div>
            <div><dt>Channel</dt><dd>{context.channel}</dd></div>
            <div><dt>Owner</dt><dd>{context.owner}</dd></div>
            <div className="submission-full"><dt>Placement</dt><dd>{context.placement}</dd></div>
            <div className="submission-full"><dt>Audience</dt><dd>{context.audience}</dd></div>
            <div className="submission-full"><dt>Launch</dt><dd>{formatTimestamp(review?.due ?? new Date(context.due).toISOString())} · local time</dd></div>
          </dl>
        </div>

        {review && <aside className="submission-revision" aria-labelledby={`${id}-requested`}>
          <h3 id={`${id}-requested`}><ClipboardList size={17} aria-hidden="true" /> Changes to address</h3>
          {reviewerNote && <blockquote>{reviewerNote}</blockquote>}
          <ul>{openFindings.map((finding) => <li key={finding.id}>
            <strong>{finding.title}</strong><span>{finding.suggestion}</span>
          </li>)}</ul>
          <p className="submission-hint">These findings stay open until a reviewer verifies or dismisses them.</p>
        </aside>}

        <div className="submission-creative">
          <label className="field" htmlFor={`${id}-headline`}>Headline
            <input ref={firstCreative} id={`${id}-headline`} value={creative.headline} onChange={(event) => setCreativeField('headline', event.target.value)} required autoFocus={!!review} />
          </label>
          <label className="field" htmlFor={`${id}-body`}>Body copy
            <textarea id={`${id}-body`} value={creative.body} onChange={(event) => setCreativeField('body', event.target.value)} rows={3} required />
          </label>
          <label className="field" htmlFor={`${id}-cta`}>Call to action
            <input id={`${id}-cta`} value={creative.cta} onChange={(event) => setCreativeField('cta', event.target.value)} required />
          </label>
          <label className="field" htmlFor={`${id}-disclosure`}>Disclosure
            <textarea id={`${id}-disclosure`} value={creative.disclosure} onChange={(event) => setCreativeField('disclosure', event.target.value)} rows={4} required aria-describedby={`${id}-disclosure-hint`} />
            <span className="submission-hint" id={`${id}-disclosure-hint`}>Include the qualifications and offer terms shown with this creative.</span>
          </label>
        </div>

        <aside className="submission-checks" aria-labelledby={`${id}-checks`}>
          <h3 id={`${id}-checks`}>Illustrative text checks</h3>
          <div aria-live="polite">
            {!hasDraft ? <p>Start drafting to preview a few narrow text checks.</p> : findings.length ? <>
              <p>{findings.length} potential {findings.length === 1 ? 'issue' : 'issues'} for your reviewer.</p>
              <ul>{findings.map((finding) => <li key={finding.id}>{finding.title}</li>)}</ul>
            </> : <p>No matches for the three illustrative text patterns.</p>}
          </div>
          <p className="submission-hint">Only a few approval claims, rate references, and missing disclosures are checked. A person must review the full offer and intended use.</p>
        </aside>

        {review && <label className="field submission-response" htmlFor={`${id}-response`}>What changed for your reviewer?
          <textarea id={`${id}-response`} value={response} onChange={(event) => { setResponse(event.target.value); setError(''); }} rows={3} required aria-describedby={`${id}-response-hint`} />
          <span className="submission-hint" id={`${id}-response-hint`}>Connect each change to the requested feedback. Your response is saved with this version.</span>
        </label>}
      </>}

      {error && <p className="submission-error" role="alert">{error}</p>}

      <footer className="submission-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <div>
          {!review && step === 'creative' && <button type="button" className="btn" onClick={goBack}><ArrowLeft size={16} aria-hidden="true" />Back</button>}
          <button type="submit" className="btn primary">{step === 'context' ? <>Continue to creative<ArrowRight size={16} aria-hidden="true" /></> : review ? `Submit version ${initialVersion!.number + 1}` : 'Submit for review'}</button>
        </div>
      </footer>
      <p className="submission-footnote">Fictional demo · Saved in this browser after submitting · Drafts are not saved</p>
    </form>
  </div>;
}
