// src/components/FirebaseAuthUI.jsx
import React, { useEffect } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import * as firebaseui from "firebaseui";
import "firebaseui/dist/firebaseui.css";

import { app } from "../firebase";

// Initialize compat Firebase manually (only once)
if (!firebase.apps.length) {
  firebase.initializeApp(app.options);
}

const FirebaseAuthUI = () => {
  useEffect(() => {
    const uiConfig = {
      callbacks: {
        signInSuccessWithAuthResult: async (authResult) => {
          const user = authResult.user;
          try {
            const idToken = await user.getIdToken(); // 👈 Get Firebase ID token

            // ✅ Send token to your Spring Boot backend
            const response = await fetch(
              "http://localhost:8080/api/auth/verify",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${idToken}`, // 👈 Token in Authorization header
                },
                body: JSON.stringify({ uid: user.uid }), // Optional additional info
              },
            );

            const result = await response.json();
            console.log("✅ Backend response:", result);
          } catch (error) {
            console.error("❌ Error sending ID token to backend:", error);
          }

          return false; // Stay on the page (no redirect)
        },

        uiShown: () => {
          document.getElementById("loader").style.display = "none";
        },
      },

      signInFlow: "popup",
      signInSuccessUrl: "https://www.google.com", // Optional: change or remove redirect
      signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
      ],
      tosUrl: "https://www.reddit.com",
      privacyPolicyUrl: "/privacy",
    };

    const ui = firebaseui.auth.AuthUI.getInstance() ||
      new firebaseui.auth.AuthUI(firebase.auth());

    ui.start("#firebaseui-auth-container", uiConfig);

    return () => ui.reset(); // Clean up on unmount
  }, []);

  return (
    <div style={{ textAlign: "center", paddingTop: "2rem" }}>
      <h1>Welcome to Medizap</h1>
      <div id="firebaseui-auth-container" />
      <div id="loader">Loading...</div>
    </div>
  );
};

export default FirebaseAuthUI;
