export function ContactsSection() {
  return (
    <section className="about-section contacts">
      <div>
        <p className="text-3xl font-bold">Contacts</p>
        <p><span>Name: </span> Quangtri Thai</p>
        <p><span>Email: </span> qt@email.com</p>
        <p><span>Call me at: </span> +1234567890</p>
      </div>
      
      <form id="contactForm">
        <div>
          <div>
            <input type="text" name="name" placeholder="Name" required />
            <input type="email" name="email" placeholder="Email" required />
          </div>
          <textarea name="message" placeholder="Message" required />
        </div>
        <button type="submit">Send</button>
      </form>
    </section>
  );
}
