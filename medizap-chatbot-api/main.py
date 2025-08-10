import uvicorn
import os
import pandas as pd
import re
import base64
from PIL import Image
import io
import requests
import json
from llama_cpp import Llama


from dotenv import load_dotenv
load_dotenv()


import firebase_admin
from firebase_admin import credentials, firestore, auth
from google.cloud.firestore_v1.async_client import AsyncClient 


from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Request, HTTPException, status, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel


import products 
from products import router as products_router 

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://your-medizap-webapp-domain.com",
]

app = FastAPI(
    title="Medizap Medical Data API (CSV Retrieval & Firestore)",
    description="API for Medizap chatbot, retrieving information from 'book1.csv' and storing chat history in Firestore. Now with News! Also includes a product database.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products_router, prefix="/api/v1")



db_firestore_client_instance = None 
medical_data_df = None
CSV_FILE_NAME = "book1.csv"
APP_ID = os.environ.get("APP_ID", "default-medizap-app")
NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "4f30447ac575407ab4ddc687060d8677")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")


llm_model = None

disease_knowledge_db = []
drug_knowledge_db = []



def get_firestore_client():
    if db_firestore_client_instance is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore client is not initialized. Please check server setup."
        )
    return db_firestore_client_instance


@app.on_event("startup")
async def load_medical_data_and_initialize_firebase():
    global medical_data_df, db_firestore_client_instance, llm_model, disease_knowledge_db, drug_knowledge_db

    
    print("--- Initializing Firebase Admin SDK ---")
    firebase_service_account_key_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_KEY_PATH")

    if not firebase_service_account_key_path:
        print("ERROR: FIREBASE_SERVICE_ACCOUNT_KEY_PATH environment variable not set. Firestore will not be initialized.")
        db_firestore_client_instance = None
        products.get_firestore_client_dependency = None 
    elif not os.path.exists(firebase_service_account_key_path):
        print(f"ERROR: Firebase service account key file not found at: {firebase_service_account_key_path}. Firestore will not be initialized.")
        db_firestore_client_instance = None
        products.get_firestore_client_dependency = None 
    else:
        try:
            
            if not firebase_admin._apps:
                cred = credentials.Certificate(firebase_service_account_key_path)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin SDK app initialized.")
            else:
                
                cred = credentials.Certificate(firebase_service_account_key_path) 
                print("Firebase Admin SDK app already initialized (likely due to --reload).")
            
            
            db_firestore_client_instance = AsyncClient(
                project=cred.project_id,           
                credentials=cred.get_credential()  
            )
            

            products.get_firestore_client_dependency = get_firestore_client 
            
            print("Firebase Admin SDK initialized successfully and Firestore client obtained.")
        except Exception as e:
            
            print(f"ERROR: Failed to initialize Firebase Admin SDK from file: {e}. Firestore client will not be available.")
            db_firestore_client_instance = None
            products.get_firestore_client_dependency = None 

    print(f"Firebase client status after startup: {'Initialized' if db_firestore_client_instance else 'NOT Initialized'}")

    
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

    
    print("--- Application Startup: Downloading and Loading GGUF Model ---")
    try:
        repo_id = "TheBloke/Wizard-Vicuna-13B-Uncensored-GGUF"
        filename = "Wizard-Vicuna-13B-Uncensored.Q2_K.gguf"
        
        print(f"Downloading and loading model '{filename}' from '{repo_id}'. This may take a while on the first run...")
        
        llm_model = Llama.from_pretrained(
            repo_id=repo_id,
            filename=filename,
            n_ctx=2048,
            n_gpu_layers=-1,
            verbose=True
        )
        print(f"Successfully loaded GGUF model: {filename}")
    except Exception as e:
        print(f"CRITICAL ERROR: Failed to load local GGUF model. The /predict-disease endpoint will not work. Error: {e}")
        llm_model = None

    
    print("--- Application Startup: Loading Disease Knowledge Base ---")
    try:
        knowledge_base_path = os.path.join(os.path.dirname(__file__), "disease_knowledge.json")
        with open(knowledge_base_path, 'r', encoding='utf-8') as f:
            disease_knowledge_db = json.load(f)
        print(f"Successfully loaded {len(disease_knowledge_db)} records from disease_knowledge.json.")
    except Exception as e:
        print(f"ERROR: Failed to load disease_knowledge.json. RAG will not be available. Error: {e}")
        disease_knowledge_db = []

    
    print("--- Application Startup: Loading Drug Knowledge Base ---")
    try:
        drug_knowledge_path = os.path.join(os.path.dirname(__file__), "data-drug.json")
        with open(drug_knowledge_path, 'r', encoding='utf-8') as f:
            drug_knowledge_db = json.load(f)
        print(f"Successfully loaded {len(drug_knowledge_db)} records from data-drug.json.")
    except Exception as e:
        print(f"ERROR: Failed to load data-drug.json. RAG will be limited. Error: {e}")
        drug_knowledge_db = []



async def save_chat_history(user_id: str, query: str, response: dict, api_endpoint: str):
    """Saves a chat interaction to Firestore asynchronously."""
    
    if db_firestore_client_instance is None:
        print("Firestore client not initialized. Cannot save chat history.")
        return
    try:
        collection_ref = db_firestore_client_instance.collection('artifacts').document(APP_ID).collection('users').document(user_id).collection('chat_history')
        chat_entry = {
            "user_id": user_id,
            "query": query,
            "response": response,
            "api_endpoint": api_endpoint,
            "timestamp": firestore.SERVER_TIMESTAMP
        }
        await collection_ref.add(chat_entry)
        print(f"Chat history saved for user {user_id} to Firestore.")
    except Exception as e:
        print(f"Error saving chat history to Firestore for user {user_id}: {e}")



async def get_current_user_id(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header missing")
    id_token = auth_header.split("Bearer ")[1] if "Bearer " in auth_header else None
    if not id_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token not found in Authorization header")
    
    if db_firestore_client_instance is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Firebase Admin SDK not initialized. Cannot authenticate.")
    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token['uid']
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid authentication token: {e}")



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




@app.get("/")
async def root():
    
    firebase_status = "Firestore initialized." if db_firestore_client_instance else "Firestore NOT initialized."
    llm_status = "Local LLM model loaded." if llm_model else "Local LLM model FAILED to load."
    return {"message": f"Medizap API is running. {firebase_status} {llm_status}"}


@app.post("/predict-disease", response_model=ChatResponse)
async def get_disease_by_symptoms(input_data: TextInput, user_id: str = Depends(get_current_user_id)):
    """
    Handles general medical queries by using a locally hosted GGUF model,
    augmented with a dual knowledge base (diseases and drugs) for more accurate responses (RAG).
    """
    if not llm_model:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The local AI model is not available. Please check the server logs for errors on startup."
        )

    if not input_data.text or not input_data.text.strip():
        response = ChatResponse(response_text="I'm sorry, I can't help without a question. Please tell me what's on your mind.")
        await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease")
        return response
        
    
    query_lower = input_data.text.lower()
    
    keywords = re.split(r'[\s,;.()]+|and', query_lower)
    keywords = [k.strip() for k in keywords if k.strip() and len(k) > 2] 

    scored_docs = []

    
    for doc in disease_knowledge_db:
        score = 0
        doc_disease_lower = doc.get('disease', '').lower()
        doc_symptoms_lower = [s.lower() for s in doc.get('symptoms', [])]
        
        for keyword in keywords:
            if keyword in doc_disease_lower:
                score += 3 
            for symptom in doc_symptoms_lower:
                if keyword in symptom:
                    score += 1
        
        if score > 0:
            scored_docs.append({'doc': doc, 'score': score, 'type': 'disease'})

    
    
    for doc in drug_knowledge_db:
        score = 0
        
        doc_name_lower = doc.get('name', '').lower()
        doc_indication_lower = doc.get('indication', '').lower()
        doc_category_lower = doc.get('category', '').lower()
        composition_str_lower = ' '.join([c.get('composition', '').lower() for c in doc.get('composition', [])])
        side_effects_str_lower = ' '.join([s.get('side_effect', '').lower() for s in doc.get('side_effect', [])])
        
        
        dose_info_lower = []
        for d in doc.get('dose', []):
            profil = d.get('profil', '').lower()
            dose_text = d.get('dose', '').lower()
            dose_info_lower.append(f"{profil} {dose_text}")
        dose_info_str_lower = ' '.join(dose_info_lower)

        
        for keyword in keywords:
            if keyword in doc_name_lower:
                score += 5  
            if keyword in dose_info_str_lower:
                score += 4  
            if keyword in doc_indication_lower:
                score += 3  
            if keyword in composition_str_lower:
                score += 2  
            if keyword in side_effects_str_lower:
                score += 1  
            if keyword in doc_category_lower:
                score += 1

        if score > 0:
            scored_docs.append({'doc': doc, 'score': score, 'type': 'drug'})
    

    
    context = "No specific information found in the knowledge base."
    if scored_docs:
        scored_docs.sort(key=lambda x: x['score'], reverse=True)
        context_parts = []

        
        def format_list(data, key_name):
            if not isinstance(data, list): return "N/A"
            
            values = [item.get(key_name) or item.get(key_name.strip() + ' ') for item in data]
            return ', '.join(filter(None, values)) or "N/A"

        
        for item in scored_docs[:3]:
            doc_type = item['type']
            doc = item['doc']
            
            if doc_type == 'disease':
                context_parts.append(
                    f"Type: Disease Information\n"
                    f"Disease: {doc.get('disease', 'N/A')}\n"
                    f"Description: {doc.get('description', 'N/A')}\n"
                    f"Symptoms: {', '.join(doc.get('symptoms', []))}\n"
                    f"Common Medicines: {', '.join(doc.get('medicines', []))}"
                )
            elif doc_type == 'drug':
                composition_str = format_list(doc.get('composition', []), 'composition')
                side_effects_str = format_list(doc.get('side_effect', []), 'side_effect')
                dose_str = ", ".join([f"{d.get('profil', 'General')}: {d.get('dose', 'N/A')}" for d in doc.get('dose', [])])

                context_parts.append(
                    f"Type: Drug Information\n"
                    f"Drug Name: {doc.get('name', 'N/A')}\n"
                    f"Indication: {doc.get('indication', 'N/A')}\n"
                    f"Composition: {composition_str}\n"
                    f"Side Effects: {side_effects_str}\n"
                    f"Dosage: {dose_str}"
                )
        context = "\n\n---\n\n".join(context_parts)

    
    system_instruction = (
        "You are an information synthesizer. Your task is to answer the user's question based *only* on the provided context, which may contain information about diseases, drugs, or both. "
        "Summarize the information from the context in a friendly, conversational paragraph. "
        "If the context indicates that no information was found, state that you couldn't find specific details and offer to help with another question. "
        "Do not use your own knowledge. Do not provide a diagnosis. "
        "Always conclude your response with a disclaimer reminding the user to consult a healthcare professional."
    )
    
    prompt = f"""A chat between a curious user and an artificial intelligence assistant.
USER: {system_instruction}

CONTEXT:
{context}

User question: {input_data.text}
ASSISTANT:"""

    try:
        output = llm_model(
            prompt,
            max_tokens=256,
            stop=["USER:", "\n"],
            echo=False
        )
        
        generated_text = output['choices'][0]['text']
        response = ChatResponse(response_text=generated_text.strip())

    except Exception as e:
        print(f"An unexpected error occurred during local AI prediction: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during AI prediction: {e}"
        )
    
    await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease")
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
    
    prompt_ocr = "Extract all readable text from this image, focusing on any handwritten notes or prescription details." 
    payload = {"contents": [{"role": "user", "parts": [{"text": prompt_ocr}, {"inlineData": {"mimeType": mime_type, "data": base64_only_data}}]}]}

    try:
        gemini_response = requests.post(gemini_api_url, headers={'Content-Type': 'application/json'}, data=json.dumps(payload))
        gemini_response.raise_for_status()
        gemini_result = gemini_response.json()
        extracted_text = gemini_result['candidates'][0]['content']['parts'][0].get('text', '')
    except Exception as e:
        print(f"Error during OCR processing: {e}") # Changed to print for easier debugging
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error during OCR processing: {e}")

    await save_chat_history(user_id, "OCR Request (Image Upload)", {"extracted_text": extracted_text}, "/ocr/handwritten-text")
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
        news_data = response.json()
        articles = [NewsArticle(**article_data) for article_data in news_data.get('articles', [])]
        news_response = NewsResponse(articles=articles, total_results=news_data.get('totalResults', 0))
        await save_chat_history(user_id, f"Fetched news (query: {query})", news_response.dict(), "/news")
        return news_response
    except Exception as e:
        print(f"Error fetching news: {e}") # Changed to print for easier debugging
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching news: {e}")


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
