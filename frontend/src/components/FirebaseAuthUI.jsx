// src/components/FirebaseAuthUI.jsx
import React, { useEffect } from "react";
// It's generally better to use the modular Firebase SDK functions
// instead of the compat version if possible, but for FirebaseUI,
// the compat version is often still necessary.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";
import { app } from "../firebase"; // Your Firebase app instance

import { useNavigate } from "react-router-dom"; // Still needed for fallback/other uses if any, but not for direct login redirect here
import { useAuth } from "../contexts/AuthContext"; // Import useAuth context

// IMPORT THE CSS FILE
import '../styles/FirebaseAuthUI.css';

// Initialize compat Firebase manually (only once)
// This ensures that firebase.compat.app is initialized if getApps().length is 0.
// If your primary firebase.js already initialized a default app, this will get that.
if (!firebase.apps.length) {
  console.log("FirebaseAuthUI: Initializing Firebase compat app with options from src/firebase.js");
  firebase.initializeApp(app.options);
} else {
  console.log("FirebaseAuthUI: Firebase compat app already initialized. Using existing app.");
  // Ensure we're working with the same default app instance
  firebase.app(); 
}

const FirebaseAuthUI = () => {
  const navigate = useNavigate(); // Keep navigate hook for potential future use or debugging, but not for direct login redirect here
  const authContext = useAuth(); // Get the raw context object

  // This check ensures we don't try to destructure if useAuth() returns undefined/null
  if (!authContext) {
    console.error("FirebaseAuthUI: useAuth() returned null or undefined. This typically means FirebaseAuthUI is not wrapped by AuthProvider in App.jsx.");
    // Return a simple loading/error message to prevent component crash
    return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          backgroundColor: '#2d3748',
          color: '#ff6b6b',
          fontSize: '1.2rem',
          textAlign: 'center',
          padding: '20px'
        }}>
            <p>Authentication context not available. Please check app configuration.</p>
            <p>Ensure `FirebaseAuthUI` is rendered inside `AuthProvider`.</p>
        </div>
    );
  }
  
  // Destructure checkProfileCompletion from useAuth.
  // Although not used for navigation in this component, it might be used for logging/debugging
  const { checkProfileCompletion } = authContext; 

  console.log("FirebaseAuthUI: Component rendered.");

  useEffect(() => {
    console.log("FirebaseAuthUI: useEffect triggered.");

    const firebaseUiContainer = document.getElementById("firebaseui-auth-container");
    if (!firebaseUiContainer) {
      console.error("FirebaseAuthUI: Target DOM element #firebaseui-auth-container not found!");
      return; // Exit if container isn't available
    }
    console.log("FirebaseAuthUI: Target DOM element found:", firebaseUiContainer);

    let ui;
    try {
      // Get an AuthUI instance. If one already exists, use it. Otherwise, create a new one.
      // Use firebase.auth() for the compat AuthUI constructor.
      ui = firebaseui.auth.AuthUI.getInstance() || new firebaseui.auth.AuthUI(firebase.auth());
      console.log("FirebaseAuthUI: firebaseui.auth.AuthUI instance obtained.");
    } catch (e) {
      console.error("FirebaseAuthUI: Error instantiating firebaseui.auth.AuthUI:", e);
      // You might want to display a user-friendly error message here
      return; // Exit if AuthUI can't be created
    }

    const uiConfig = {
      callbacks: {
        signInSuccessWithAuthResult: async (authResult) => {
          const user = authResult.user;
          console.log("FirebaseAuthUI: FirebaseUI Sign-In successful. User UID:", user.uid);

          // Attempt to get ID token for backend verification
          let idToken = null;
          try {
            idToken = await user.getIdToken();
            console.log("FirebaseAuthUI: ID Token obtained.");
          } catch (tokenError) {
            console.error("FirebaseAuthUI: Error getting ID token:", tokenError);
            // Decide error handling, but proceed with profile check if token fails.
          }

          // Backend verification (if needed, ensure your backend is running)
          if (idToken) {
            try {
              const response = await fetch(
                "http://localhost:8080/api/auth/verify",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${idToken}`,
                  },
                  body: JSON.stringify({ uid: user.uid }),
                }
              );
              const result = await response.json();
              console.log("FirebaseAuthUI: ✅ Backend response:", result);
            } catch (error) {
              console.error("FirebaseAuthUI: ❌ Error sending ID token to backend:", error);
              // Backend verification failure. Decide if this should stop login.
              // For now, we'll proceed to profile check regardless for frontend flow.
            }
          } else {
              console.warn("FirebaseAuthUI: Skipping backend verification as ID token could not be obtained.");
          }

          // IMPORTANT CHANGE: DO NOT navigate directly from here.
          // The App.jsx's PrivateRoute (which consumes AuthContext's state) will handle the redirection.
          console.log("FirebaseAuthUI: Sign-in success. Allowing AuthContext and PrivateRoute to handle navigation.");
          return false; // Return false to prevent FirebaseUI's default redirect to signInSuccessUrl
        },

        uiShown: () => {
          console.log("FirebaseAuthUI: UI widget shown.");
          const loaderElement = document.getElementById("loader");
          if (loaderElement) {
              loaderElement.style.display = "none";
          } else {
              console.warn("FirebaseAuthUI: Loader element not found.");
          }
        },
      },

      signInFlow: "popup", // Or "redirect" if you prefer
      // signInSuccessUrl is still defined but will be ignored due to `return false` in callback
      // This is a fallback in case return false doesn't work for some reason (e.g., FirebaseUI update)
      signInSuccessUrl: "/dashboard", 
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
      tosUrl: "https://www.reddit.com", // Replace with your actual TOS URL
      privacyPolicyUrl: "/privacy", // Replace with your actual privacy policy URL
    };

    // Start the FirebaseUI widget.
    try {
        console.log("FirebaseAuthUI: Starting FirebaseUI widget.");
        ui.start("#firebaseui-auth-container", uiConfig);
    } catch (startError) {
        console.error("FirebaseAuthUI: Error starting FirebaseUI widget:", startError);
    }


    // Cleanup FirebaseUI on component unmount
    return () => {
      console.log("FirebaseAuthUI: Cleaning up FirebaseUI.");
      if (ui) {
        ui.reset(); // Stop and clean up the AuthUI widget
      }
    };
  }, [authContext]); // Depend on authContext itself, as its properties might change (e.g., checkProfileCompletion func identity)

  return (
    <div className="auth-container">
      <div className="hero-section">
        <h1 className="heading">Welcome to Medizap</h1>
        <p className="subheading">
          Your comprehensive platform for modern healthcare management.
        </p>
        <p className="tagline">
          Streamlining patient care, appointments, and medical records.
        </p>
      </div>

      <div className="auth-section">
        <h2 className="auth-title">Sign In</h2>
        <p className="auth-description">
          Please use your preferred method to access your dashboard.
        </p>
        <div className="form-container">
          {/* This is the div where FirebaseUI will render its content */}
          <div id="firebaseui-auth-container" className="firebase-ui-widget"></div>
          {/* Loader element, hidden by FirebaseUI when ready */}
          <div id="loader" className="loader">Loading authentication UI...</div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseAuthUI;
