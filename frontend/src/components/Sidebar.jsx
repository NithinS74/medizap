// src/components/Sidebar.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext'; // Import useAuth to get profileActionRequired
import '../styles/Sidebar.css'; // Import the CSS file

// No external icon library imports needed now!

const Sidebar = ({ isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const auth = getAuth();
  const { profileActionRequired } = useAuth(); // Get the state from AuthContext

  // Helper function to handle navigation and potential auto-collapse
  const handleNavigation = (path) => {
    // Only navigate if profileActionRequired is false, or if the path is the profile page itself
    if (!profileActionRequired || path === '/dashboard/profile') {
      navigate(path);
      // Optional: auto-collapse sidebar after navigation if desired
      // if (!isCollapsed) onToggleCollapse();
    } else {
      console.warn("Navigation disabled: Please complete your profile first.");
      // Optionally provide user feedback here, e.g., a toast notification
    }
  };

  const handleHomeClick = () => handleNavigation('/dashboard');
  const handleProfileClick = () => handleNavigation('/dashboard/profile');
  const handleRemindersClick = () => handleNavigation('/dashboard/reminders');
  const handleUploadPrescriptionClick = () => handleNavigation('/dashboard/upload-prescription');
  const handleChatbotPageClick = () => handleNavigation('/dashboard/chatbot-page');

  const handleLogoutClick = async () => {
    try {
      await signOut(auth);
      navigate('/login');
      console.log('User signed out successfully.');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Add disabled class or attribute based on profileActionRequired
  const navButtonClass = (isDisabled) => 
    `${isCollapsed ? 'nav-button nav-button-collapsed' : 'nav-button nav-button-expanded'} ${isDisabled ? 'disabled-nav-button' : ''}`;

  return (
    <div className={`sidebar-container ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      <div className="top-section">
        <button onClick={onToggleCollapse} className="toggle-button">
          {/* Using Unicode characters for toggle */}
          {isCollapsed ? '☰' : '✕'} {/* Hamburger for collapsed, 'X' for expanded */}
        </button>
        {!isCollapsed && <h2 className="logo-text">Medizap</h2>}
      </div>

      <nav className="navigation">
        <button className={navButtonClass(profileActionRequired)} onClick={handleHomeClick} disabled={profileActionRequired}>
          {/* Using Unicode characters for navigation icons */}
          <span className="icon">🏠</span> {/* User/dashboard */}
          {!isCollapsed && <span>Home</span>}
        </button>
        <button className={navButtonClass(false)} onClick={handleProfileClick} disabled={false}> {/* Profile page should always be accessible */}
          {/* Using Unicode characters for navigation icons */}
          <span className="icon">👤</span> {/* User/Profile */}
          {!isCollapsed && <span>Profile</span>}
        </button>
        <button className={navButtonClass(profileActionRequired)} onClick={handleRemindersClick} disabled={profileActionRequired}>
          <span className="icon">🔔</span> {/* Bell/Reminders */}
          {!isCollapsed && <span>Reminders</span>}
        </button>
        <button className={navButtonClass(profileActionRequired)} onClick={handleUploadPrescriptionClick} disabled={profileActionRequired}>
          {/* Using Unicode characters for navigation icons */}
          <span className="icon">📄</span> {/* Document/Prescription */}
          {!isCollapsed && <span>Upload Prescription</span>}
        </button>
        {/* --- NEW CHATBOT PAGE BUTTON --- */}
        <button className={navButtonClass(profileActionRequired)} onClick={handleChatbotPageClick} disabled={profileActionRequired}>
          <span className="icon">💬</span> {/* Chat bubble icon */}
          {!isCollapsed && <span>Chatbot Page</span>}
        </button>
      </nav>

      <div className="bottom-section">
        <button className={navButtonClass(false)} onClick={handleLogoutClick} disabled={false}> {/* Logout should always be accessible */}
          <span className="icon">🚪</span> {/* Door/Logout */}
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
