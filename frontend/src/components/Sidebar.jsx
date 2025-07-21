// src/components/Sidebar.jsx
import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // Assuming you use these for navigation
import MedizapLogo from '../assets/medizap_logo.png'; // Import your logo
import '../styles/Sidebar.css'; // Your sidebar's CSS

// Assuming your Sidebar component receives 'isSidebarOpen' and 'toggleSidebar' props from DashboardLayout
const Sidebar = ({ isSidebarOpen, toggleSidebar }) => {
    const location = useLocation(); // To highlight active link

    return (
        <aside className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
            {/* Logo Section - NEW */}
            <div className="sidebar-logo-section">
                <Link to="/dashboard"> {/* Make logo clickable to Dashboard Home */}
                    <img src={MedizapLogo} alt="Medizap Logo" className="sidebar-logo" />
                </Link>
                {/* Optionally, keep the toggle button here if desired in expanded mode */}
                {/* <button className="toggle-button" onClick={toggleSidebar}>
                    {isSidebarOpen ? '✖' : '☰'}
                </button> */}
            </div>

            <nav className="sidebar-nav">
                <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
                    Dashboard Home
                </Link>
                <Link to="/dashboard/profile" className={location.pathname === '/dashboard/profile' ? 'active' : ''}>
                    Profile
                </Link>
                <Link to="/dashboard/reminders" className={location.pathname === '/dashboard/reminders' ? 'active' : ''}>
                    Reminders
                </Link>
                <Link to="/dashboard/chatbot-page" className={location.pathname === '/dashboard/chatbot-page' ? 'active' : ''}>
                    Chatbot Page
                </Link>
                <Link to="/dashboard/upload-prescription" className={location.pathname === '/dashboard/upload-prescription' ? 'active' : ''}>
                    Upload Prescription
                </Link>
            </nav>

            {/* Theme Toggle Button & Logout Button from DashboardLayout */}
            {/* These should ideally be passed as children or rendered via props if they truly belong to Sidebar */}
            {/* For now, assuming your DashboardLayout passes them if they're still there */}
            {/* If they are defined directly in Sidebar.jsx, move them inside the <aside> tag. */}
            {/* Example: */}
            {/* <button onClick={toggleTheme} className="sidebar-theme-toggle">
                {isDarkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
            </button>
            <button onClick={handleLogout} className="logout-button sidebar-logout-button">Logout</button> */}

            {/* Note: If your theme toggle and logout buttons are currently in DashboardLayout.jsx,
                      and you want them in the sidebar, they should be passed as props
                      or the Sidebar component needs to manage them. For this specific request,
                      I'm only adding the logo. */}
        </aside>
    );
};

export default Sidebar;