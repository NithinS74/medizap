// src/features/ChatbotUI.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/ChatbotUI.css';
import '../styles/LoadingSpinner.css';
import { getAuth } from 'firebase/auth';

const ChatbotUI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const auth = getAuth();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

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
    <div className={`chatbot-container ${isOpen ? 'open' : 'closed'}`}>
      <button className="chat-toggle-button" onClick={toggleChatbot}>
        {isOpen ? '—' : '💬'} 
      </button>

      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <h3>Medizap Health Assistant</h3>
            <button className="close-chat-button" onClick={toggleChatbot}>&times;</button>
          </div>
          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${message.sender === 'user' ? 'chat-user' : 'chat-bot'} ${message.isDisclaimer ? 'isDisclaimer' : ''}`}>
                {message.text}
              </div>
            ))}
            {isLoading && (
              <div className="chat-message chat-bot">
                <div className="loading-spinner"></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-input-form">
            <textarea
              className="chat-input"
              placeholder="Ask me anything..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
              rows="1"
            />
            <div className="chatbot-buttons">
                <button
                    className="send-button"
                    onClick={sendMessage}
                    disabled={isLoading}
                >
                    Send
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatbotUI;
