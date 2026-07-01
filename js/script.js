

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

        button.innerText = "Added ✓";

        setTimeout(() => {

            button.innerText = "Add to Cart";

        }, 2000);

    });

});




const form = document.querySelector("form");

if (form) {

    form.addEventListener("submit", (e) => {

        e.preventDefault();

        alert("Message sent successfully!");

    });

}