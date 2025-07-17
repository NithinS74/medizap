// src/components/PharmacyMap.jsx

import React, { useState, useEffect } from 'react';
import '../styles/DashboardHome.css'; // Reusing some dashboard styles for consistency

const PharmacyMap = () => {
  // This data would typically come from an API call in a real application
  // For now, we'll use the data I retrieved for you.
  const [pharmacies, setPharmacies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Simulating the data fetch from the maps_local tool output
  useEffect(() => {
    // Simulate a network delay
    const fetchData = async () => {
      setLoading(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading time

        const fetchedPharmacies = [
          {
            name: 'MedPlus Global Village Road',
            address: 'No 23, Khata No 172/173/174/22/4B/23, Near, Global Village Rd, BHEL Layout, Rajarajeshwari Nagar, Bengaluru, Karnataka 560098',
            distance: '550m',
            rating: '3.4',
            phone_number: '+91 63669 60497',
            url: 'https://www.medplusmart.com/',
            map_url: 'https://maps.google.com/?cid=15688542805308501236' // Provided by tool, not for direct use in React map
          },
          {
            name: 'Apollo Pharmacy Beml Layout Rr Nagar Bangalore',
            address: '1589, Kenchena Halli Rd, near NeuBleu Technologies, Pattanagere, Rajarajeshwari Nagar, Bengaluru, Karnataka 560098',
            distance: '600m',
            rating: '4.6',
            phone_number: '+91 74119 74934',
            url: 'https://www.apollopharmacy.in/?utm_source=gmb&utm_medium=organic&utm_campaign=sulekhapromanage-apollo-pharmacy',
            map_url: 'https://maps.google.com/?cid=4704983620411363511'
          },
          {
            name: 'Apollo Pharmacy R R Nagar',
            address: 'Ground Floor, No 2181/877, Kenchena Halli Rd, near Bombay Kulfis, Remco Bhel Layout, Ideal Homes Twp, Rajarajeshwari Nagar, Bengaluru, Karnataka 560098',
            distance: '750m',
            rating: '3.2',
            phone_number: '+91 80 2295 1599',
            url: 'https://www.apollopharmacy.in/?utm_source=gmb&utm_medium=organic&utm_campaign=sulekhapromanage-apollo-pharmacy',
            map_url: 'https://maps.google.com/?cid=8046262281081768599'
          },
          {
            name: 'Apollo Pharmacy Kenchanahalli Bangalore',
            address: 'Ground Floor, Near KRS Endeavour, Kenchenahalli, BHEL Layout, Rajarajeshwari Nagar, Bengaluru, Karnataka 560098',
            distance: '850m',
            rating: '5.0',
            phone_number: '+91 63649 08167',
            url: 'https://www.apollopharmacy.in/',
            map_url: 'https://maps.google.com/?cid=17439448179732113793'
          },
          {
            name: 'Aster Pharmacy - Rajarajeshwari Nagar',
            address: 'No-619/40, Katha No-24, Sai Lotus BEML Main Rd, 5th Stage, Channasandra, Rajarajeshwari Nagar, Bengaluru, Karnataka 560098',
            distance: '2.2 km',
            rating: '4.9',
            phone_number: '+91 89517 59069',
            url: 'https://asterpharmacy.in/',
            map_url: 'https://maps.google.com/?cid=1826729883804264638'
          }
        ];
        setPharmacies(fetchedPharmacies);
      } catch (err) {
        setError("Failed to load pharmacy data.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-card chart-placeholder-card">
        <h2 className="card-title">Nearby Pharmacies</h2>
        <div className="chart-area">
          <p>Loading pharmacy data and map placeholder...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card chart-placeholder-card">
        <h2 className="card-title">Nearby Pharmacies</h2>
        <div className="chart-area">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card pharmacy-map-card"> {/* New class for this card */}
      <h2 className="card-title">Nearby Pharmacies</h2>
      <div className="map-placeholder" style={{
        width: '100%',
        height: '250px', // Adjust height as needed
        backgroundColor: '#2a2a2a', // Tertiary background for the placeholder
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: '#a0a0a0',
        fontSize: '1.1rem',
        marginBottom: '20px',
        border: '1px dashed var(--border-color)'
      }}>
        <p>Interactive Map Placeholder</p>
      </div>

      <h3 style={{ color: 'var(--text-primary)', marginBottom: '10px', fontSize: '1.2rem' }}>Pharmacies Found:</h3>
      {pharmacies.length > 0 ? (
        <ul className="news-list" style={{ maxHeight: '250px', overflowY: 'auto' }}> {/* Reusing news-list for styling, adding scroll */}
          {pharmacies.map((pharmacy, index) => (
            <li key={index} className="news-item"> {/* Reusing news-item for styling */}
              <p className="news-title" style={{ marginBottom: '5px' }}>
                <strong>{pharmacy.name}</strong>
              </p>
              <span className="news-date">{pharmacy.distance} away</span>
              <p style={{ margin: '5px 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Rating: {pharmacy.rating || 'N/A'}
              </p>
              {pharmacy.url && (
                <a href={pharmacy.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.9rem' }}>
                  Visit Website
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="no-data-message">No pharmacies found nearby.</p>
      )}
    </div>
  );
};

export default PharmacyMap;