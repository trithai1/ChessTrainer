const contactForm = document.querySelector("#contactForm");

contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm); // can also use event.target
    console.log(`
        Name: ${formData.get("name")}
        Email: ${formData.get("email")}
        Message: ${formData.get("message")}
        
        Message sent!
    `);
});