export function ContactsSection() {
  function handleContactSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    console.log(`
      Name: ${formData.get("name")}
      Email: ${formData.get("email")}
      Message: ${formData.get("message")}
      
      Message sent!
    `);
  }
  
  return (
    <section className="about-section contacts">
      <div>
        <p className="text-3xl font-bold">Contacts</p>
        <p><span>Name: </span>Quangtri Thai</p>
        <p><span>Email: </span>qt@email.com</p>
        <p><span>Call me at: </span>+1234567890</p>
      </div>
      
      <form className="gap-1" id="contactForm" onSubmit={handleContactSubmit}>
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <input className="border-1" type="text" name="name" placeholder="Name" required />
            <input className="border-1" type="email" name="email" placeholder="Email" required />
          </div>
          <textarea className="border-1" name="message" placeholder="Message" required />
        </div>
        <button className="border-1" type="submit">Send</button>
      </form>
    </section>
  );
}
