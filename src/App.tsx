import { useState } from 'react';

export default function App() {
  const [selected, setSelected] = useState(false);
  const [checked, setChecked] = useState<string[]>([]);
  const [status, setStatus] = useState('Revision returned');
  return <main><h1>ClearPath Review — working draft</h1><p>Marketing compliance review · Fictional demo</p><button onClick={() => setSelected(true)}>CP-1042 · A little breathing room · {status}</button>{selected && <section><h2>A little breathing room</h2><p>BrightNest · Paid social · Personal loans · Version 2</p><h3>Submitted creative</h3><blockquote><h2>A little breathing room.</h2><p>Explore personal loans from $5,000 to $35,000. Check your options with no impact to your credit score.</p><p>APR 8.99%–24.99%. Subject to credit approval. Rates and terms depend on creditworthiness.</p></blockquote><h3>Reviewer checklist</h3>{['Eligibility language corrected', 'APR range added'].map(item => <p key={item}><label><input type="checkbox" checked={checked.includes(item)} onChange={e => setChecked(e.target.checked ? [...checked, item] : checked.filter(x => x !== item))}/>{item}</label></p>)}<button disabled={checked.length !== 2} onClick={() => setStatus('Approved v2')}>Approve version 2</button><p>{status}</p></section>}</main>;
}
