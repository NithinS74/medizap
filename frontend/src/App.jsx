// src/App.jsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";

// Import AuthProvider and useAuth from your AuthContext
import { AuthProvider, useAuth } from "./contexts/AuthContext";

import "./App.css"; // Global CSS, including your theme variables
import "./styles/DashboardHome.css"; // Import the new dashboard home specific CSS

// Import your components
import HomePage from "./components/HomePage";
import FirebaseAuthUI from "./components/FirebaseAuthUI";
import DashboardLayout from "./components/DashboardLayout";

// Import feature components directly from src/features
import DashboardHome from "./features/DashboardHome";
import ProfilePage from "./features/ProfilePage";
import RemindersPage from "./features/RemindersPage";
import UploadPrescription from "./features/UploadPrescription";
import ChatbotUI from "./features/ChatbotUI";
import ChatbotPage from "./features/ChatbotPage";
import ProductAvailability from "./features/ProductAvailability"; // 1. IMPORT THE NEW COMPONENT

// PrivateRoute component to protect routes
const PrivateRoute = ({ children }) => {
  const {
    currentUser,
    loadingAuth,
    isProfileComplete,
    profileActionRequired,
    profileChecked,
  } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loadingAuth || !profileChecked) {
      return;
    }

    if (!currentUser) {
      navigate("/login", { replace: true });
      return;
    }

    if (profileActionRequired) {
      if (window.location.pathname !== "/dashboard/profile") {
        navigate("/dashboard/profile", { replace: true });
      }
    }
  }, [
    currentUser,
    loadingAuth,
    isProfileComplete,
    profileActionRequired,
    profileChecked,
    navigate,
  ]);

  if (loadingAuth || !profileChecked) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "#2d3748",
          color: "#f8f9fa",
          fontSize: "1.5rem",
        }}
      >
        Loading user session...
      </div>
    );
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

// New component to handle conditional rendering based on AuthContext's loading state
const AppContent = () => {
  const { loadingAuth } = useAuth();

  if (loadingAuth) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          backgroundColor: "#2d3748",
          color: "#f8f9fa",
          fontSize: "2rem",
          padding: "20px",
        }}
      >
        Initializing Medizap...
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<FirebaseAuthUI />} />

        {/* Dashboard routes nested under DashboardLayout and protected by PrivateRoute */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="upload-prescription" element={<UploadPrescription />} />
          <Route path="chatbot-page" element={<ChatbotPage />} />
          {/* 2. ADD THE NEW ROUTE FOR PRODUCT AVAILABILITY */}
          <Route
            path="product-availability"
            element={<ProductAvailability />}
          />
        </Route>

        {/* Catch-all route for unmatched paths, redirects to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      <ChatbotUI />
    </>
  );
};

export default App;
