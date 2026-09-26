import { lazy, Suspense } from 'react';
import { scrollToId } from '../router';
import { Icon } from '../ui/Icon';

// three.js is large; load it after the page is up so the rest of the app stays light.
const HeroScene = lazy(() => import('./HeroScene').then((m) => ({ default: m.HeroScene })));

export function HomePage() {
  return (
    <section className="page">
      <div className="hero">
        <div className="hero-copy">
          <span className="eyebrow rise">Your calm companion for medical paperwork</span>
          <h1 className="rise d1">medify<span className="rx">.Rx</span></h1>
          <p className="tag rise d2">Read it, understand it, and ask about it at your own pace.</p>
          <p className="lead rise d3">
            Scan a consent form or a prescription label, see how your medicines and allergies connect, and learn
            medical terms without the spiral.
          </p>
          <div className="hero-actions rise d4">
            <button className="btn btn-jelly btn-explore" onClick={() => scrollToId('features')}>
              Explore <span className="ar"><Icon name="arrow-down" /></span>
            </button>
            <span className="hero-note"><span className="pulse-dot" />A learning tool, not a diagnosis</span>
          </div>
        </div>
        <div className="stage" aria-hidden="true">
          <div className="portal" />
          <Suspense fallback={null}><HeroScene /></Suspense>
          <div className="stage-pill card floaty">
            <span className="icon-btn"><Icon name="lock" /></span>Dosages stay exactly as written
          </div>
          <div className="stage-cap card floaty b">
            <strong>500 mg · 3× daily</strong>“Take one capsule three times a day.”
          </div>
        </div>
      </div>

      <div className="promises">
        <div className="promise card acc-steel">
          <span className="icon-btn"><Icon name="lock" /></span>
          <div><h4>Numbers never reworded</h4><p>Dose, timing and warnings are copied word for word.</p></div>
        </div>
        <div className="promise card acc-lav">
          <span className="icon-btn"><Icon name="pace" /></span>
          <div><h4>You set the depth</h4><p>Start with the basics. Go further only when you choose to.</p></div>
        </div>
        <div className="promise card acc-blush">
          <span className="icon-btn"><Icon name="shield" /></span>
          <div><h4>Every link has a source</h4><p>Interactions trace back to a real drug label you can open.</p></div>
        </div>
      </div>

      <section className="section" id="features" aria-labelledby="features-title">
        <div className="section-head">
          <div>
            <span className="eyebrow">Three tools, one goal</span>
            <h2 id="features-title">Improve understanding of your health</h2>
          </div>
          <p>
            Each tool answers a different moment: holding a form you don't understand, managing what you take, and
            wondering what a word means.
          </p>
        </div>
        <div className="cards">
          <a className="fcard card acc-steel" href="#compremedic">
            <div className="fcard-top"><span className="orb"><Icon name="scan" /></span><span className="goal">Comprehension</span></div>
            <div><h3>Compremedic</h3></div>
            <p className="sub">Snap it. Read it plainly. Hear it.</p>
            <p className="desc">
              Bring the text from a consent form, bottle or lens box. We set a plain-language version beside the
              original, with audio for both.
            </p>
            <div className="mini inset">
              <div className="mini-compare">
                <div className="paper"><b>Original</b>Take 1 cap PO TID × 10 days</div>
                <div className="paper"><b>Plain</b>Swallow 1 capsule <span className="lock">3× a day</span> for <span className="lock">10 days</span></div>
              </div>
            </div>
            <div className="fcard-foot"><span>Open Compremedic</span><span className="icon-btn"><Icon name="arrow-ne" /></span></div>
          </a>

          <a className="fcard card acc-blush" href="#prescriptive">
            <div className="fcard-top"><span className="orb"><Icon name="tree" /></span><span className="goal">Awareness</span></div>
            <div><h3>Prescriptive</h3></div>
            <p className="sub">Your medicines, mapped.</p>
            <p className="desc">
              Add your prescriptions, allergies and foods to build a living tree of what doesn't mix with your
              situation, each link traced to its source.
            </p>
            <div className="mini inset">
              <svg className="mini-tree" viewBox="0 0 300 96" aria-hidden="true">
                <g stroke="#BFB2AC" strokeWidth="2" fill="none">
                  <path d="M150 22 C150 50 60 40 60 72" /><path d="M150 22V72" /><path d="M150 22 C150 50 240 40 240 72" />
                </g>
                <circle cx="150" cy="20" r="12" fill="#736A86" />
                <circle cx="150" cy="20" r="12" fill="none" stroke="#fff" strokeWidth="2" />
                <circle cx="60" cy="74" r="9" fill="#D4CAC5" stroke="#fff" strokeWidth="2" />
                <circle cx="150" cy="74" r="9" fill="#C8CED6" stroke="#fff" strokeWidth="2" />
                <circle cx="240" cy="74" r="9" fill="#9A6A6F" stroke="#fff" strokeWidth="2" />
              </svg>
            </div>
            <div className="fcard-foot"><span>Open Prescriptive</span><span className="icon-btn"><Icon name="arrow-ne" /></span></div>
          </a>

          <a className="fcard card acc-lav" href="#medictionary">
            <div className="fcard-top"><span className="orb"><Icon name="book" /></span><span className="goal">Conscious learning</span></div>
            <div><h3>Medictionary</h3></div>
            <p className="sub">Answers sized to what you're ready for.</p>
            <p className="desc">
              Look up medicines, dosage terms or words you heard at an appointment. Gentle guardrails keep you from
              worst-case spirals and endless rabbit holes.
            </p>
            <div className="mini inset">
              <div className="mini-search paper"><Icon name="search" size={16} />What does “PRN” mean?</div>
              <div className="mini-steps"><span className="f" /><span /><span /></div>
            </div>
            <div className="fcard-foot"><span>Open Medictionary</span><span className="icon-btn"><Icon name="arrow-ne" /></span></div>
          </a>
        </div>
      </section>
    </section>
  );
}
