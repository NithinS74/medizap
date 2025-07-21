// src/features/ChatbotPage.jsx
// This component is now optimized for a full-page experience, relying on parent layout for sizing.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/ChatbotPage.css'; // Import the new CSS file for the full page
import '../styles/LoadingSpinner.css'; // Assuming you have a CSS for the spinner
import { getAuth } from 'firebase/auth'; // NEW: Import getAuth for Firebase authentication

const ChatbotPage = () => {
  // For a dedicated page, the chatbot is always "open", so we removed the isOpen state.
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New loading state
  const messagesEndRef = useRef(null);
  const auth = getAuth(); // NEW: Initialize Firebase Auth instance

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessageToApi = useCallback(async (endpointType) => {
    if (!inputValue.trim()) return;

    const userMessage = { id: Date.now(), text: inputValue, sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue('');
    setIsLoading(true); // Start loading

    try {
      // Get the current authenticated user and their ID token
      const user = auth.currentUser; // NEW: Get current authenticated user
      if (!user) {
        throw new Error("User not authenticated. Please log in to use the chatbot.");
      }
      const idToken = await user.getIdToken(); // NEW: This fetches the Firebase ID token

      // Determine the correct API endpoint based on button clicked
      const apiUrl = endpointType === 'symptoms' 
        ? 'http://localhost:8000/predict-symptoms' // For disease -> symptoms/info
        : 'http://localhost:8000/predict-disease';   // For symptoms -> disease/info

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // NEW: Include the ID token in the Authorization header
        },
        body: JSON.stringify({ text: userMessage.text }),
      });

      if (!response.ok) {
        // Handle HTTP errors
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      // Parse the response, which is now expected to be structured MedicalResponse
      const data = await response.json();
      
      const botResponses = [];

      // Add the main message from the backend (e.g., "Found information for...")
      if (data.message) {
        botResponses.push({ 
          id: Date.now() + '_msg', 
          text: data.message, 
          sender: 'bot', 
          isHtml: false // This is a plain text message
        });
      }

      if (data.results && data.results.length > 0) {
        // Iterate through each medical info result and format it into an HTML card
        data.results.forEach((item, index) => {
          const formattedResult = (
            <div key={item.Disease + index} className="medical-info-card">
              <h4>{item.Disease}</h4>
              <p><strong>Description:</strong> {item.Description}</p>
              <p><strong>Symptoms:</strong> {item.Symptoms}</p>
              <p><strong>Medicines:</strong> {item.Medicines}</p>
            </div>
          );
          botResponses.push({ 
            id: Date.now() + '_res_' + index, 
            content: formattedResult, 
            sender: 'bot', 
            isHtml: true // Mark as HTML content
          });
        });
      } else if (!data.message) { // If no results and no specific message was set
        botResponses.push({ id: Date.now() + '_nores', text: "No relevant information found for your query.", sender: 'bot' });
      }

      // Always add the disclaimer
      botResponses.push({ id: Date.now() + '_disclaimer', text: data.disclaimer, sender: 'bot', isDisclaimer: true });

      setMessages((prevMessages) => [...prevMessages, ...botResponses]);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { id: Date.now() + '_err', text: `Sorry, there was an error processing your request: ${error.message}. Please try again.`, sender: 'bot' },
      ]);
    } finally {
      setIsLoading(false); // End loading
    }
  }, [inputValue, auth.currentUser]); // NEW: Add auth.currentUser to dependencies to re-run effect if user changes


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessageToApi('disease'); 
    }
  };

  return (
    // Main container for the full chatbot page. This div will now take 100% of its parent's dimensions.
    <div className="full-chatbot-page"> 
      {/* Main chat window, adapting to full page styles */}
      <div className="full-page-chat-window"> 
        <div className="full-page-chat-header"> 
          <h3>Medizap Health Assistant </h3>
        </div>
        <div className="full-page-chat-messages"> 
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`full-page-chat-message ${message.sender === 'user' ? 'user' : 'bot'} ${message.isDisclaimer ? 'isDisclaimer' : ''}`}
            >
              {message.isHtml ? message.content : message.text}
            </div>
          ))}
          {isLoading && (
            <div className="full-page-chat-message bot"> 
              <div className="loading-spinner"></div> 
            </div>
          )}
          <div ref={messagesEndRef} /> 
        </div>
        <div className="full-page-chat-input-form"> 
          <textarea
            className="full-page-chat-input" 
            placeholder="Type your symptoms or disease name..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            rows="1" 
          />
          <div className="full-page-chatbot-buttons"> 
              <button
                  className="full-page-send-button" 
                  onClick={() => sendMessageToApi('symptoms')}
                  disabled={isLoading}
              >
                  Get Info (by Disease)
              </button>
              <button
                  className="full-page-send-button" 
                  onClick={() => sendMessageToApi('disease')}
                  disabled={isLoading}
              >
                  Find Disease (by Symptoms)
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
