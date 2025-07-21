import React from 'react';
import { useNavigate } from 'react-router-dom';

// IMPORTANT: Ensure this logo is a LIGHT version for dark backgrounds!
import logo from '../assets/medizap_logo.png'; 

// Placeholder images (replace with your actual assets later)
import featureMap from '../assets/hp_feature_map.png';
import featureAssistant from '../assets/hp_feature_assistant.png';
import featureReminders from '../assets/hp_feature_reminders.png';
import featureSOS from '../assets/hp_feature_sos.png';
import featurePrescription from '../assets/hp_feature_prescription.png';

// Import the CSS file for styling
import '../styles/HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className="hp-container">
      {/* Header */}
      <header className="hp-main-header">
        <div className="hp-header-left">
          <span className="hp-app-name">Medizap</span>
          <img src={logo} alt="Medizap Logo" className="hp-header-logo" />
        </div>
        <button onClick={handleLoginClick} className="hp-login-button">Login</button>
      </header>

      {/* Features Grid Section */}
      <section className="hp-section hp-features-grid-section">
        <h2 className="hp-features-grid-title">Key Features</h2>
        <div className="hp-features-grid">
          {/* Feature Item 1: Map */}
          <div className="hp-feature-item">
            <img src={featureMap} alt="Locate Care" className="hp-feature-icon" />
            <h3>Locate Care Instantly</h3>
            <p>Find nearby pharmacies & hospitals fast.</p>
          </div>

          {/* Feature Item 2: Assistant */}
          <div className="hp-feature-item">
            <img src={featureAssistant} alt="Health Assistant" className="hp-feature-icon" />
            <h3>Health Assistant Chatbot</h3>
            <p>Get info on diseases & symptoms.</p>
          </div>

          {/* Feature Item 3: Reminders */}
          <div className="hp-feature-item">
            <img src={featureReminders} alt="Medication Reminders" className="hp-feature-icon" />
            <h3>Medication Reminders</h3>
            <p>Never miss a dose again.</p>
          </div>

          {/* Feature Item 4: SOS */}
          <div className="hp-feature-item">
            <img src={featureSOS} alt="Emergency SOS" className="hp-feature-icon" />
            <h3>Emergency SOS Button</h3>
            <p>Send instant help alerts.</p>
          </div>

          {/* Feature Item 5: Prescription Converter */}
          <div className="hp-feature-item">
            <img src={featurePrescription} alt="Prescription Converter" className="hp-feature-icon" />
            <h3>Prescription Converter</h3>
            <p>Convert handwritten notes to text.</p>
          </div>
        </div>
      </section>

      {/* Condensed CTA & Footer */}
      <footer className="hp-footer hp-cta-footer">
        <h2 className="hp-cta-title">Ready for Smarter Healthcare?</h2>
        <button onClick={handleLoginClick} className="hp-primary-button">
          Get Medizap Now
        </button>

        <div className="hp-footer-bottom">
          {/* REMOVED: Footer Logo */}
          {/* <img src={logo} alt="Medizap Logo" className="hp-footer-logo" /> */}
          <p>&copy; {new Date().getFullYear()} Medizap. All rights reserved.</p>
          <div className="hp-footer-links">
            <a href="/privacy" className="hp-footer-link">Privacy Policy</a>
            <a href="/terms" className="hp-footer-link">Terms of Service</a>
            <a href="/contact" className="hp-footer-link">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;