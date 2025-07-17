// src/features/UploadPrescription.jsx
import React, { useState, useCallback } from 'react';
import { getAuth } from 'firebase/auth'; // Import getAuth to get the ID token
import '../styles/UploadPrescription.css'; // Assuming you have a CSS file for this page
import '../styles/LoadingSpinner.css'; // For the loading spinner

const UploadPrescription = () => {
  const [file, setFile] = useState(null);
  const [base64Image, setBase64Image] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const auth = getAuth(); // Get Firebase Auth instance

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setMessage('');
      setExtractedText(''); // Clear previous text
      const reader = new FileReader();
      reader.onloadend = () => {
        // The result will be a data URL, e.g., "data:image/png;base64,iVBORw0..."
        setBase64Image(reader.result);
      };
      reader.onerror = () => {
        setError("Failed to read file.");
        setBase64Image('');
      };
      reader.readAsDataURL(selectedFile); // Read file as Base64 data URL
    } else {
      setFile(null);
      setBase64Image('');
      setExtractedText('');
    }
  };

  const handleOcrProcess = useCallback(async () => {
    if (!base64Image) {
      setError("Please select an image file first.");
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated. Please log in to convert text.");
      }
      const idToken = await user.getIdToken(); // Get the ID token

      // The backend expects the full data URL as "image_base64"
      // No need to split it here, as the backend's ImageInput model expects the data URL directly.
      const response = await fetch('http://localhost:8000/ocr/handwritten-text', { // Updated endpoint path
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Send the ID token for authentication
        },
        body: JSON.stringify({ image_base64: base64Image }), // Corrected key to image_base64
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setExtractedText(data.extracted_text);
      setMessage('Text extracted successfully!');
    } catch (err) {
      console.error('Error during OCR process:', err);
      setError(`Failed to convert image to text: ${err.message}.`);
      setExtractedText('');
    } finally {
      setLoading(false);
    }
  }, [base64Image, auth]); // Depend on base64Image and auth to re-run if they change

  return (
    <div className="upload-prescription-container">
      <h1 className="upload-prescription-title">Upload Prescription or Handwritten Notes</h1>
      <p className="upload-prescription-description">
        Upload an image of your prescription or handwritten notes, and we'll convert the text for you.
      </p>

      <div className="file-input-section">
        <label htmlFor="file-upload" className="custom-file-upload">
          Choose Image File (JPG, PNG)
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/jpeg,image/png"
          onChange={handleFileChange}
          disabled={loading}
        />
        {file && <p className="selected-file-name">Selected: {file.name}</p>}
      </div>

      {base64Image && (
        <div className="image-preview-section">
          <h2>Image Preview:</h2>
          <img src={base64Image} alt="Preview" className="image-preview" />
        </div>
      )}

      <button 
        onClick={handleOcrProcess} 
        className="process-ocr-button" 
        disabled={loading || !base64Image}
      >
        {loading ? (
          <>
            <div className="loading-spinner small-spinner"></div> Processing...
          </>
        ) : (
          'Convert to Text'
        )}
      </button>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {extractedText && (
        <div className="extracted-text-section">
          <h2>Extracted Text:</h2>
          <textarea
            className="extracted-text-area"
            value={extractedText}
            rows="10"
            readOnly
          ></textarea>
        </div>
      )}
    </div>
  );
};

export default UploadPrescription;
