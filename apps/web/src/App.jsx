import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import HomePage from "./pages/HomePage";
import QuizPage from "./pages/QuizPage";
import QuizResultPage from "./pages/QuizResultPage";
import StickerPage from "./pages/StickerPage";
import ContactPage from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./auth/AuthProvider.js";
import { startCustomerTracking } from "../../../js/ingestion-client.mjs";

export default function App() {
  const location = useLocation();

  useEffect(() => startCustomerTracking(), [location.pathname]);

  useEffect(() => {
    const navbar = document.querySelector(".navbar");

    const onScroll = () => {
      if (!navbar) {
        return;
      }
      if (window.scrollY > 50) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    };

    window.addEventListener("scroll", onScroll);
    onScroll();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        }
      });
    });

    const revealTargets = document.querySelectorAll(
      ".card, .product-card, .stat, .step"
    );
    revealTargets.forEach((el) => {
      el.classList.add("hidden");
      observer.observe(el);
    });

    const productButtons = document.querySelectorAll(".product-card button");
    const buttonHandlers = [];
    productButtons.forEach((button) => {
      const oldText = button.innerText;
      const handler = () => {
        button.innerText = "Added";
        setTimeout(() => {
          button.innerText = oldText;
        }, 2000);
      };
      button.addEventListener("click", handler);
      buttonHandlers.push({ button, handler });
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      buttonHandlers.forEach(({ button, handler }) => {
        button.removeEventListener("click", handler);
      });
    };
  }, [location.pathname]);

  return (
    <>
      <header>
        <nav className="navbar">
          <img src="/business_assets/purrish_logo.png" alt="Purrish&Co." className="logo" />
          <ul className="nav-links">
            <li>
              <NavLink to="/" className={({ isActive }) => (isActive ? "active" : undefined)}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/pet" className={({ isActive }) => (isActive ? "active" : undefined)}>
                Purrify
              </NavLink>
            </li>
            <li>
              <NavLink to="/quiz" className={({ isActive }) => (isActive ? "active" : undefined)}>
                Purrsonality
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/contact"
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                Contact
              </NavLink>
            </li>
            <ProfileMenu />
          </ul>
        </nav>
      </header>

      <main>
        <div hidden={location.pathname !== "/pet"}>
          <StickerPage />
        </div>
        <div hidden={location.pathname !== "/quiz"}>
          <QuizPage />
        </div>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/quiz/result" element={<QuizResultPage />} />
          <Route path="/quiz/result/:id" element={<QuizResultPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/share" element={<a href="https://purperfect-admin.web.app/index.html">Open the admin dashboard</a>} />
        </Routes>
      </main>

      <footer>
        <img src="/business_assets/purrish_logo.png" alt="Purrish&Co." className="logo-footer" />
        <p>"We are also your pets' best friend."</p>
        <p>© 2026 Purrish&Co. All Rights Reserved.</p>
      </footer>
    </>
  );
}

function ProfileMenu() {
  const { user, loading, pending, signOut } = useAuth();
  const location = useLocation();
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuError, setMenuError] = useState("");

  useEffect(() => {
    setOpen(false);
    setMenuError("");
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const handleSignOut = async () => {
    setMenuError("");
    try {
      await signOut();
      setOpen(false);
    } catch (error) {
      setMenuError(error.message);
    }
  };

  const accessibleLabel = loading
    ? "Checking account"
    : user
      ? `Open account menu for ${user.email}`
      : "Open login menu";

  return (
    <li className="profile-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        className={`profile-menu-trigger ${location.pathname === "/login" ? "active" : ""}`}
        type="button"
        aria-label={accessibleLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <i className={user ? "fa-solid fa-user" : "fa-regular fa-user"} aria-hidden="true" />
        {user && <span className="profile-menu-indicator" aria-hidden="true" />}
      </button>

      {open && (
        <div className="profile-menu-dropdown" role="menu" aria-label="Customer account">
          {loading ? (
            <span className="profile-menu-status" role="status">Checking account...</span>
          ) : user ? (
            <>
              <div className="profile-menu-identity">
                <span>Signed in as</span>
                <strong>{user.email}</strong>
              </div>
              <NavLink to="/login" role="menuitem">
                <i className="fa-regular fa-id-card" aria-hidden="true" />
                Account
              </NavLink>
              <button type="button" role="menuitem" disabled={pending} onClick={handleSignOut}>
                <i className="fa-solid fa-arrow-right-from-bracket" aria-hidden="true" />
                {pending ? "Signing out..." : "Sign Out"}
              </button>
            </>
          ) : (
            <NavLink to="/login" role="menuitem">
              <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true" />
              Log In
            </NavLink>
          )}
          {menuError && <p className="profile-menu-error" role="alert">{menuError}</p>}
        </div>
      )}
    </li>
  );
}
