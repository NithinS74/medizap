# MediZap: AI-Powered Medicine Delivery

## About The Project

MediZap is an innovative, AI-powered telemedicine and ultra-fast medicine delivery platform designed to address critical inefficiencies in existing medicine delivery systems. It aims to bridge the gaps left by current platforms by intelligently processing user prescriptions, validating medicines using AI, checking for drug interactions, matching pharmacy stock in real-time, and dispatching required medications within minutes.

The platform is built with modern technologies like **React.js**, **FastAPI**, **Firebase**, and AI/ML models including **Tesseract** and large language models like **Google's Gemini**.

## Key Features

-   **⚕️ Prescription Upload & OCR:** Upload handwritten or digital prescriptions. Our AI-powered OCR extracts the text, making it readable and easy to process.
-   **🤖 Health Assistant Chatbot:** An intelligent chatbot that allows users to describe their symptoms and receive health advice and medication recommendations.
-   **🏪 Smart Inventory Matching:** Connects with local pharmacies in real-time to track medicine availability for rapid dispatch.
-   **🗺️ Locate Care Instantly:** A map-based interface to find nearby 24/7 pharmacies and hospitals.
-   **🔬 Drug Safety & Interaction Checks:** Utilizes public APIs to detect harmful drug combinations and incorrect dosages, ensuring patient safety.
-   **🆘 Emergency Mode (SOS Button):** A dedicated button for high-priority, life-saving medication orders that bypasses normal checks for immediate dispatch.
-   **⏰ Smart Medicine Reminders:** Set up custom reminders for medications with in-app alarms and push notifications so you never miss a dose.
-   **📰 Daily Health News:** Stay informed with the latest health news and medical updates from trusted sources.

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

Make sure you have the following installed on your development machine:
- Node.js & npm
- Python & pip

### Installation & Setup

#### Frontend

1.  Navigate to the `frontend` directory:
    ```sh
    cd medizap-main/frontend
    ```
2.  Install NPM packages:
    ```sh
    npm install
    ```
3.  Start the development server:
    ```sh
    npm start
    ```
    The application will be available at `http://localhost:3000`.

#### Backend

1.  Navigate to the `medizap-chatbot-api` directory:
    ```sh
    cd medizap-main/medizap-chatbot-api
    ```
2.  Create and activate a Python virtual environment:
    ```sh
    # For Windows PowerShell
    python -m venv venv
    .\venv\Scripts\activate

    # For macOS/Linux
    python -m venv venv
    source venv/bin/activate
    ```
3.  Install the required Python packages:
    ```sh
    pip install -r requirements.txt
    ```
4.  **Set up Environment Variables:**
    Create a `.env` file in the `medizap-chatbot-api` directory and add the following, replacing the placeholder values with your actual API keys and file paths:
    ```env
    FIREBASE_SERVICE_ACCOUNT_KEY_PATH="path/to/your/firebase-service-account.json"
    GOOGLE_APPLICATION_CREDENTIALS="path/to/your/google-cloud-vision-sa-key.json"
    NEWS_API_KEY="YOUR_NEWS_API_KEY"
    GOOGLE_API_KEY="YOUR_GEMINI_API_KEY"
    ```
5.  Start the backend server:
    ```sh
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
    ```
    The API will be available at `http://localhost:8000`.

---

> "The greatest wealth is health." - Virgil
