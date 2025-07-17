// src/App.jsx
import React, { useEffect } from 'react'; // Import useEffect
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'; // Import useNavigate

// Import AuthProvider and useAuth from your AuthContext
import { AuthProvider, useAuth } from './contexts/AuthContext';

import './App.css'; // Global CSS, including your theme variables
import './styles/DashboardHome.css'; // Import the new dashboard home specific CSS

// Import your components
import HomePage from './components/HomePage';
import FirebaseAuthUI from './components/FirebaseAuthUI'; // Assuming this is your login page
import DashboardLayout from './components/DashboardLayout';

// Import feature components directly from src/features
// Ensure these paths are correct relative to src/
import DashboardHome from './features/DashboardHome';
import ProfilePage from './features/ProfilePage'; // Corrected path based on previous discussions
import RemindersPage from './features/RemindersPage';
import UploadPrescription from './features/UploadPrescription';
import ChatbotUI from './features/ChatbotUI'; // For floating chatbot
import ChatbotPage from './features/ChatbotPage'; // For dedicated chatbot page


// PrivateRoute component to protect routes and handle first-time user redirection
const PrivateRoute = ({ children }) => {
  const { currentUser, loadingAuth, isProfileComplete, profileActionRequired, profileChecked } = useAuth();
  const navigate = useNavigate(); // Get navigate hook within PrivateRoute

  useEffect(() => {
    // This effect runs whenever these state variables change
    console.log("PrivateRoute useEffect: currentUser:", !!currentUser, "loadingAuth:", loadingAuth, "profileChecked:", profileChecked, "profileActionRequired:", profileActionRequired, "isProfileComplete:", isProfileComplete, "Current path:", window.location.pathname);

    // If still loading auth or profile status, do nothing (let the loading screen show)
    if (loadingAuth || !profileChecked) {
      return;
    }

    // If no user is logged in after all checks, redirect to the login page
    if (!currentUser) {
      console.log("PrivateRoute useEffect: No current user after all checks. Navigating to /login.");
      navigate("/login", { replace: true });
      return;
    }

    // If user is logged in and profile status is determined:
    // If profileActionRequired is true, redirect to profile page (unless already there)
    // This happens only if the profile is NOT complete and action IS required.
    if (profileActionRequired) {
      if (window.location.pathname !== "/dashboard/profile") {
        console.log("PrivateRoute useEffect: Profile action required. Navigating to /dashboard/profile.");
        navigate("/dashboard/profile", { replace: true });
      }
      return; // Stop here, either redirected or already on profile page
    }

    // REMOVED LOGIC: The previous line that redirected from /dashboard/profile to /dashboard
    // when isProfileComplete was true is removed here.
    // This allows users to freely navigate to /dashboard/profile even after their profile is complete.

    // If we reach here, it means:
    // 1. Auth and profile checks are complete.
    // 2. User is logged in.
    // 3. profileActionRequired is false (profile is complete, or not required for this session).
    // In these cases, the children component should be rendered.
    console.log("PrivateRoute useEffect: All checks passed or appropriate path. No imperative navigation needed from effect.");

  }, [currentUser, loadingAuth, isProfileComplete, profileActionRequired, profileChecked, navigate]); // Add navigate as dependency

  // Render loading state while auth or profile status is being determined
  if (loadingAuth || !profileChecked) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#2d3748',
        color: '#f8f9fa',
        fontSize: '1.5rem',
      }}>
        Loading user session...
      </div>
    );
  }

  // If we reach here, it means auth and profile checks are done, and we didn't imperatively navigate.
  // The component can now render its children, which will be the DashboardLayout with its Outlet.
  console.log("PrivateRoute Render: Returning children for path:", window.location.pathname);
  return children;
};


function App() {
  return (
    <Router>
      {/* IMPORTANT: Wrap the entire application with AuthProvider */}
      <AuthProvider>
        <AppContent /> {/* Render a separate component that consumes AuthContext */}
      </AuthProvider>
    </Router>
  );
}

// New component to handle conditional rendering based on AuthContext's loading state
const AppContent = () => {
  const { loadingAuth } = useAuth(); // Only need loadingAuth here, PrivateRoute handles more granular states

  // Show a top-level loading indicator until initial authentication state is fully determined.
  // This is a coarse-grained loading. PrivateRoute handles more specific profile loading.
  if (loadingAuth) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#2d3748',
        color: '#f8f9fa',
        fontSize: '2rem',
        padding: '20px'
      }}>
        Initializing Medizap...
      </div>
    );
  }

  // Once authentication is loaded, render the rest of the application routes
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {/* The FirebaseAuthUI component needs access to AuthContext. It is now ensured to be wrapped */}
        <Route path="/login" element={<FirebaseAuthUI />} />

        {/* Dashboard routes nested under DashboardLayout and protected by PrivateRoute */}
        <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
          <Route index element={<DashboardHome />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="reminders" element={<RemindersPage />} />
          <Route path="upload-prescription" element={<UploadPrescription />} />
          <Route path="chatbot-page" element={<ChatbotPage />} />
        </Route>

        {/* Catch-all route for unmatched paths, redirects to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>

      {/* Render ChatbotUI here, outside of <Routes> but inside <Router>.
          This makes it a persistent, floating element visible across all defined routes.
          Its internal state (isOpen, messages) will be maintained as you navigate.
          If you want the floating chatbot ONLY on specific pages, you'd move this
          inside the relevant components or define a more complex routing logic.
      */}
      <ChatbotUI />
    </>
  );
};

export default App;
