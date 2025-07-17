// src/components/ReminderPopup.jsx
import React, { useEffect, useRef } from 'react';
import '../styles/ReminderPopup.css'; // You might need to check/create this CSS file
import notificationSound from '../assets/sounds/notification.mp3'; // Import your local MP3 file

const ReminderPopup = ({ reminder, onDismiss }) => {
  const popupRef = useRef(null);
  const audioRef = useRef(null); // Ref for the audio element

  // Use the imported local MP3 file for the sound source
  const soundSource = notificationSound; 

  // Effect to play sound when reminder is shown
  useEffect(() => {
    if (reminder && audioRef.current) {
      audioRef.current.loop = true; // Set to loop for continuous playback
      audioRef.current.play().catch(e => {
        console.warn("Autoplay prevented for ReminderPopup:", e.name, e.message);
        // Inform the user that they might need to interact with the page to enable sound
        // For example, display a small message: "Click anywhere to enable sound"
      });
    }
    // Pause and reset audio when popup is dismissed or component unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0; // Reset to start
        audioRef.current.loop = false; // Turn off loop
      }
    };
  }, [reminder]); // Re-run effect when reminder prop changes (i.e., popup is shown/hidden)

  // REMOVED: The useEffect that handled clicking outside the popup.
  // The popup will now only dismiss when the onDismiss function is explicitly called,
  // which is currently linked to the "Dismiss" button and the "close-btn" (X icon).

  if (!reminder) {
    return null; // Don't render the popup if there's no reminder data
  }

  // Ensure reminder.dateTime is a Date object for display
  const displayTime = reminder.dateTime instanceof Date
    ? reminder.dateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : 'N/A';

  const displayDate = reminder.dateTime instanceof Date
    ? reminder.dateTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';

  return (
    <div className="reminder-overlay">
      <div className="reminder-popup-card" ref={popupRef}>
        <div className="popup-header">
          <h3>Reminder Due!</h3>
          <button className="close-btn" onClick={onDismiss}>&times;</button>
        </div>
        <div className="popup-body">
          <p className="popup-time">{displayDate} at {displayTime}</p>
          <p className="popup-title">{reminder.title || "Reminder"}</p>
          <p className="popup-message">{reminder.message}</p>
        </div>
        <div className="popup-actions">
          <button className="dismiss-btn" onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
      {/* Audio element for notification sound, linked to audioRef */}
      <audio ref={audioRef} src={soundSource} preload="auto" />
    </div>
  );
};

export default ReminderPopup;
