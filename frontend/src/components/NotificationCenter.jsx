// src/components/NotificationCenter.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
// REMOVED: import { useOutletContext } from 'react-router-dom'; // This line MUST be removed
import { useAuth } from '../contexts/AuthContext';
// REMOVED: No need to import db or collection directly here anymore, as updateReminder is passed via props
// import { db } from '../firebase';
// import { collection, query, where, onSnapshot } from 'firebase/firestore';
import '../styles/NotificationCenter.css';
import ReminderPopup from './ReminderPopup'; // Import ReminderPopup
import notificationSound from '../assets/sounds/notification.mp3'; // Ensure this path is correct

// Updated props: now accepts reminders and updateReminder directly
// These props are passed from DashboardLayout.jsx
const NotificationCenter = ({ reminders, updateReminder, onOpenNotifications }) => {
  const { currentUser } = useAuth();

  const [unreadCount, setUnreadCount] = useState(0);
  const [showReminderPopup, setShowReminderPopup] = useState(false);
  const [currentReminderPopup, setCurrentReminderPopup] = useState(null);
  const popupTimeoutRef = useRef(null); // Use ref for timeout ID

  // Ref for the audio element
  const audioRef = useRef(null);
  const soundSource = notificationSound;

  // Effect to update unread count based on current reminders
  useEffect(() => {
    // Ensure reminders is an array before filtering
    if (!Array.isArray(reminders)) {
        setUnreadCount(0);
        return;
    }

    const activeUnread = reminders.filter(rem =>
      !rem.isDismissed && rem.dateTime.getTime() > Date.now()
    ).length;
    setUnreadCount(activeUnread);
  }, [reminders]);

  // Logic to check for and show past due (but not dismissed) reminders as popups
  useEffect(() => {
    const checkAndShowReminder = () => {
      // Ensure reminders is an array before attempting to iterate
      if (!Array.isArray(reminders) || reminders.length === 0) return;

      const now = Date.now();
      const firstDueReminder = reminders.find(rem =>
        !rem.isDismissed && rem.dateTime.getTime() <= now && rem.id !== currentReminderPopup?.id // Only show if not already showing this one
      );

      if (firstDueReminder && !showReminderPopup) {
        // Clear any existing timeout before setting a new one
        if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);

        setCurrentReminderPopup(firstDueReminder);
        setShowReminderPopup(true);

        // Optional: Auto-dismiss popup after a set time if not dismissed by user.
        // The user explicitly wanted it to play until dismissed, so we won't auto-dismiss it from here.
        // The sound in ReminderPopup.jsx will loop until the popup is dismissed.
      }
    };

    // Run check immediately and then periodically
    checkAndShowReminder();
    const intervalId = setInterval(checkAndShowReminder, 5000); // Check every 5 seconds

    return () => {
      clearInterval(intervalId);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current); // Clear timeout on unmount
    };
  }, [reminders, showReminderPopup, currentReminderPopup]); // Dependencies to re-run effect

  const handleDismissPopup = useCallback(async () => {
    // Ensure updateReminder is available before calling it
    if (currentReminderPopup && updateReminder) {
      // Update reminder in Firestore to be dismissed
      await updateReminder(currentReminderPopup.id, { isDismissed: true });
    }
    // Hide the popup and clear the current reminder
    setShowReminderPopup(false);
    setCurrentReminderPopup(null);
    // Clear any pending timeout for this popup
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
  }, [currentReminderPopup, updateReminder]); // Dependencies

  const handleBellClick = () => {
    onOpenNotifications && onOpenNotifications();
    // This function can be used to open a full notification center or navigate
  };

  return (
    <div className="notification-center">
      <button className="notification-bell" onClick={handleBellClick}>
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {/* Render ReminderPopup if it needs to be shown */}
      {showReminderPopup && currentReminderPopup && (
        <ReminderPopup
          reminder={currentReminderPopup}
          onDismiss={handleDismissPopup} // Pass the dismissal handler
        />
      )}
      {/* Audio element for notification sound, linked to audioRef */}
      <audio ref={audioRef} src={soundSource} preload="auto" />
    </div>
  );
};

export default NotificationCenter;
