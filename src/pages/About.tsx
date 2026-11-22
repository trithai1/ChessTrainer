import { AboutSection } from "../components/AboutSection";
import { CreditSection } from "../components/CreditSection";
import { ContactsSection } from "../components/ContactsSection";


export function About() {
  return (
    <div className="container">
      <div className="about-page">
        <AboutSection />
        
        <div className="cat-img">
          <img src="/src/assets/img/yelling_women_versus_chess_cat.png" alt="cat-photo" />
        </div>

        <CreditSection />
        <ContactsSection />
      </div>
    </div>
  );
}
