import { RouteLink } from '../ui/RouteLink';
import { lazy, Suspense } from 'react';
import { scrollToId } from '../router';
import { Icon } from '../ui/Icon';
import { OrbsPreview } from './OrbsPreview';

// three.js is large; load it after the page is up so the rest of the app stays light.
const HeroScene = lazy(() => import('./HeroScene').then((m) => ({ default: m.HeroScene })));

export function HomePage() {
  return (
    <section className="page">
      <div className="hero">
        <div className="hero-copy">
          <h1 className="rise d1">medify<span className="rx">.Rx</span></h1>
          <p className="tag rise d2">Read it, understand it, and ask about it at your own pace.</p>
          <p className="lead rise d3">
            Scan a consent form or a prescription label, see how your medications and allergies connect, and learn
            medical terms without the spiral.
          </p>
          <div className="hero-actions rise d4">
            <button className="btn btn-jelly btn-explore" onClick={() => scrollToId('features')}>
              Explore <span className="ar"><Icon name="arrow-down" /></span>
            </button>
            <span className="hero-note"><span className="pulse-dot" />A learning tool, not a diagnostic tool</span>
          </div>
        </div>
        <div className="stage" aria-hidden="true">
          <div className="portal" />
          <Suspense fallback={null}><HeroScene /></Suspense>
          <div className="stage-pill card floaty">
            <span className="icon-btn"><Icon name="highfive" /></span>Your health, in your hands
          </div>
          <div className="stage-cap card floaty b">
            <strong>Demystify medical jargon</strong>
          </div>
        </div>
      </div>

      <div className="promises">
        <div className="promise card acc-steel">
          <span className="icon-btn"><Icon name="lock" /></span>
          <div><h4>Numbers never reworded</h4><p>Dose, timing, and warnings are copied word for word.</p></div>
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
        </div>
        <div className="cards">
          <RouteLink className="fcard card acc-steel" to="compremedic">
            <div className="fcard-top"><span className="orb"><Icon name="scan" /></span><span className="goal">Comprehension</span></div>
            <div><h3>Compremedic</h3></div>
            <p className="sub">Snap it. Read it plainly. Hear it.</p>
            <p className="desc">
              Photograph or upload a prescription, consent form, or other document (photo, PDF, or Word). Read it
              in plain words beside the original, hear it aloud, and tap any word to have it explained.
            </p>
            <div className="mini inset">
              <div className="mini-compare">
                <div className="paper"><b>Original</b>Take 1 cap PO TID × 10 days</div>
                <div className="paper"><b>Plain</b>Swallow 1 capsule <span className="lock">3× a day</span> for <span className="lock">10 days</span></div>
              </div>
            </div>
            <div className="fcard-foot"><span>Open Compremedic</span><span className="icon-btn"><Icon name="arrow-ne" /></span></div>
          </RouteLink>

          <RouteLink className="fcard card acc-blush" to="prescriptive">
            <div className="fcard-top"><span className="orb"><Icon name="tree" /></span><span className="goal">Awareness</span></div>
            <div><h3>Prescriptive</h3></div>
            <p className="sub">Your medications, mapped.</p>
            <p className="desc">
              Add your prescriptions, allergies, and foods to build a living tree of what doesn't mix with your
              situation, each link traced to its source.
            </p>
            <div className="mini inset">
              <OrbsPreview />
            </div>
            <div className="fcard-foot"><span>Open Prescriptive</span><span className="icon-btn"><Icon name="arrow-ne" /></span></div>
          </RouteLink>

          <RouteLink className="fcard card acc-lav" to="medictionary">
            <div className="fcard-top"><span className="orb"><Icon name="book" /></span><span className="goal">Conscious learning</span></div>
            <div><h3>Medictionary</h3></div>
            <p className="sub">Answers sized to what you're ready for.</p>
            <p className="desc">
              Look up medications, dosage terms, or words you heard at an appointment. Gentle guardrails keep you from
              worst-case spirals and endless rabbit holes.
            </p>
            <div className="mini inset">
              <div className="mini-search paper"><Icon name="search" size={16} />What does “PRN” mean?</div>
              <div className="mini-steps"><span className="f" /><span /><span /></div>
            </div>
            <div className="fcard-foot"><span>Open Medictionary</span><span className="icon-btn"><Icon name="arrow-ne" /></span></div>
          </RouteLink>
        </div>
      </section>
    </section>
  );
}
