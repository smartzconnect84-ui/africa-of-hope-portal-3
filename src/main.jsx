import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function StartupError() {
  return (
    <main
      role="alert"
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "clamp(24px, 6vw, 72px)",
        color: "#194c3c",
        fontFamily: "Arial, Helvetica, sans-serif",
        lineHeight: 1.7
      }}
    >
      <p style={{ fontSize: "12px", letterSpacing: "2px" }}>
        AFRICA OF HOPE
      </p>
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: "clamp(30px, 6vw, 48px)",
          lineHeight: 1.15,
          fontWeight: 400
        }}
      >
        The homepage could not start.
      </h1>
      <p>
        An unexpected loading error interrupted the page. Please reload to try
        again.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          minHeight: "48px",
          padding: "12px 22px",
          border: "1px solid #194c3c",
          background: "#194c3c",
          color: "#ffffff",
          font: "inherit",
          cursor: "pointer"
        }}
      >
        Reload homepage
      </button>
    </main>
  );
}

class RenderBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, details) {
    console.error("Homepage render failed:", error, details.componentStack);
  }

  render() {
    return this.state.failed ? <StartupError /> : this.props.children;
  }
}

const container = document.getElementById("root");

if (!container) {
  throw new Error("The application root element is missing from index.html.");
}

const root = createRoot(container);

async function start() {
  try {
    const { default: App } = await import("./App.jsx");

    root.render(
      <React.StrictMode>
        <RenderBoundary>
          <App />
        </RenderBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Homepage module failed to load:", error);
    root.render(<StartupError />);
  }
}

start();