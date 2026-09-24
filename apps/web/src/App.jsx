import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import HomePage from "./pages/HomePage";
import QuizPage from "./pages/QuizPage";
import QuizResultPage from "./pages/QuizResultPage";
import StickerPage from "./pages/StickerPage";
import ContactPage from "./pages/ContactPage";
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
                For Your Pet
              </NavLink>
            </li>
            <li>
              <NavLink to="/quiz" className={({ isActive }) => (isActive ? "active" : undefined)}>
                Person-Pet Quiz
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
          <Route path="/admin/share" element={<a href="/admin/index.html">Open the admin dashboard</a>} />
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
