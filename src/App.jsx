import React, { useEffect, useState } from "react";

const slides = [
  {
    eyebrow: "A world of possibility",
    title: "Learning today.\nLeading tomorrow.",
    text: "A place for curious minds, meaningful connections and the confidence to take the next step.",
    image: "photo-1577896851231-70ef18881754",
    alt: "Learners taking part in a classroom lesson",
    caption: "Knowledge is only the beginning.",
  },
  {
    eyebrow: "Room to grow",
    title: "Find your voice.\nShape your future.",
    text: "Explore a community where asking questions and discovering new perspectives are part of the journey.",
    image: "photo-1580582932707-520aed937b7b",
    alt: "A bright classroom prepared for learning",
    caption: "Make space for your next chapter.",
  },
  {
    eyebrow: "Keep discovering",
    title: "Small steps.\nNew possibilities.",
    text: "Build a foundation of knowledge, nurture your curiosity and look ahead with purpose.",
    image: "photo-1507003211169-0a1dd7228f2d",
    alt: "Books arranged on library shelves",
    caption: "A new perspective starts here.",
  },
];

function Brand() {
  return (
    <a className="brand" href="#home" aria-label="Africa of Hope home">
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M8 38V13l16 7 16-7v25l-16-7-16 7Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M24 20v11M15 7l9 4 9-4M24 3v8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span>AFRICA OF HOPE<small>KNOWLEDGE · CONFIDENCE · POSSIBILITY</small></span>
    </a>
  );
}

function HeroSlider({ onApply, onLogin }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((value) => (value + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [playing]);

  const slide = slides[active];
  const move = (direction) => setActive((value) => (value + direction + slides.length) % slides.length);

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="Discover Africa of Hope">
      <div className="hero-copy">
        <p className="eyebrow"><span />{slide.eyebrow}</p>
        <h1>{slide.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
        <p className="intro">{slide.text}</p>
        <div className="hero-actions">
          <button className="button primary" onClick={onApply}>Explore admissions <span aria-hidden="true">↗</span></button>
          {onLogin && <button className="button secondary" onClick={onLogin}>Student portal</button>}
        </div>
        <a className="discover" href="#approach"><span aria-hidden="true">↓</span> Discover a different kind of possibility</a>
      </div>
      <div className="hero-media">
        <img
          key={slide.image}
          src={`https://images.unsplash.com/${slide.image}?auto=format&fit=crop&w=1400&q=80`}
          alt={slide.alt}
          width="900"
          height="1000"
          fetchPriority="high"
        />
        <span className="photo-label">LEARNING HAS NO LIMITS</span>
        <div className="photo-caption"><span aria-hidden="true">✳</span><p>{slide.caption}</p></div>
      </div>
      <div className="slider-bar">
        <span className="slide-counter">0{active + 1}<span> / 0{slides.length}</span></span>
        <div className="slide-dots" aria-label="Choose a slide">
          {slides.map((item, index) => (
            <button key={item.image} aria-label={`Show slide ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)}>
              <span className={index === active ? "selected" : ""} />
            </button>
          ))}
        </div>
        <div className="slider-buttons">
          <button aria-label="Previous slide" onClick={() => move(-1)}>←</button>
          <button aria-label={playing ? "Pause slideshow" : "Play slideshow"} aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>{playing ? "Ⅱ" : "▷"}</button>
          <button aria-label="Next slide" onClick={() => move(1)}>→</button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const goToAdmissions = () => document.getElementById("admissions")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header" id="home">
        <Brand />
        <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="navigation" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? "Close ✕" : "Menu ☰"}</button>
        <nav id="navigation" className={menuOpen ? "navigation open" : "navigation"} aria-label="Main navigation">
          <a href="#approach" onClick={() => setMenuOpen(false)}>Our approach</a>
          <a href="#community" onClick={() => setMenuOpen(false)}>Our community</a>
          <a className="nav-action" href="#admissions" onClick={() => setMenuOpen(false)}>Your next chapter <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
      <main id="main">
        <HeroSlider onApply={goToAdmissions} />
        <div className="values-strip"><span>A foundation for your future</span><p>Curiosity <i /> Connection <i /> Opportunity</p></div>
        <section className="approach section" id="approach">
          <div><p className="eyebrow">THE AFRICA OF HOPE SPIRIT</p><h2>More than learning.<br />A way forward.</h2></div>
          <div className="approach-copy"><p>Education begins with a question. It grows through conversation, discovery and the courage to try something new.</p><p>Our vision brings knowledge, confidence and possibility together — putting the learner at the heart of the journey.</p><a className="text-link" href="#community">Explore our learning community <span aria-hidden="true">↗</span></a></div>
        </section>
        <section className="community section" id="community">
          <div className="community-heading"><p className="eyebrow">OUR LEARNING COMMUNITY</p><h2>Knowledge. Confidence.<br /><em>Possibility.</em></h2></div>
          <div className="principles">
            <article><span>01 /</span><h3>Stay curious.</h3><p>Look closer, ask questions and make room for new ideas.</p></article>
            <article><span>02 /</span><h3>Grow together.</h3><p>Share perspectives and learn through meaningful connections.</p></article>
            <article><span>03 /</span><h3>Look ahead.</h3><p>Turn what you learn into the confidence to take your next step.</p></article>
          </div>
        </section>
        <section className="admissions section" id="admissions">
          <div><p className="eyebrow">YOUR NEXT CHAPTER</p><h2>Start with possibility.</h2><p>Interested in joining Africa of Hope? Explore the school’s learning community while online admissions services are being restored.</p></div>
          <aside className="service-notice"><span className="status">SERVICE UPDATE</span><h3>Online admissions</h3><p>Application submission and student sign-in are not connected in this restored public version. No application or personal information is collected here.</p><a className="text-link" href="#approach">Explore our approach <span aria-hidden="true">↑</span></a></aside>
        </section>
      </main>
      <footer><Brand /><p>Learning opens possibilities.</p><a href="#home">Back to top ↑</a></footer>
    </>
  );
}