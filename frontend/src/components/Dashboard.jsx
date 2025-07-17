// src/components/DashboardLayout.jsx
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Outlet } from 'react-router-dom';
import ChatbotUI from './ChatbotUI'; // <-- Import the ChatbotUI component
import '../styles/DashboardLayout.css';

const DashboardLayout = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  // Get CSS variables for dynamic width adjustment (read from :root)
  const expandedWidth = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-expanded-width') || '250px';
  const collapsedWidth = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-collapsed-width') || '70px';

  const currentMarginLeft = isSidebarCollapsed ? collapsedWidth : expandedWidth;

  return (
    <div className="dashboard-layout-container">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      <div
        className="main-content-area"
        style={{ marginLeft: currentMarginLeft }}
      >
        <Outlet />
      </div>

      {/* --- ADD THE CHATBOT UI HERE --- */}
      <ChatbotUI />
    </div>
  );
};

export default DashboardLayout;