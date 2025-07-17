from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn
import os
import pandas as pd
import re
import base64
from PIL import Image
import io
import requests
import json # Ensure json is imported for json.loads (reading from env var)

# Import Llama from llama_cpp
from llama_cpp import Llama

# NEW: Firebase Admin SDK Imports
import firebase_admin
from firebase_admin import credentials, firestore, auth

# --- CORS middleware (keep this as is) ---
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:3000", # For local React development (Create React App default)
    "http://localhost:5173", # For local React development (Vite/other setups)
    "https://your-medizap-webapp-domain.com", # Your deployed React app domain - IMPORTANT: Replace with your actual deployed frontend URL
]

app = FastAPI(
    title="Medizap Medical Data API (CSV Retrieval & Firestore)",
    description="API for Medizap chatbot, retrieving information from 'book1.csv' and storing chat history in Firestore. Now with News!",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --- END CORS middleware ---


# --- Global variables for Firebase, DataFrame, and API Keys ---
db_firestore = None # Firestore client
medical_data_df = None
CSV_FILE_NAME = "book1.csv"
APP_ID = os.environ.get("APP_ID", "default-medizap-app")
# --- START OF MODIFIED SECTION ---
# Updated to use the provided News API key as a default
NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "4f30447ac575407ab4ddc687060d8677")
# --- END OF MODIFIED SECTION ---
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "") # NEW: For Gemini API

# Global variable for the local GGUF model
llm_model = None
# Global variable for the RAG knowledge base
disease_knowledge_db = []


@app.on_event("startup")
async def load_medical_data_and_initialize_firebase():
    """
    Load all necessary data and models on application startup.
    - Initializes Firebase Admin SDK.
    - Loads the medical data CSV.
    - Downloads and loads the GGUF model from Hugging Face Hub using the correct method.
    - Loads the disease knowledge base for RAG.
    """
    global medical_data_df, db_firestore, llm_model, disease_knowledge_db

    # --- Initialize Firebase Admin SDK ---
    print("--- Initializing Firebase Admin SDK ---")
    firebase_service_account_key_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")

    if not firebase_service_account_key_path:
        print("ERROR: FIREBASE_SERVICE_ACCOUNT_KEY_PATH environment variable not set. Firestore will not be initialized.")
    elif not os.path.exists(firebase_service_account_key_path):
        print(f"ERROR: Firebase service account key file not found at: {firebase_service_account_key_path}. Firestore will not be initialized.")
    else:
        try:
            cred = credentials.Certificate(firebase_service_account_key_path)
            if not firebase_admin._apps:
                firebase_admin.initialize_app(cred)
            db_firestore = firestore.client()
            print("Firebase Admin SDK initialized successfully and Firestore client obtained.")
        except Exception as e:
            print(f"ERROR: Failed to initialize Firebase Admin SDK from file: {e}. Firestore client will not be available.")
            db_firestore = None

    # --- Load Medical Data CSV ---
    csv_path = os.path.join(os.path.dirname(__file__), CSV_FILE_NAME)
    print(f"--- Application Startup: Loading Medical Data from CSV ---")
    encodings_to_try = ['utf-8', 'latin1', 'cp1252', 'ISO-8859-1']
    loaded_successfully = False
    last_error = None
    for encoding in encodings_to_try:
        try:
            medical_data_df = pd.read_csv(csv_path, encoding=encoding, sep=',', on_bad_lines='skip')
            if not medical_data_df.empty and all(col in medical_data_df.columns for col in ['Disease', 'Description', 'Symptoms', 'Medicines']):
                loaded_successfully = True
                print(f"Successfully loaded {len(medical_data_df)} records from '{CSV_FILE_NAME}' using encoding '{encoding}'.")
                break
        except Exception as e:
            last_error = e
    if not loaded_successfully:
        print("All attempted loading combinations failed. Falling back to a dummy DataFrame.")
        medical_data_df = pd.DataFrame(columns=['Disease', 'Description', 'Symptoms', 'Medicines'])

    # --- Download and Load Local GGUF Model using from_pretrained ---
    print("--- Application Startup: Downloading and Loading GGUF Model ---")
    try:
        repo_id = "TheBloke/Wizard-Vicuna-13B-Uncensored-GGUF"
        filename = "Wizard-Vicuna-13B-Uncensored.Q2_K.gguf"
        
        print(f"Downloading and loading model '{filename}' from '{repo_id}'. This may take a while on the first run...")
        
        llm_model = Llama.from_pretrained(
            repo_id=repo_id,
            filename=filename,
            n_ctx=2048,  # Context window size
            n_gpu_layers=-1, # Offload all layers to GPU if possible
            verbose=True
        )
        print(f"Successfully loaded GGUF model: {filename}")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to load local GGUF model. The /predict-disease endpoint will not work. Error: {e}")
        llm_model = None

    # --- Load Disease Knowledge Base for RAG ---
    print("--- Application Startup: Loading Disease Knowledge Base ---")
    try:
        knowledge_base_path = os.path.join(os.path.dirname(__file__), "disease_knowledge.json")
        with open(knowledge_base_path, 'r', encoding='utf-8') as f:
            disease_knowledge_db = json.load(f)
        print(f"Successfully loaded {len(disease_knowledge_db)} records from disease_knowledge.json.")
    except Exception as e:
        print(f"ERROR: Failed to load disease_knowledge.json. RAG will not be available. Error: {e}")
        disease_knowledge_db = []


# Helper function to save chat history to Firestore (made synchronous to fix bug)
def save_chat_history(user_id: str, query: str, response: dict, api_endpoint: str):
    """Saves a chat interaction to Firestore."""
    if db_firestore is None:
        print("Firestore client not initialized. Cannot save chat history.")
        return
    try:
        collection_ref = db_firestore.collection('artifacts').document(APP_ID).collection('users').document(user_id).collection('chat_history')
        chat_entry = {
            "user_id": user_id,
            "query": query,
            "response": response,
            "api_endpoint": api_endpoint,
            "timestamp": firestore.SERVER_TIMESTAMP
        }
        collection_ref.add(chat_entry)
        print(f"Chat history saved for user {user_id} to Firestore.")
    except Exception as e:
        print(f"Error saving chat history to Firestore for user {user_id}: {e}")


# --- Authentication Dependency ---
async def get_current_user_id(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    id_token = auth_header.split("Bearer ")[1] if "Bearer " in auth_header else None
    if not id_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token not found in Authorization header")
    if db_firestore is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Firebase Admin SDK not initialized. Cannot authenticate.")
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid authentication token: {e}")


# --- Define Input/Output Pydantic Models ---
class TextInput(BaseModel):
    text: str

class ImageInput(BaseModel):
    image_base64: str

class OCRResponse(BaseModel):
    extracted_text: str
    message: str = "OCR process completed."
    disclaimer: str = "OCR results may contain errors. Always verify critical information manually."

class ChatResponse(BaseModel):
    response_text: str
    disclaimer: str = "This information is for general knowledge and informational purposes only, and does not constitute medical advice. Always consult a qualified healthcare professional for diagnosis and treatment."

class NewsArticle(BaseModel):
    source_name: str | None = None
    author: str | None = None
    title: str
    description: str | None = None
    url: str
    url_to_image: str | None = None
    published_at: str | None = None
    content: str | None = None

class NewsResponse(BaseModel):
    articles: list[NewsArticle]
    total_results: int
    message: str = "News fetched successfully."
    disclaimer: str = "News articles are provided for informational purposes only."


# --- Define API Endpoints ---

@app.get("/")
async def root():
    firebase_status = "Firestore initialized." if db_firestore else "Firestore NOT initialized."
    llm_status = "Local LLM model loaded." if llm_model else "Local LLM model FAILED to load."
    return {"message": f"Medizap API is running. {firebase_status} {llm_status}"}


@app.post("/predict-disease", response_model=ChatResponse)
async def get_disease_by_symptoms(input_data: TextInput, user_id: str = Depends(get_current_user_id)):
    """
    Handles general medical queries by using a locally hosted GGUF model,
    augmented with a knowledge base for more accurate responses (RAG).
    """
    if not llm_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The local AI model is not available. Please check the server logs for errors on startup."
        )

    if not input_data.text or not input_data.text.strip():
        response = ChatResponse(response_text="I'm sorry, I can't help without a question. Please tell me what's on your mind.")
        save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease")
        return response
        
    # 1. Retrieval Step: Find relevant documents from the knowledge base using keyword matching and scoring.
    query_lower = input_data.text.lower()
    # Split the query into keywords, handling spaces, commas, and the word "and"
    keywords = re.split(r'[\s,]+|and', query_lower)
    keywords = [k.strip() for k in keywords if k.strip()] # Remove empty strings and extra spaces

    scored_docs = []
    for doc in disease_knowledge_db:
        score = 0
        doc_symptoms_lower = [s.lower() for s in doc.get('symptoms', [])]
        
        for keyword in keywords:
            # Check for match in disease name (higher weight)
            if keyword in doc['disease'].lower():
                score += 2
            # Check for match in symptoms
            for symptom in doc_symptoms_lower:
                if keyword in symptom:
                    score += 1
        
        if score > 0:
            scored_docs.append({'doc': doc, 'score': score})

    retrieved_docs = []
    if scored_docs:
        # Sort by score to get the most relevant documents first
        scored_docs.sort(key=lambda x: x['score'], reverse=True)
        retrieved_docs = [item['doc'] for item in scored_docs]

    context = "No specific information found in the knowledge base."
    if retrieved_docs:
        context_parts = []
        for doc in retrieved_docs[:2]: # Limit context to 2 most relevant docs
            context_parts.append(
                f"Disease: {doc['disease']}\n"
                f"Description: {doc['description']}\n"
                f"Symptoms: {', '.join(doc.get('symptoms', []))}\n"
                f"Common Medicines: {', '.join(doc.get('medicines', []))}"
            )
        context = "\n\n---\n\n".join(context_parts)

    # 2. Generation Step: Augment the prompt with the retrieved context
    system_instruction = (
        "You are an information synthesizer. Your task is to answer the user's question based *only* on the provided context. "
        "Summarize the information from the context in a friendly, conversational paragraph. "
        "If the context indicates that no information was found, state that you couldn't find specific details and offer to help with another question. "
        "Do not use your own knowledge. Do not provide a diagnosis. "
        "Always conclude your response with a disclaimer reminding the user to consult a healthcare professional."
    )
    
    # Create the prompt using the Vicuna format
    prompt = f"""A chat between a curious user and an artificial intelligence assistant.
USER: {system_instruction}

CONTEXT:
{context}

User question: {input_data.text}
ASSISTANT:"""

    try:
        # Generate a response using llama-cpp-python
        output = llm_model(
            prompt,
            max_tokens=256,
            stop=["USER:", "\n"], # Stop generation at these tokens
            echo=False # Do not repeat the prompt in the output
        )
        
        generated_text = output['choices'][0]['text']
        
        # Create the simple chat response object
        response = ChatResponse(response_text=generated_text.strip())

    except Exception as e:
        print(f"An unexpected error occurred during local AI prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during AI prediction: {e}"
        )
    
    # Save the chat history synchronously
    save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease")
    return response


@app.post("/ocr/handwritten-text", response_model=OCRResponse)
async def ocr_handwriting(input_data: ImageInput, user_id: str = Depends(get_current_user_id)):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="GOOGLE_API_KEY environment variable not set.")
    try:
        header, encoded_data = input_data.image_base64.split(',', 1)
        mime_type = header.split(';')[0].split(':')[1]
        base64_only_data = encoded_data 
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid Base64 image format: {e}")

    gemini_api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GOOGLE_API_KEY}"
    prompt = "Extract all readable text from this image, focusing on any handwritten notes or prescription details."
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt}, {"inlineData": {"mimeType": mime_type, "data": base64_only_data}}]}]}

    try:
        gemini_response = requests.post(gemini_api_url, headers={'Content-Type': 'application/json'}, data=json.dumps(payload))
        gemini_response.raise_for_status()
        gemini_result = gemini_response.json()
        extracted_text = gemini_result['candidates'][0]['content']['parts'][0].get('text', '')
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error during OCR processing: {e}")

    # Save chat history synchronously
    save_chat_history(user_id, "OCR Request (Image Upload)", {"extracted_text": extracted_text}, "/ocr/handwritten-text")
    return OCRResponse(extracted_text=extracted_text)


@app.get("/news", response_model=NewsResponse)
async def get_daily_news(user_id: str = Depends(get_current_user_id), query: str = "health OR medicine OR disease", pageSize: int = 10):
    if not NEWS_API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="News API Key is not configured.")
    news_api_url = "https://newsapi.org/v2/everything"
    params = {"q": query, "sortBy": "publishedAt", "language": "en", "pageSize": pageSize, "apiKey": NEWS_API_KEY}
    try:
        response = requests.get(news_api_url, params=params)
        response.raise_for_status()
        # --- START OF MODIFIED SECTION ---
        # Fixed typo from news_.json() to response.json()
        news_data = response.json()
        # --- END OF MODIFIED SECTION ---
        articles = [NewsArticle(**article_data) for article_data in news_data.get('articles', [])]
        news_response = NewsResponse(articles=articles, total_results=news_data.get('totalResults', 0))
        # Save chat history synchronously
        save_chat_history(user_id, f"Fetched news (query: {query})", news_response.dict(), "/news")
        return news_response
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching news: {e}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
