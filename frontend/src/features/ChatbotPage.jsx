// src/features/ChatbotPage.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/ChatbotPage.css';
import '../styles/LoadingSpinner.css';
import { getAuth } from 'firebase/auth';

const ChatbotPage = () => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const auth = getAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    const userMessage = { id: Date.now(), text: inputValue, sender: 'user' };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated. Please log in to use the chatbot.");
      }
      const idToken = await user.getIdToken();
      const apiUrl = 'http://localhost:8000/predict-disease';

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ text: currentInput }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const botResponse = { 
        id: Date.now() + '_bot', 
        text: data.response_text, 
        sender: 'bot'
      };
      
      const disclaimerResponse = {
        id: Date.now() + '_disclaimer',
        text: data.disclaimer,
        sender: 'bot',
        isDisclaimer: true
      };

      setMessages((prevMessages) => [...prevMessages, botResponse, disclaimerResponse]);

    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { id: Date.now() + '_err', text: `Sorry, there was an error processing your request: ${error.message}. Please try again.`, sender: 'bot' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, auth.currentUser]);


  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      sendMessage(); 
    }
  };

  return (
    <div className="full-chatbot-page"> 
      <div className="full-page-chat-window"> 
        <div className="full-page-chat-header"> 
          <h3>Medizap Health Assistant</h3>
        </div>
        <div className="full-page-chat-messages"> 
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`full-page-chat-message ${message.sender === 'user' ? 'user' : 'bot'} ${message.isDisclaimer ? 'isDisclaimer' : ''}`}
            >
              {message.text}
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
            placeholder="Ask me anything about your health..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            rows="1" 
          />
          <div className="full-page-chatbot-buttons"> 
              <button
                  className="full-page-send-button" 
                  onClick={sendMessage}
                  disabled={isLoading}
              >
                  Send
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
