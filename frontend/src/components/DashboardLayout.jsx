// src/components/DashboardLayout.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { auth, db, app } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';

import '../styles/DashboardLayout.css';
import NotificationCenter from './NotificationCenter';

const DashboardLayout = () => {
    const { currentUser, loadingAuth, profileActionRequired } = useAuth();
    const [loadingReminders, setLoadingReminders] = useState(true);
    const [reminders, setReminders] = useState([]);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark';
    });
    const location = useLocation();

    const appId = app?.options?.projectId || 'default-app-id';

    // Effect to apply theme class to body and save to localStorage
    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // Effect to toggle body class for mobile sidebar overlay
    useEffect(() => {
        if (isSidebarOpen) {
            document.body.classList.add('sidebar-open');
        } else {
            document.body.classList.remove('sidebar-open');
        }
        return () => {
            document.body.classList.remove('sidebar-open'); // Cleanup on unmount
        };
    }, [isSidebarOpen]);


    // Firestore listener for reminders
    useEffect(() => {
        console.log("DashboardLayout useEffect (Reminders): Effect triggered.");

        if (!currentUser?.uid) {
            console.log("DashboardLayout useEffect (Reminders): No current user UID, clearing reminders.");
            setReminders([]);
            setLoadingReminders(false);
            return;
        }

        if (!db) {
            console.error("DashboardLayout useEffect (Reminders): Firestore DB instance is not available. Cannot fetch reminders.");
            setLoadingReminders(false);
            return;
        }

        setLoadingReminders(true);
        const remindersCollectionPath = `artifacts/${appId}/users/${currentUser.uid}/reminders`;
        console.log(`DashboardLayout useEffect (Reminders): Setting up listener for path: ${remindersCollectionPath}`);

        const remindersCollectionRef = collection(db, remindersCollectionPath);
        const q = query(remindersCollectionRef, orderBy('dateTime', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                console.log(`DashboardLayout useEffect (Reminders): No reminders found for UID: ${currentUser.uid}. Collection is empty.`);
            }
            const fetchedReminders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dateTime: data.dateTime && data.dateTime.toDate ? data.dateTime.toDate() : (data.dateTime ? new Date(data.dateTime) : new Date())
                };
            });
            setReminders(fetchedReminders);
            setLoadingReminders(false);
            console.log(`DashboardLayout useEffect (Reminders): Fetched ${fetchedReminders.length} reminders for UID: ${currentUser.uid}`);
        }, (error) => {
            console.error("DashboardLayout useEffect (Reminders): Error fetching reminders:", error.code, error.message);
            if (error.code === "permission-denied") {
                console.error("DashboardLayout useEffect (Reminders): PERMISSION DENIED! Check your Firestore Security Rules.");
            }
            setLoadingReminders(false);
        });

        return () => {
            console.log(`DashboardLayout useEffect (Reminders): Unsubscribing from reminder listener for UID: ${currentUser.uid}`);
            unsubscribe();
        };
    }, [currentUser?.uid, appId, db]);

    const formatDateTime = useCallback((date) => {
        if (!(date instanceof Date)) return 'Invalid Date';
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };
        return date.toLocaleDateString('en-US', options);
    }, []);

    const addReminder = useCallback(async (newReminder) => {
        if (!currentUser?.uid) { console.error("Cannot add reminder: User not authenticated."); return; }
        if (!db) { console.error("Cannot add reminder: Firestore DB not available."); return; }
        try {
            console.log("Adding reminder to Firestore:", newReminder);
            await addDoc(collection(db, `artifacts/${appId}/users/${currentUser.uid}/reminders`), newReminder);
            console.log("Reminder added successfully!");
        } catch (error) {
            console.error("Error adding reminder:", error);
        }
    }, [currentUser?.uid, appId, db]);

    const updateReminder = useCallback(async (id, updatedFields) => {
        if (!currentUser?.uid) { console.error("Cannot update reminder: User not authenticated."); return; }
        if (!db) { console.error("Cannot update reminder: Firestore DB not available."); return; }
        try {
            console.log(`Updating reminder ${id} with fields:`, updatedFields);
            await updateDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/reminders`, id), updatedFields);
            console.log("Reminder updated successfully!");
        } catch (error) {
            console.error("Error updating reminder:", error);
        }
    }, [currentUser?.uid, appId, db]);

    const deleteReminder = useCallback(async (id) => {
        if (!currentUser?.uid) { console.error("Cannot delete reminder: User not authenticated."); return; }
        if (!db) { console.error("Cannot delete reminder: Firestore DB not available."); return; }
        try {
            console.log(`Deleting reminder with ID: ${id}`);
            await deleteDoc(doc(db, `artifacts/${appId}/users/${currentUser.uid}/reminders`, id));
            console.log("Reminder deleted successfully!");
        } catch (error) {
            console.error("Error deleting reminder:", error);
        }
    }, [currentUser?.uid, appId, db]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const toggleTheme = () => {
        setIsDarkMode(prevMode => !prevMode);
    };

    const handleEmergencyClick = () => {
        // IMPORTANT: Replace alert() with a custom modal or navigation in a real app
        alert("Emergency button clicked! Implement emergency contact or quick help features here.");
    };

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location]);

    if (loadingAuth) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                backgroundColor: 'var(--primary-bg)',
                color: 'var(--text-primary)',
                fontSize: '1.5rem',
            }}>
                Authenticating user...
            </div>
        );
    }

    if (!currentUser) {
        return null;
    }

    return (
        <div className="dashboard-layout">
            <header className="dashboard-header">
                <button className="sidebar-toggle" onClick={toggleSidebar}>
                    ☰
                </button>
                <h1 className="app-title">Medizap</h1>
                <div className="header-user-info">
                    <span>Welcome, {currentUser.displayName || currentUser.email || 'User'}</span>
                    <NotificationCenter
                        reminders={reminders}
                        updateReminder={updateReminder}
                        onOpenNotifications={() => { /* Implement navigation to reminders or a modal */ }}
                    />
                    {/* Emergency Button - kept in header */}
                    <button className="emergency-button" onClick={handleEmergencyClick}>&#9888;</button> {/* Unicode Warning Sign */}
                </div>
            </header>

            <div className="dashboard-main-area">
                <aside className={`dashboard-sidebar ${isSidebarOpen ? 'open' : ''}`}>
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
                        
                        
                        <button onClick={toggleTheme} className="sidebar-theme-toggle">
                            {isDarkMode ? '🌞 Light Mode' : '🌙 Dark Mode'}
                        </button>
                    </nav>
                    {/* Logout button moved to sidebar, at the bottom */}
                    <button onClick={handleLogout} className="logout-button sidebar-logout-button">Logout</button>
                </aside>

                <main className="dashboard-content">
                    <Outlet context={{ reminders, formatDateTime, addReminder, updateReminder, deleteReminder, loadingReminders }} />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
