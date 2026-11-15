import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./homepage.css";

const slides = [
  {
    label: "A WORLD OF POSSIBILITY",
    first: "Learning today.",
    second: "Leading tomorrow.",
    description: "A place for curious minds, meaningful connections and the confidence to take your next step.",
    image: "photo-1577896851231-70ef18881754",
    alt: "Students learning together in a classroom",
    caption: "Your next chapter starts with curiosity."
  },
  {
    label: "MAKE ROOM FOR DISCOVERY",
    first: "Ask questions.",
    second: "Find your path.",
    description: "Discover new perspectives and build a foundation of knowledge that stays with you.",
    image: "photo-1580582932707-520aed937b7b",
    alt: "A bright classroom with space to learn",
    caption: "A little curiosity can open a new door."
  },
  {
    label: "KNOWLEDGE OPENS DOORS",
    first: "Keep exploring.",
    second: "Keep growing.",
    description: "Learning is a journey. Take the time to explore ideas, make connections and look ahead with purpose.",
    image: "photo-1507003211169-0a1dd7228f2d",
    alt: "Books on shelves in a library",
    caption: "There is always more to discover."
  }
];

function Arrow({ direction = "right" }) {
  return (
    <svg className={`aoh-arrow aoh-arrow-${direction}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Brand() {
  return (
    <a className="aoh-brand" href="#home" aria-label="Africa of Hope home">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M6 14 24 21l18-7v25l-18-7-18 7V14Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M24 21v11M15 6l9 4 9-4M24 2v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>AFRICA OF HOPE<small>KNOWLEDGE · CONFIDENCE · POSSIBILITY</small></span>
    </a>
  );
}

function HeroSlider({ onApply }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((previous) => (previous + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const slide = slides[active];
  const move = (amount) => setActive((previous) => (previous + amount + slides.length) % slides.length);

  return (
    <section className="aoh-hero aoh-container" aria-label="Discover Africa of Hope" aria-roledescription="carousel">
      <div className="aoh-hero-copy">
        <p className="aoh-eyebrow"><span className="aoh-dot" />{slide.label}</p>
        <div aria-live={playing ? "off" : "polite"} aria-atomic="true">
          <h1>{slide.first}<em>{slide.second}</em></h1>
          <p className="aoh-intro">{slide.description}</p>
        </div>
        <div className="aoh-actions">
          <button className="aoh-button" onClick={onApply}>Explore your next step <Arrow /></button>
          <a className="aoh-simple-link" href="#approach">Our approach <Arrow direction="diagonal" /></a>
        </div>
        <a className="aoh-discover" href="#approach"><span>↓</span> A little curiosity goes a long way</a>
      </div>
      <div className="aoh-hero-image">
        <img
          src={`https://images.unsplash.com/${slide.image}?auto=format&fit=crop&w=1400&q=85`}
          alt={slide.alt}
          width="1000"
          height="1100"
          fetchPriority="high"
        />
        <span className="aoh-image-label">THE FUTURE STARTS WITH LEARNING</span>
        <div className="aoh-image-note">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 4v40M4 24h40M10 10l28 28M10 38l28-28" stroke="currentColor" strokeWidth="3" />
          </svg>
          <p>{slide.caption}</p>
        </div>
      </div>
      <div className="aoh-slider-toolbar">
        <span className="aoh-slide-number">0{active + 1}<span> / 0{slides.length}</span></span>
        <div className="aoh-slide-tabs" aria-label="Choose a slide">
          {slides.map((item, index) => (
            <button key={item.image} onClick={() => setActive(index)} aria-label={`Show slide ${index + 1}`} aria-pressed={index === active}>
              <span />
            </button>
          ))}
        </div>
        <div className="aoh-slide-controls">
          <button onClick={() => move(-1)} aria-label="Previous slide"><Arrow direction="left" /></button>
          <button onClick={() => setPlaying((previous) => !previous)} aria-label={playing ? "Pause slideshow" : "Play slideshow"} aria-pressed={playing}>{playing ? "Ⅱ" : "▷"}</button>
          <button onClick={() => move(1)} aria-label="Next slide"><Arrow /></button>
        </div>
      </div>
    </section>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const exploreAdmissions = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("admissions")?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
  };

  return (
    <div className="aoh-site" id="home">
      <a className="aoh-skip" href="#main">Skip to content</a>
      <header className="aoh-header">
        <div className="aoh-container aoh-nav-row">
          <Brand />
          <button className="aoh-menu-toggle" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((previous) => !previous)}>
            {menuOpen ? "Close" : "Menu"}
            <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          </button>
          <nav id="main-navigation" className={menuOpen ? "aoh-nav is-open" : "aoh-nav"} aria-label="Main navigation">
            <a href="#approach" onClick={closeMenu}>Our approach</a>
            <a href="#community" onClick={closeMenu}>Our community</a>
            <a className="aoh-nav-cta" href="#admissions" onClick={closeMenu}>Your next chapter <Arrow direction="diagonal" /></a>
          </nav>
        </div>
      </header>
      <main id="main">
        <HeroSlider onApply={exploreAdmissions} />
        <div className="aoh-values">
          <div className="aoh-container aoh-values-row">
            <span>A FOUNDATION FOR YOUR FUTURE</span>
            <p>Curiosity <i /> Connection <i /> Possibility</p>
          </div>
        </div>
        <section className="aoh-container aoh-section aoh-approach" id="approach">
          <div>
            <p className="aoh-eyebrow">THE AFRICA OF HOPE SPIRIT</p>
            <h2>More than learning.<br /><em>A way forward.</em></h2>
          </div>
          <div className="aoh-body-copy">
            <p>Education begins with a question. It grows through conversation, discovery and the courage to try something new.</p>
            <p>Our vision brings knowledge, confidence and possibility together — putting the learner at the heart of the journey.</p>
            <a className="aoh-underlined-link" href="#community">Meet our learning philosophy <Arrow direction="diagonal" /></a>
          </div>
        </section>
        <section className="aoh-community" id="community">
          <div className="aoh-container aoh-section">
            <p className="aoh-eyebrow">OUR LEARNING COMMUNITY</p>
            <h2>Knowledge. Confidence.<br /><em>Possibility.</em></h2>
            <div className="aoh-principles">
              <article><span>01 / DISCOVER</span><h3>Stay curious.</h3><p>Look closer, ask questions and make room for new ideas.</p></article>
              <article><span>02 / CONNECT</span><h3>Grow together.</h3><p>Share perspectives and find inspiration in the people around you.</p></article>
              <article><span>03 / BECOME</span><h3>Look ahead.</h3><p>Turn what you learn into the confidence to take your next step.</p></article>
            </div>
          </div>
        </section>
        <section className="aoh-container aoh-section aoh-admissions" id="admissions">
          <div>
            <p className="aoh-eyebrow">YOUR NEXT CHAPTER</p>
            <h2>Start with<br /><em>possibility.</em></h2>
            <p className="aoh-intro">Get to know Africa of Hope and the ideas at the heart of our learning community.</p>
          </div>
          <aside className="aoh-service-note">
            <span className="aoh-eyebrow">ONLINE SERVICES · RESTORATION UPDATE</span>
            <h3>A note about admissions</h3>
            <p>Online applications and student sign-in are not connected in this restored public version. This page does not collect applications or personal information.</p>
            <a className="aoh-underlined-link" href="#approach">Explore our approach <Arrow /></a>
          </aside>
        </section>
      </main>
      <footer className="aoh-footer">
        <div className="aoh-container aoh-footer-row"><Brand /><p>Learning opens possibilities.</p><a href="#home">Back to top ↑</a></div>
      </footer>
    </div>
  );
}

class HomepageBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Homepage rendering failed:", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="aoh-container aoh-section">
          <Brand />
          <h1>Learning opens possibilities.</h1>
          <p>The interactive homepage could not load. Please reload to try again.</p>
          <button className="aoh-button" onClick={() => window.location.reload()}>Reload homepage</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root application container.");

createRoot(root).render(
  <React.StrictMode>
    <HomepageBoundary><App /></HomepageBoundary>
  </React.StrictMode>
);