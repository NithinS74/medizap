// src/components/UpcomingReminderNotification.jsx
import React from 'react';
import '../styles/UpcomingReminderNotification.css'; // New CSS file for this component

const UpcomingReminderNotification = ({ reminder, formatDateTime }) => {
  // If no reminder is passed, or if it's already dismissed, do not render.
  // This component focuses specifically on 'upcoming' visual notifications.
  if (!reminder || reminder.isDismissed) {
    // console.log("UpcomingReminderNotification: Not rendering as no valid reminder or it's dismissed.");
    return null; 
  }

  // Calculate and format the time until the reminder is due.
  // This provides a dynamic, user-friendly string for upcoming events.
  const timeUntil = () => {
    const now = new Date();
    const diffMs = reminder.dateTime.getTime() - now.getTime(); // Difference in milliseconds

    if (diffMs <= 0) {
      // If the reminder is already due or in the past, indicate it.
      // This component primarily shows *upcoming* but handles edge cases.
      return "Now Due"; 
    }

    const diffMinutes = Math.round(diffMs / (1000 * 60));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "in moments";
    if (diffMinutes < 60) return `in ${diffMinutes} min`;
    if (diffHours < 24) return `in ${diffHours} hr`;
    if (diffDays < 7) return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    
    // Fallback for reminders far in the future
    return `on ${formatDateTime(reminder.dateTime)}`; 
  };

  return (
    <div className="upcoming-reminder-notification">
      <div className="notification-header">
        <span className="notification-icon">🔔</span>
        <h4>Upcoming Reminder</h4>
      </div>
      <p className="notification-title">{reminder.title || "Reminder"}</p>
      <p className="notification-message">{reminder.message}</p>
      <p className="notification-time">{timeUntil()}</p>
    </div>
  );
};

export default UpcomingReminderNotification;
