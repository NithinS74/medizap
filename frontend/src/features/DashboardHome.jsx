// src/features/DashboardHome.jsx
import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom'; // To access reminders for 'upcoming' card
import { getAuth } from 'firebase/auth'; // Import getAuth for API calls
import '../styles/DashboardHome.css'; // New CSS for the dashboard home

const DashboardHome = () => {
  // Access reminders from DashboardLayout context for the Upcoming Appointments card
  const { reminders, formatDateTime } = useOutletContext();
  const auth = getAuth(); // Initialize Firebase Auth

  // State for news updates
  const [newsUpdates, setNewsUpdates] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);

  // Effect to fetch news from the API
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setNewsLoading(true);
        const user = auth.currentUser;
        if (!user) {
          throw new Error("Authentication required to fetch news.");
        }
        const idToken = await user.getIdToken();

        const response = await fetch('http://localhost:8000/news', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch news');
        }

        const data = await response.json();
        // Take only the top 5 articles to keep the card clean
        setNewsUpdates(data.articles.slice(0, 5));
      } catch (error) {
        console.error("Error fetching news:", error);
        setNewsError(error.message);
      } finally {
        setNewsLoading(false);
      }
    };

    fetchNews();
  }, [auth]); // Dependency on auth ensures it re-runs if auth state changes

  // Dummy data for other sections (can be replaced with API calls later)
  const dummyData = {
    patientStats: {
      totalPatients: 1245,
      activePatients: 870,
      newPatientsToday: 15,
      criticalCases: 8,
    },
    appointmentSummary: {
      upcomingToday: 12,
      completedToday: 8,
      canceledToday: 2,
    },
    medicationSupply: {
      lowStockItems: 5,
      expiringSoon: 10,
      refillsDue: 25,
    },
    quickActions: [
      { id: 1, name: 'Schedule New Appointment', icon: '🗓️' },
      { id: 2, name: 'Add New Patient', icon: '➕' },
      { id: 3, name: 'View Patient Records', icon: '📋' },
      { id: 4, name: 'Order Supplies', icon: '🛒' },
    ],
  };

  // Filter for truly upcoming, non-dismissed reminders for the dashboard card
  const actualUpcomingReminders = reminders
    .filter(rem => !rem.isDismissed && rem.dateTime.getTime() > Date.now())
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
    .slice(0, 3); // Show only the top 3 soonest upcoming

  return (
    <>
      {/* Adding a style block for better news card presentation */}
      <style>{`
        .news-list-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          overflow-y: auto;
          max-height: 400px; /* Adjust height as needed */
          padding-right: 10px; /* For scrollbar spacing */
        }
        .news-item-card {
          background-color: #fdfdfd;
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 1rem;
          transition: box-shadow 0.3s ease, transform 0.3s ease;
        }
        .news-item-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .news-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .news-source {
          font-size: 0.75rem;
          font-weight: 600;
          color: #007bff;
          text-transform: uppercase;
        }
        .news-title-link {
          font-size: 1rem;
          font-weight: 700;
          color: #333;
          text-decoration: none;
          line-height: 1.2;
        }
        .news-title-link:hover {
          text-decoration: underline;
        }
        .news-description {
          font-size: 0.875rem;
          color: #666;
          margin: 0.25rem 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2; /* Limit to 2 lines */
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .news-date-formatted {
          font-size: 0.75rem;
          color: #999;
          margin-top: 0.5rem; 
          padding-top: 0.5rem;
          border-top: 1px solid #f0f0f0;
          align-self: flex-start;
        }
      `}</style>
      <div className="dashboard-grid-container">
        {/* Welcome Card */}
        <div className="dashboard-card welcome-card">
          <h2 className="card-title">Welcome Back!</h2>
          <p className="welcome-message">
            Here's a quick overview of your Medizap operations today.
          </p>
          <div className="welcome-stats">
            <p>Active Patients: <span className="stat-value">{dummyData.patientStats.activePatients}</span></p>
            <p>New Patients Today: <span className="stat-value">{dummyData.patientStats.newPatientsToday}</span></p>
          </div>
        </div>

        {/* Patient Statistics Card */}
        <div className="dashboard-card patient-stats-card">
          <h2 className="card-title">Patient Overview</h2>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-value">{dummyData.patientStats.totalPatients}</span>
              <p className="stat-label">Total Patients</p>
            </div>
            <div className="stat-item">
              <span className="stat-value">{dummyData.patientStats.activePatients}</span>
              <p className="stat-label">Active Patients</p>
            </div>
            <div className="stat-item">
              <span className="stat-value critical">{dummyData.patientStats.criticalCases}</span>
              <p className="stat-label">Critical Cases</p>
            </div>
          </div>
        </div>

        {/* Upcoming Appointments Card (uses actual reminder data) */}
        <div className="dashboard-card appointments-card">
          <h2 className="card-title">Upcoming Reminders</h2>
          {actualUpcomingReminders.length > 0 ? (
            <ul className="appointment-list">
              {actualUpcomingReminders.map(rem => (
                <li key={rem.id} className="appointment-item">
                  <span className="appointment-time">{formatDateTime(rem.dateTime)}</span>
                  <span className="appointment-description">{rem.title || rem.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data-message">No upcoming reminders.</p>
          )}
        </div>

        {/* Quick Actions Card */}
        <div className="dashboard-card quick-actions-card">
          <h2 className="card-title">Quick Actions</h2>
          <div className="action-buttons-grid">
            {dummyData.quickActions.map(action => (
              <button key={action.id} className="action-button">
                <span className="action-icon">{action.icon}</span>
                <span className="action-text">{action.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Medication Supply Status Card */}
        <div className="dashboard-card medication-supply-card">
          <h2 className="card-title">Medication Supply</h2>
          <ul className="supply-list">
            <li>Low Stock Items: <span className="supply-value danger">{dummyData.medicationSupply.lowStockItems}</span></li>
            <li>Expiring Soon: <span className="supply-value warning">{dummyData.medicationSupply.expiringSoon}</span></li>
            <li>Refills Due: <span className="supply-value info">{dummyData.medicationSupply.refillsDue}</span></li>
          </ul>
        </div>

        {/* News & Updates Card (Now with live data and improved styling) */}
        <div className="dashboard-card news-card">
          <h2 className="card-title">Latest Health News</h2>
          {newsLoading ? (
            <p className="no-data-message">Loading news...</p>
          ) : newsError ? (
            <p className="no-data-message error-message">{newsError}</p>
          ) : (
            <div className="news-list-container">
              {newsUpdates.map((news, index) => (
                <div key={news.url || index} className="news-item-card">
                  <div className="news-content">
                    {news.source_name && <span className="news-source">{news.source_name}</span>}
                    <a href={news.url} target="_blank" rel="noopener noreferrer" className="news-title-link">
                      {news.title}
                    </a>
                    {news.description && <p className="news-description">{news.description}</p>}
                    <span className="news-date-formatted">
                      {news.published_at ? new Date(news.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Placeholder for Charts/Trends */}
        <div className="dashboard-card chart-placeholder-card">
          <h2 className="card-title">Patient Trends </h2>
          <div className="chart-area">
            <p>Graph/Chart will be displayed here.</p>
            <p className="chart-description">Data visualization for patient visits over time.</p>
          </div>
        </div>

        <div className="dashboard-card chart-placeholder-card">
          <h2 className="card-title">Medication Usage </h2>
          <div className="chart-area">
            <p>Graph/Chart will be displayed here.</p>
            <p className="chart-description">Top prescribed medications.</p>
          </div>
        </div>

      </div>
    </>
  );
};

export default DashboardHome;
