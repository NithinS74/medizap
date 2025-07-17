// src/components/HomePage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate(); // Initialize the navigate hook

  const handleLoginClick = () => {
    navigate('/login'); // Navigate to the /login route
  };

  return (
    <div style={{
      textAlign: 'center',
      paddingTop: '5rem',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>Welcome to Medizap!</h1>
      <p>Your streamlined healthcare management solution.</p>
      <div style={{ marginTop: '2rem' }}>
        <button
          onClick={handleLoginClick}
          style={{
            padding: '10px 20px',
            fontSize: '1.2rem',
            backgroundColor: '#007bff', /* A nice blue color */
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          Login
        </button>
      </div>
      <p style={{ marginTop: '3rem', fontSize: '0.9rem', color: '#666' }}>
        Simplifying healthcare for a healthier you.
      </p>
    </div>
  );
};

export default HomePage;