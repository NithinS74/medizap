// src/features/ChatbotUI.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/ChatbotUI.css';
import '../styles/LoadingSpinner.css'; // Assuming you have a CSS for the spinner
import { getAuth } from 'firebase/auth'; // NEW: Import getAuth for Firebase authentication

const ChatbotUI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // New loading state
  const messagesEndRef = useRef(null);
  const auth = getAuth(); // Initialize Firebase Auth instance

  // Scroll to the latest message whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const sendMessageToApi = useCallback(async (endpointType) => {
    if (!inputValue.trim()) return;

    const userMessage = { id: Date.now(), text: inputValue, sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInputValue('');
    setIsLoading(true); // Start loading

    try {
      // Get the current authenticated user and their ID token
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated. Please log in to use the chatbot.");
      }
      const idToken = await user.getIdToken(); // This fetches the Firebase ID token

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
  }, [inputValue, auth.currentUser]); // Add auth.currentUser to dependencies to re-run effect if user changes

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Prevent new line on Enter, allow with Shift+Enter
      e.preventDefault(); // Prevent default form submission or new line
      // When pressing Enter, default to 'Find Disease (by Symptoms)' as it's a common use case
      sendMessageToApi('disease'); 
    }
  };

  return (
    <div className={`chatbot-container ${isOpen ? 'open' : 'closed'}`}>
      {/* Changed class name from chatbot-toggle-button to chat-toggle-button */}
      <button className="chat-toggle-button" onClick={toggleChatbot}>
        {/* You can add a span with chat-icon-symbol here if you want to style the icon separately */}
        {isOpen ? '—' : '💬'} 
      </button>

      {isOpen && (
        // Changed class name from chatbot-window to chat-window
        <div className="chat-window">
          {/* Changed class name from chatbot-header to chat-header */}
          <div className="chat-header">
            <h3>Medizap Health Assistant</h3> {/* Added h3 as per CSS */}
            {/* Added close button as per CSS */}
            <button className="close-chat-button" onClick={toggleChatbot}>&times;</button>
          </div>
          {/* Changed class name from chatbot-messages to chat-messages */}
          <div className="chat-messages">
            {messages.map((message) => (
              // Changed class name from message to chat-message
              // Adjusted user/bot classes: chat-user, chat-bot
              <div key={message.id} className={`chat-message ${message.sender === 'user' ? 'chat-user' : 'chat-bot'} ${message.isDisclaimer ? 'isDisclaimer' : ''}`}>
                {message.isHtml ? (
                  message.content
                ) : (
                  message.text
                )}
              </div>
            ))}
            {isLoading && (
              <div className="chat-message chat-bot"> {/* Using chat-message for consistency */}
                <div className="loading-spinner"></div> {/* Your loading spinner */}
              </div>
            )}
            <div ref={messagesEndRef} /> {/* Scroll target */}
          </div>
          {/* Changed class name from chatbot-input-area to chat-input-form */}
          <div className="chat-input-form">
            {/* Changed class name from chatbot-input to chat-input */}
            <textarea
              className="chat-input"
              placeholder="Type your symptoms or disease name..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              rows="1" // Start with 1 row, expand as needed
            />
            <div className="chatbot-buttons"> {/* This class name seems consistent in your CSS snippet */}
                <button
                    className="send-button"
                    onClick={() => sendMessageToApi('symptoms')}
                    disabled={isLoading}
                >
                    Get Info (by Disease)
                </button>
                <button
                    className="send-button"
                    onClick={() => sendMessageToApi('disease')}
                    disabled={isLoading}
                >
                    Find Disease (by Symptoms)
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotUI;
