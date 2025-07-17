// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'; // Import Firestore functions
import { app, db } from '../firebase'; // Import your initialized Firebase app and db instances

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Initial loading state for auth (Firebase auth listener)
  const [isProfileComplete, setIsProfileComplete] = useState(null); // null: checking, true: complete, false: incomplete
  const [profileActionRequired, setProfileActionRequired] = useState(false); // true if profile must be completed
  const [profileChecked, setProfileChecked] = useState(false); // NEW STATE: True once profile check is done

  const auth = getAuth(app); // Get auth instance from your initialized app

  // Determine the app ID for Firestore path (using projectId from firebase config)
  const appId = app?.options?.projectId || 'default-app-id';

  // Function to check if a user's profile exists in Firestore
  const checkProfileCompletion = async (uid) => {
    if (!db || !uid) {
      console.warn("AuthContext: Firestore or UID not available to check profile completion.");
      return false;
    }
    const userProfileDocRef = doc(db, `artifacts/${appId}/users/${uid}/profile_data`, uid);
    try {
      const docSnap = await getDoc(userProfileDocRef);
      return docSnap.exists();
    } catch (error) {
      console.error("AuthContext: Error checking profile completion:", error);
      // In case of error, assume profile is incomplete for safety
      return false;
    }
  };

  // Function to explicitly mark profile as completed (called from ProfilePage)
  const markProfileAsCompleted = () => {
    setIsProfileComplete(true);
    setProfileActionRequired(false);
    // Ensure profileChecked is true when profile is explicitly marked complete
    setProfileChecked(true); 
    console.log("AuthContext: Profile marked as completed.");
  };

  // --- Authentication Functions (Keep as is, onAuthStateChanged handles state updates) ---
  const signInWithGoogle = async () => {
    setLoadingAuth(true); // Indicate loading for the sign-in process
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("AuthContext: Google Sign-In successful:", result.user.uid);
      // The onAuthStateChanged listener below will pick up the user and handle profile checks
      setCurrentUser(result.user); 
      // No need to set profile related states directly here, onAuthStateChanged will do it
      // The return value here is mainly for the component initiating the sign-in (FirebaseAuthUI)
      // to know if it's a new user, though it's not strictly necessary for this navigation flow.
      const profileExistsAtSignIn = await checkProfileCompletion(result.user.uid);
      return { user: result.user, isNewUser: !profileExistsAtSignIn };

    } catch (error) {
      console.error("AuthContext: Error signing in with Google:", error.message);
      throw error; 
    } finally {
      // setLoadingAuth(false); // Moved into onAuthStateChanged to ensure profile check is done before marking "loaded"
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setIsProfileComplete(null); 
      setProfileActionRequired(false);
      setProfileChecked(false); // Reset profileChecked on logout
      console.log("AuthContext: User logged out.");
    } catch (error) {
      console.error("AuthContext: Error logging out:", error.message);
    }
  };

  // Effect to listen for auth state changes on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setProfileChecked(false); // Reset to false at the start of a new auth state check
      if (user) {
        const profileExists = await checkProfileCompletion(user.uid);
        setIsProfileComplete(profileExists);
        setProfileActionRequired(!profileExists);
        console.log(`AuthContext: Auth state changed. User ${user.uid}, Profile exists: ${profileExists}, Action Required: ${!profileExists}`);
      } else {
        setIsProfileComplete(null); 
        setProfileActionRequired(false);
        console.log("AuthContext: Auth state changed. No user logged in.");
      }
      setProfileChecked(true); // NEW: Mark profile check as complete
      setLoadingAuth(false); // Auth (and profile) check is complete
    });

    return () => unsubscribe(); 
  }, [auth, db, appId]); 

  const value = {
    currentUser,
    loadingAuth,
    isProfileComplete,
    profileActionRequired, 
    profileChecked, // NEW: Expose profileChecked state
    signInWithGoogle,
    logout,
    checkProfileCompletion,
    markProfileAsCompleted,
  };

  return (
    <AuthContext.Provider value={value}>
      {children} 
    </AuthContext.Provider>
  );
};
