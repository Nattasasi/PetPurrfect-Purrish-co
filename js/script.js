

window.addEventListener("scroll", () => {

    const navbar = document.querySelector(".navbar");

    if (window.scrollY > 50) {

        navbar.classList.add("scrolled");

    } else {

        navbar.classList.remove("scrolled");

    }

});




document.querySelectorAll('a[href^="#"]').forEach(anchor => {

    anchor.addEventListener('click', function (e) {

        e.preventDefault();

        document.querySelector(this.getAttribute('href'))
            .scrollIntoView({
                behavior: 'smooth'
            });

    });

});




const observer = new IntersectionObserver(entries => {

    entries.forEach(entry => {

        if (entry.isIntersecting) {

            entry.target.classList.add("show");

        }

    });

});

document.querySelectorAll(
    ".card, .product-card, .stat, .step"
).forEach(el => {

    el.classList.add("hidden");

    observer.observe(el);

});




document.querySelectorAll(".product-card button")
.forEach(button => {

    button.addEventListener("click", () => {

        button.innerText = "Added";

        setTimeout(() => {

            button.innerText = "Add to Cart";

        }, 2000);

    });

});




// Customer tracking and contact submission share one implementation with React.
import("./ingestion-client.mjs").then(({ startCustomerTracking, connectContactForm }) => {
    startCustomerTracking();
    const form = document.querySelector("#contact-form");
    if (form) connectContactForm(form);
}).catch(() => {
    const status = document.querySelector('#contact-form [role="status"]');
    if (status) status.textContent = "Contact service could not load. Please reload and try again.";
});
