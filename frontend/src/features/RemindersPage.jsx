// src/features/RemindersPage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import '../styles/RemindersPage.css';
import notificationSound from '../assets/sounds/notification.mp3'; // Import your local MP3 file

const RemindersPage = () => {
  // Get reminders state and CRUD functions from DashboardLayout's context
  const { reminders, formatDateTime, addReminder, updateReminder, deleteReminder, loadingReminders } = useOutletContext();

  const [editingReminder, setEditingReminder] = useState(null); // State to manage editing a reminder
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formDateTime, setFormDateTime] = useState('');
  const [notifiedReminders, setNotifiedReminders] = useState({}); // To keep track of reminders for which sound has been played
  const [playingReminderId, setPlayingReminderId] = useState(null); // New state to track which reminder's due status is causing the sound to loop

  // Ref for the audio element
  const audioRef = useRef(null);

  // Use the imported local MP3 file for the sound source
  const soundSource = notificationSound; // Use the imported sound

  // Effect to populate form when editingReminder changes
  useEffect(() => {
    if (editingReminder) {
      setFormTitle(editingReminder.title || '');
      setFormMessage(editingReminder.message);
      // Format Date object to "YYYY-MM-DDTHH:mm" for datetime-local input
      const dt = new Date(editingReminder.dateTime);
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      setFormDateTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    } else {
      // Clear form when not editing
      setFormTitle('');
      setFormMessage('');
      setFormDateTime('');
    }
  }, [editingReminder]);

  // Effect to check for upcoming reminders and play sound
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let foundDueAndNotNotified = false;

      // Prioritize finding a new, undismissed, due reminder that hasn't triggered sound yet
      for (const rem of reminders) {
        if (!rem.isDismissed && rem.dateTime.getTime() <= now && !notifiedReminders[rem.id]) {
          foundDueAndNotNotified = true;
          // If no sound is currently looping OR a different reminder is due, start the sound for this new reminder
          if (!playingReminderId || playingReminderId !== rem.id) {
            if (audioRef.current) {
              audioRef.current.loop = true; // Set to loop
              audioRef.current.play().catch(e => {
                console.warn("Autoplay prevented (RemindersPage):", e.name, e.message);
              });
              console.log(`General notification triggered for reminder: ${rem.title || rem.message}`);
              setPlayingReminderId(rem.id); // Mark this reminder as the one currently causing the sound
            }
          }
          setNotifiedReminders(prev => ({ ...prev, [rem.id]: true })); // Mark as notified
          break; // Only play sound for the first due reminder found
        }
      }

      // If no currently playing reminder is found to be due anymore, stop the sound
      if (!foundDueAndNotNotified && playingReminderId) {
        // This handles cases where the last playing reminder was dismissed or is no longer considered due
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0; // Reset to start
          audioRef.current.loop = false; // Turn off loop
        }
        setPlayingReminderId(null); // Clear the playing reminder ID
      }

    }, 1000); // Check more frequently (every 1 second) for better responsiveness

    return () => {
        clearInterval(interval);
        // On component unmount, ensure sound is stopped
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.loop = false;
        }
    };
  }, [reminders, notifiedReminders, playingReminderId]); // Re-run effect if reminders, notified status, or playing ID changes

  const handleCreateOrUpdateReminder = async (e) => { // Made async because it interacts with Firestore
    e.preventDefault();

    if (!formMessage || !formDateTime) {
      console.warn('Reminder creation failed: Please enter a message and date/time for the reminder.');
      return;
    }

    const reminderData = {
      dateTime: new Date(formDateTime), // Convert input string to Date object
      message: formMessage,
      title: formTitle,
      isDismissed: editingReminder ? editingReminder.isDismissed : false, // Keep dismissed status if updating, else false
    };

    if (editingReminder) {
      await updateReminder(editingReminder.id, reminderData); // Use updateReminder from context
      setEditingReminder(null); // Exit editing mode
    } else {
      await addReminder(reminderData); // Use addReminder from context
    }

    // Clear form fields after submission
    setFormTitle('');
    setFormMessage('');
    setFormDateTime('');
  };

  const handleEditReminder = (reminder) => {
    setEditingReminder(reminder); // Set the reminder to be edited
  };

  const handleDeleteReminder = async (id) => { // Made async
    console.warn('Confirm delete reminder? (Deletion proceeded directly for Canvas environment)');
    await deleteReminder(id); // Use deleteReminder from context
    // If the deleted reminder was causing the sound, stop it
    if (playingReminderId === id) {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.loop = false;
        }
        setPlayingReminderId(null);
    }
  };

  const handleDismissReminder = async (id) => {
    // Dismissing simply sets isDismissed to true
    await updateReminder(id, { isDismissed: true });
    // Remove from notified list to prevent future re-notification if somehow un-dismissed
    setNotifiedReminders(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });

    // If the dismissed reminder was causing the sound, stop it
    if (playingReminderId === id) {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.loop = false;
        }
        setPlayingReminderId(null);
    }
  };

  // Function to manually test the sound (for debugging autoplay issues)
  const testSound = () => {
    if (audioRef.current) {
      audioRef.current.loop = false; // Don't loop test sound by default
      audioRef.current.play().catch(e => {
        console.error("Error playing test sound:", e);
        console.warn("Browser prevented autoplay. Please click anywhere on the page first, or check browser media settings.");
      });
    }
  };

  // Filter and sort reminders for display
  const upcomingReminders = reminders
    .filter(rem => !rem.isDismissed && rem.dateTime.getTime() > Date.now())
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()); // Sort upcoming by time (earliest first)

  const pastReminders = reminders
    .filter(rem => !rem.isDismissed && rem.dateTime.getTime() <= Date.now()) // Only non-dismissed past reminders
    .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime()); // Sort past by newest first

  // Show a loading message while reminders are being fetched from Firebase
  if (loadingReminders) {
    return (
      <div className="reminders-page-container">
        <h1>Your Reminders</h1>
        <p className="loading-message">Loading reminders from Firebase...</p>
      </div>
    );
  }

  return (
    <div className="reminders-page-container">
      <h1>Your Reminders</h1>

      <div className="create-reminder-card dashboard-card">
        <h2>{editingReminder ? 'Edit Reminder' : 'Add New Reminder'}</h2>
        <form onSubmit={handleCreateOrUpdateReminder}>
          <div className="form-group">
            <label htmlFor="title">Title (Optional)</label>
            <input
              type="text"
              id="title"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="e.g., Medication Reminder"
            />
          </div>
          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              value={formMessage}
              onChange={(e) => setFormMessage(e.target.value)}
              rows="3"
              placeholder="e.g., Take your pills now!"
              required
            ></textarea>
          </div>
          <div className="form-group">
            <label htmlFor="datetime">Date & Time</label>
            <input
              type="datetime-local"
              id="datetime"
              value={formDateTime}
              onChange={(e) => setFormDateTime(e.target.value)}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="create-button">
              {editingReminder ? 'Update Reminder' : 'Set Reminder'}
            </button>
            {editingReminder && (
              <button
                type="button"
                className="cancel-edit-button"
                onClick={() => setEditingReminder(null)}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="reminders-list-card dashboard-card">
        <h2>Upcoming Reminders</h2>
        {upcomingReminders.length === 0 ? (
          <p className="no-reminders-message">No upcoming reminders.</p>
        ) : (
          <div className="reminder-items-grid">
            {upcomingReminders.map((reminder) => (
              <div key={reminder.id} className="reminder-item dashboard-card">
                <h3>{reminder.title || "Reminder"}</h3>
                <p>{reminder.message}</p>
                <p className="reminder-time">
                  Due: {formatDateTime(reminder.dateTime)}
                </p>
                <div className="reminder-actions">
                  <button className="edit-button" onClick={() => handleEditReminder(reminder)}>Edit</button>
                  <button className="delete-button" onClick={() => handleDeleteReminder(reminder.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="reminders-list-card dashboard-card">
        <h2>Past Reminders (Not Dismissed)</h2>
        {pastReminders.length === 0 ? (
          <p className="no-reminders-message">No non-dismissed past reminders.</p>
        ) : (
          <div className="reminder-items-grid">
            {pastReminders.map((reminder) => (
              <div key={reminder.id} className="reminder-item dashboard-card past-reminder">
                <h3>{reminder.title || "Reminder"}</h3>
                <p>{reminder.message}</p>
                <p className="reminder-time">
                  Due: {formatDateTime(reminder.dateTime)}
                </p>
                <div className="reminder-actions">
                  <button className="edit-button" onClick={() => handleEditReminder(reminder)}>Edit</button>
                  <button className="dismiss-button" onClick={() => handleDismissReminder(reminder.id)}>Dismiss</button> {/* New Dismiss Button */}
                  <button className="delete-button" onClick={() => handleDeleteReminder(reminder.id)}>Delete</button>
                </div>
                <span className="past-badge">Past Due</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audio element for notification sound */}
      <audio ref={audioRef} src={soundSource} preload="auto" />

      {/* Button to manually test the sound */}
      <button className="test-sound-button" onClick={testSound}>Test Notification Sound</button>
    </div>
  );
};

export default RemindersPage;
