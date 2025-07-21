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
import json
import random

# Email sending imports
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Firebase Admin SDK Imports
import firebase_admin
from firebase_admin import credentials, firestore, auth

# --- CORS middleware ---
from fastapi.middleware.cors import CORSMiddleware

origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://your-medizap-webapp-domain.com",
]

app = FastAPI(
    title="Medizap Medical Data API (CSV Retrieval & Firestore)",
    description="API for Medizap chatbot, retrieving information from 'book1.csv' and storing chat history in Firestore. Now with News, Medicine Availability, and Emergency Email!",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Global variables for Firebase, DataFrame, and API Keys ---
db_firestore = None
medical_data_df = None
CSV_FILE_NAME = "book1.csv"
APP_ID = os.environ.get("APP_ID", "default-medizap-app")
NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "4f30447ac575407ab4ddc687060d8677")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

# Email Sending Credentials from Environment Variables
SMTP_SERVER = os.environ.get("SMTP_SERVER")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")

# Dummy Medicine Stock Levels & Overpass API URL
dummy_medicine_stock_levels = {
    "paracetamol": ["High", "Medium", "Low"],
    "ibuprofen": ["High", "Medium", "Unavailable"],
    "amoxicillin": ["Low", "Unavailable"],
    "omeprazole": ["High", "Medium"],
    "levothyroxine": ["High"],
    "aspirin": ["High", "Medium"],
    "antibiotics": ["Medium", "Low", "Unavailable"],
    "painkillers": ["High", "Medium"],
    "cough syrup": ["High", "Low"],
    "antacids": ["High", "Medium"],
}

OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter'
NOMINATIM_API_URL = 'https://nominatim.openstreetmap.org/search'


@app.on_event("startup")
async def load_medical_data_and_initialize_firebase():
    global medical_data_df, db_firestore

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
        except Exception as e:
            print(f"ERROR: Failed to initialize Firebase Admin SDK from file: {e}. Firestore client will not be available.")
            db_firestore = None

    csv_path = os.path.join(os.path.dirname(__file__), CSV_FILE_NAME)
    encodings_to_try = ['utf-8', 'latin1', 'cp1252', 'ISO-8859-1']
    loaded_successfully = False
    last_error = None

    for encoding in encodings_to_try:
        try:
            medical_data_df = pd.read_csv(csv_path, encoding=encoding, sep=',', on_bad_lines='skip')
            
            if not medical_data_df.empty and all(col in medical_data_df.columns for col in ['Disease', 'Description', 'Symptoms', 'Medicines']):
                loaded_successfully = True
                break
            else:
                medical_data_df = None
                continue
        except (UnicodeDecodeError, pd.errors.ParserError) as e:
            last_error = e
            medical_data_df = None
            continue
        except FileNotFoundError:
            last_error = FileNotFoundError(f"'{CSV_FILE_NAME}' not found at '{csv_path}'.")
            loaded_successfully = False
            break
        except Exception as e:
            last_error = e
            loaded_successfully = False
            break

    if not loaded_successfully:
        print("All attempted loading combinations failed. Falling back to a dummy DataFrame.")
        medical_data_df = pd.DataFrame(
            columns=['Disease', 'Description', 'Symptoms', 'Medicines'],
            data=[
                ['common cold', 'a viral infection of the nose and throat', 'runny nose, sore throat, cough', 'pain relievers, decongestants'],
                ['influenza', 'a contagious respiratory illness caused by flu viruses', 'fever, body aches, cough, fatigue', 'antivirals, rest'],
                ['dummy disease', 'this is a dummy description for a missing CSV', 'dummy symptom 1, dummy symptom 2', 'dummy medicine']
            ]
        )
        if isinstance(last_error, FileNotFoundError):
             raise FileNotFoundError(f"Critical: '{CSV_FILE_NAME}' not found at '{csv_path}'. Check file path and name. ({last_error})")
        else:
            print(f"Warning: Failed to load medical data from '{CSV_FILE_NAME}' with any tried encoding/separator. Using dummy data. Last error: {last_error}")

    if not medical_data_df.empty and 'Disease' in medical_data_df.columns and medical_data_df.iloc[0]['Disease'] != 'dummy disease':
        temp_df = medical_data_df.copy()
        for col in ['Disease', 'Description', 'Symptoms', 'Medicines']:
            if col in temp_df.columns:
                temp_df[col] = temp_df[col].astype(str).fillna('').str.lower()
            else:
                print(f"Warning: Column '{col}' not found in '{CSV_FILE_NAME}'. This column will not be used for lookup/display.")
        medical_data_df = temp_df
    elif not medical_data_df.empty and ('Disease' not in medical_data_df.columns or medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        print(f"Info: Using dummy data or 'Disease' column not found in '{CSV_FILE_NAME}'. Subsequent operations might be limited.")


# --- Helper function to save chat history to Firestore ---
async def save_chat_history(user_id: str, query: str, response: dict, api_endpoint: str):
    """Saves a chat interaction to Firestore."""
    if db_firestore is None:
        print("Firestore client not initialized. Cannot save chat history.")
        return

    try:
        collection_ref = db_firestore.collection('artifacts').document(APP_ID).collection('users').document(user_id).collection('chat_history')

        chat_entry = {
            "user_id": user_id,
            "query": query,
            "response": response, # Store the full response from the API
            "api_endpoint": api_endpoint,
            "timestamp": firestore.SERVER_TIMESTAMP # Firestore automatically sets server timestamp
        }
        await collection_ref.add(chat_entry) # Use add() for auto-generated document ID
    except Exception as e:
        print(f"Error saving chat history to Firestore for user {user_id}: {e}")


# --- Authentication Dependency ---
async def get_current_user_id(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
    
    id_token = auth_header.split("Bearer ")[1] if "Bearer " in auth_header else None
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token not found in Authorization header"
        )

    if db_firestore is None: # Corrected from === to is None
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK not initialized. Cannot authenticate."
        )

    try:
        # Verify the ID token using Firebase Admin SDK
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        return uid
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {e}"
        )


# --- Define Input/Output Pydantic Models ---
class TextInput(BaseModel):
    text: str

class ImageInput(BaseModel):
    image_base64: str

class OCRResponse(BaseModel):
    extracted_text: str
    message: str = "OCR process completed."
    disclaimer: str = "OCR results may contain errors. Always verify critical information manually."

class MedicalInfo(BaseModel):
    Disease: str
    Description: str
    Symptoms: str
    Medicines: str

class MedicalResponse(BaseModel):
    results: list[MedicalInfo]
    message: str = "Query successful."
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
    disclaimer: str = "News articles are provided for informational purposes only and do not constitute medical advice. Please verify information from reliable sources."

class PharmacyAvailability(BaseModel):
    pharmacy_name: str
    address: str | None = None
    pincode: str | None = None
    stock: str

class MedicineAvailabilityRequest(BaseModel):
    medicine_name: str
    pincode: str | None = None

class MedicineAvailabilityResponse(BaseModel):
    medicine_name: str
    results: list[PharmacyAvailability]
    message: str = "Medicine availability search completed."
    disclaimer: str = "This data is simulated stock for real pharmacy locations from OpenStreetMap. Real-time stock may vary. Always confirm directly with the pharmacy."

# NEW: Pydantic model for Emergency Email Response
class EmergencyEmailResponse(BaseModel):
    status: str
    message: str
    recipient_email: str | None = None


# --- Define API Endpoints ---

@app.get("/")
async def root():
    data_status = f"Data loaded from '{CSV_FILE_NAME}'."
    if medical_data_df is not None and not medical_data_df.empty and ('Disease' in medical_data_df.columns and medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        data_status = "Using dummy data due to CSV loading errors."
    firebase_status = "Firestore initialized." if db_firestore else "Firestore NOT initialized."
    news_api_status = "NewsAPI key present." if NEWS_API_KEY else "NewsAPI key missing. News endpoint will not function."
    email_status = "Email service configured." if SMTP_SERVER and SMTP_USERNAME and SMTP_PASSWORD else "Email service NOT configured. Emergency email will not function."
    return {"message": f"Medizap Medical Data API is running. {data_status} {firebase_status} {news_api_status} {email_status}. Use /predict-symptoms, /predict-disease, /ocr/handwritten-text, /news or /search-medicine-availability endpoints for queries."}


@app.post("/predict-symptoms", response_model=MedicalResponse)
async def get_disease_info_by_disease_name(input_data: TextInput, user_id: str = Depends(get_current_user_id)):
    """
    Retrieves detailed information for a given disease name and saves interaction.
    """
    if medical_data_df is None or medical_data_df.empty or ('Disease' in medical_data_df.columns and medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        response = MedicalResponse(
            results=[],
            message="Data is not available. The server is using dummy data. Please check server logs for CSV loading errors.",
            disclaimer="This response is from dummy data due to a file loading issue. Please consult a qualified healthcare professional for actual medical advice."
        )
        await save_chat_history(user_id, input_data.text, response.dict(), "/predict-symptoms")
        return response
    
    query_text_lower = input_data.text.strip().lower()
    matching_rows = medical_data_df[
        medical_data_df['Disease'].str.contains(r'\b' + re.escape(query_text_lower) + r'\b', regex=True, na=False)
    ]
    
    if matching_rows.empty:
        matching_rows = medical_data_df[
            medical_data_df['Description'].str.contains(r'\b' + re.escape(query_text_lower) + r'\b', regex=True, na=False) |
            medical_data_df['Symptoms'].str.contains(r'\b' + re.escape(query_text_lower) + r'\b', regex=True, na=False)
        ]
        
    if matching_rows.empty:
        response = MedicalResponse(
            results=[], 
            message=f"No information found for '{input_data.text}'. Please try a different disease name or keyword."
        )
    else:
        results_data = matching_rows.head(5).to_dict(orient='records') 
        formatted_results = [
            MedicalInfo(
                Disease=row['Disease'].title(), 
                Description=row['Description'].capitalize(),
                Symptoms=row['Symptoms'].capitalize(),
                Medicines=row['Medicines'].capitalize()
            ) for row in results_data
        ]
        response = MedicalResponse(
            results=formatted_results, 
            message=f"Found information related to '{input_data.text}':"
        )
    
    await save_chat_history(user_id, input_data.text, response.dict(), "/predict-symptoms")
    return response


@app.post("/predict-disease", response_model=MedicalResponse)
async def get_disease_by_symptoms(input_data: TextInput, user_id: str = Depends(get_current_user_id)):
    """
    Retrieves diseases and their information that are associated with the given symptoms and saves interaction.
    """
    if medical_data_df is None or medical_data_df.empty or ('Disease' in medical_data_df.columns and medical_data_df.iloc[0]['Disease'] == 'dummy disease'):
        response = MedicalResponse(
            results=[],
            message="Data is not available. The server is using dummy data. Please check server logs for CSV loading errors.",
            disclaimer="This response is from dummy data due to a file loading issue. Please consult a qualified healthcare professional for actual medical advice."
        )
        await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease")
        return response
    
    input_symptoms_list = [s.strip().lower() for s in input_data.text.split(',') if s.strip()]

    if not input_symptoms_list:
        response = MedicalResponse(
            results=[], 
            message="Please provide some symptoms to search for diseases."
        )
        await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease")
        return response

    combined_filter = pd.Series([False] * len(medical_data_df), index=medical_data_df.index)
    for symptom in input_symptoms_list:
        symptom_pattern = r'\b' + re.escape(symptom) + r'\b'
        symptom_filter = medical_data_df['Symptoms'].str.contains(symptom_pattern, regex=True, na=False)
        combined_filter = combined_filter | symptom_filter

    matching_rows = medical_data_df[combined_filter].copy()
    
    if matching_rows.empty:
        response = MedicalResponse(
            results=[], 
            message=f"No diseases found matching the symptoms: '{input_data.text}'. Please try different symptoms or keywords."
        )
    else:
        matching_rows['match_count'] = matching_rows['Symptoms'].apply(
            lambda s: sum(1 for symp in input_symptoms_list if re.search(r'\b' + re.escape(symp) + r'\b', s, re.IGNORECASE))
        )
        matching_rows = matching_rows.sort_values(by=['match_count', 'Disease'], ascending=[False, True])
        results_data = matching_rows.head(5).to_dict(orient='records') 
        formatted_results = [
            MedicalInfo(
                Disease=row['Disease'].title(),
                Description=row['Description'].capitalize(),
                Symptoms=row['Symptoms'].capitalize(),
                Medicines=row['Medicines'].capitalize()
            ) for row in results_data
        ]
        response = MedicalResponse(
            results=formatted_results, 
            message=f"Diseases potentially related to '{input_data.text}':"
        )
    
    await save_chat_history(user_id, input_data.text, response.dict(), "/predict-disease")
    return response


# NEW ENDPOINT: OCR for Handwritten Text - NOW USES GEMINI API
@app.post("/ocr/handwritten-text", response_model=OCRResponse)
async def ocr_handwriting(input_data: ImageInput, user_id: str = Depends(get_current_user_id)):
    """
    Receives a Base64 encoded image, sends it to Gemini API for OCR,
    and returns the extracted text.
    """
    if not GOOGLE_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GOOGLE_API_KEY environment variable not set. Cannot perform OCR."
        )

    image_data_url = input_data.image_base64
    
    try:
        header, encoded_data = image_data_url.split(',', 1)
        mime_type = header.split(';')[0].split(':')[1]
        base64_only_data = encoded_data 
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Base64 image format or unsupported type: {e}. Expected 'data:image/...;base64,...'"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {e}"
        )

    gemini_api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GOOGLE_API_KEY}"
    
    prompt = "Extract all readable text from this image, focusing on any handwritten notes or prescription details. Provide the text clearly, preserving line breaks and original formatting as much as possible."

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    { "text": prompt },
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_only_data
                        }
                    }
                ]
            }
        ]
    }

    try:
        gemini_response = requests.post(
            gemini_api_url, 
            headers={'Content-Type': 'application/json'}, 
            data=json.dumps(payload)
        )
        gemini_response.raise_for_status()
        gemini_result = gemini_response.json()

        extracted_text = ""
        if gemini_result.get('candidates') and len(gemini_result['candidates']) > 0 and \
           gemini_result['candidates'][0].get('content') and \
           gemini_result['candidates'][0]['content'].get('parts') and \
           len(gemini_result['candidates'][0]['content']['parts']) > 0:
            extracted_text = gemini_result['candidates'][0]['content']['parts'][0].get('text', '')
        else:
            extracted_text = "Could not extract text. Gemini API returned an unexpected response."

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error calling Gemini API: {http_err} - Response: {gemini_response.text}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gemini API error: {http_err.response.text}"
        )
    except requests.exceptions.RequestException as req_err:
        print(f"Request error calling Gemini API: {req_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not connect to Gemini API: {req_err}"
        )
    except Exception as e:
        print(f"An unexpected error occurred during Gemini OCR: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred during OCR processing: {e}"
        )

    response_data = {"extracted_text": extracted_text}
    
    await save_chat_history(user_id, "OCR Request (Image Upload)", response_data, "/ocr/handwritten-text")

    return OCRResponse(extracted_text=extracted_text)


# NEW ENDPOINT: Fetch daily news related to health/medicine
@app.get("/news", response_model=NewsResponse)
async def get_daily_news(user_id: str = Depends(get_current_user_id), query: str = "health OR medicine OR disease", pageSize: int = 10):
    """
    Fetches daily news related to health, medicine, or diseases.
    """
    if not NEWS_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="News API Key is not configured on the server. Cannot fetch news."
        )

    news_api_url = "https://newsapi.org/v2/everything"
    params = {
        "q": query, # Search query
        "sortBy": "publishedAt", # Sort by most recent
        "language": "en", # English language articles
        "pageSize": pageSize, # Number of articles to return
        "apiKey": NEWS_API_KEY
    }

    try:
        response = requests.get(news_api_url, params=params)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        news_data = response.json()

        articles = []
        for article_data in news_data.get('articles', []):
            try:
                articles.append(NewsArticle(
                    source_name=article_data.get('source', {}).get('name'),
                    author=article_data.get('author'),
                    title=article_data.get('title'),
                    description=article_data.get('description'),
                    url=article_data.get('url'),
                    url_to_image=article_data.get('urlToImage'),
                    published_at=article_data.get('publishedAt'),
                    content=article_data.get('content')
                ))
            except Exception as e:
                print(f"Warning: Could not parse news article: {e} - Data: {article_data}")
                # Continue to next article if one fails to parse

        news_response = NewsResponse(
            articles=articles,
            total_results=news_data.get('totalResults', 0),
            message="Daily health news fetched successfully."
        )
        # Log the news fetching interaction (optional, but good for tracking)
        await save_chat_history(user_id, f"Fetched news (query: {query}, count: {len(articles)})", news_response.dict(), "/news")
        return news_response

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error fetching news: {http_err} - Response: {http_err.response.text}")
        raise HTTPException(
            status_code=http_err.response.status_code,
            detail=f"News API error: {http_err.response.text}"
        )
    except requests.exceptions.RequestException as req_err:
        print(f"Request error fetching news: {req_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not connect to News API: {req_err}"
        )
    except Exception as e:
        print(f"An unexpected error occurred while fetching news: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}"
        )

# NEW ENDPOINT: Search Medicine Availability
@app.post("/search-medicine-availability", response_model=MedicineAvailabilityResponse)
async def search_medicine_availability(request_data: MedicineAvailabilityRequest, user_id: str = Depends(get_current_user_id)):
    """
    Searches for the availability of a specific medicine in nearby pharmacies using Overpass API for locations
    and simulating stock.
    """
    medicine_name_lower = request_data.medicine_name.strip().lower()
    pincode_filter = request_data.pincode.strip() if request_data.pincode else None

    # 1. Geocode pincode to get coordinates
    lat, lon, location_name = None, None, None
    if pincode_filter:
        nominatim_url = f"{NOMINATIM_API_URL}?q={pincode_filter}&format=json&limit=1"
        try:
            response = requests.get(nominatim_url, headers={'User-Agent': 'MedizapApp/1.0'}) # User-Agent is good practice
            response.raise_for_status()
            data = response.json()
            if data and len(data) > 0:
                lat = float(data[0]['lat'])
                lon = float(data[0]['lon'])
                location_name = data[0]['display_name']
            else:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not geocode pincode: {pincode_filter}. Please enter a valid pincode.")
        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error geocoding pincode: {e}")
    else:
        # Fallback to a default location if no pincode is provided
        # For a real app, you might use user's profile location or IP-based geolocation
        lat, lon = 12.9716, 77.5946 # Default to Bengaluru, India
        location_name = "Bengaluru, India (Default)"

    # 2. Search for pharmacies near the coordinates using Overpass API
    overpass_query = f"""
        [out:json];
        node(around:5000,{lat},{lon})[amenity=pharmacy];
        out body;
        way(around:5000,{lat},{lon})[amenity=pharmacy];
        out body;
        rel(around:5000,{lat},{lon})[amenity=pharmacy];
        out body;
    """
    pharmacies = []
    try:
        response = requests.post(OVERPASS_API_URL, data=overpass_query, headers={'Content-Type': 'application/x-www-form-urlencoded'})
        response.raise_for_status()
        overpass_data = response.json()
        for element in overpass_data.get('elements', []):
            if 'tags' in element and 'name' in element['tags']:
                pharmacy_name = element['tags']['name']
                pharmacy_address = element['tags'].get('addr:full') or \
                                  f"{element['tags'].get('addr:housenumber', '')} {element['tags'].get('addr:street', '')}".strip() or \
                                  element['tags'].get('addr:place', '') or \
                                  "Address not available"
                pharmacy_pincode = element['tags'].get('addr:postcode', pincode_filter) # Use queried pincode if not in OSM data
                
                # Assign simulated stock based on medicine name
                possible_stocks = dummy_medicine_stock_levels.get(medicine_name_lower, ["Unknown"])
                simulated_stock = random.choice(possible_stocks)

                pharmacies.append(PharmacyAvailability(
                    pharmacy_name=pharmacy_name,
                    address=pharmacy_address,
                    pincode=pharmacy_pincode,
                    stock=simulated_stock
                ))
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching pharmacies from OpenStreetMap: {e}")

    # 3. Filter and prepare response
    found_results = []
    if pharmacies:
        # Sort pharmacies by a consistent criteria (e.g., name)
        pharmacies.sort(key=lambda x: x.pharmacy_name)
        
        # For demonstration, let's just return a subset or all found pharmacies with their simulated stock
        found_results = pharmacies[:10] # Limit to top 10 pharmacies for brevity

    message = ""
    if not found_results:
        message = f"No pharmacies found near {location_name} with potential availability for '{request_data.medicine_name}'."
        if pincode_filter:
            message += f" (Pincode: {pincode_filter})."
        message += " Try a different medicine, pincode, or expand your search area."
    else:
        message = f"Simulated availability for '{request_data.medicine_name}' near {location_name}:"
        if pincode_filter:
            message += f" (Pincode: {pincode_filter}):"

    response = MedicineAvailabilityResponse(
        medicine_name=request_data.medicine_name,
        results=found_results,
        message=message
    )

    await save_chat_history(user_id, f"Medicine search: {request_data.medicine_name} (Pincode: {pincode_filter or 'N/A'})", response.dict(), "/search-medicine-availability")
    return response

# NEW ENDPOINT: Send Emergency Email
# main.py

# ... (other imports and code) ...

# NEW ENDPOINT: Send Emergency Email
@app.post("/send-emergency-email", response_model=EmergencyEmailResponse)
async def send_emergency_email(user_id: str = Depends(get_current_user_id)):
    """
    Sends an emergency email to the user's pre-configured emergency contact.
    """
    if not (SMTP_SERVER and SMTP_USERNAME and SMTP_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service is not configured on the server. Please set SMTP_SERVER, SMTP_USERNAME, and SMTP_PASSWORD environment variables."
        )
    if db_firestore is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore DB instance not available. Cannot retrieve emergency contact."
        )

    # 1. Fetch user's emergency contact email from Firestore
    try:
        # Ensure we are using the async get() method from the document reference
        user_profile_doc_ref = db_firestore.collection('artifacts').document(APP_ID).collection('users').document(user_id).collection('profile_data').document(user_id)
        
        # This is the correct async call to get the DocumentSnapshot
        profile_snap = await user_profile_doc_ref.get() 

        if not profile_snap.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found. Cannot retrieve emergency contact."
            )

        # .to_dict() is a synchronous method on the DocumentSnapshot object
        profile_data = profile_snap.to_dict() 
        emergency_contact_email = profile_data.get('emergencyContact', {}).get('email')
        emergency_contact_name = profile_data.get('emergencyContact', {}).get('name', 'Your emergency contact')
        
        if not emergency_contact_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Emergency contact email not found in your profile. Please update your profile settings."
            )
        
        # Basic email format validation
        if not re.match(r"[^@]+@[^@]+\.[^@]+", emergency_contact_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid emergency contact email format. Please provide a valid email address."
            )

    except Exception as e:
        print(f"Error fetching emergency contact for email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve emergency contact from profile: {e}"
        )

    # 2. Prepare the email message
    sender_email = SMTP_USERNAME
    recipient_email = emergency_contact_email
    subject = f"EMERGENCY ALERT from Medizap - {profile_data.get('displayName', 'A User')}"
    
    body = f"""
    Dear {emergency_contact_name},

    This is an urgent automated emergency alert from Medizap.

    {profile_data.get('displayName', 'A user connected to you')} has just triggered an emergency alert via the Medizap application.

    Please try to contact them immediately.

    ---
    This is an automated message. Please do not reply to this email.
    """

    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = recipient_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    # 3. Send email via SMTP
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls() # Enable TLS encryption
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(sender_email, recipient_email, msg.as_string())
        
        response_data = EmergencyEmailResponse(
            status="success",
            message=f"Emergency email sent to {emergency_contact_name} ({recipient_email}).",
            recipient_email=recipient_email
        )
        await save_chat_history(user_id, "Emergency Email sent", response_data.dict(), "/send-emergency-email")
        return response_data

    except Exception as e:
        print(f"Error sending emergency email: {e}")
        error_detail = "Failed to send emergency email."
        if "authentication failed" in str(e).lower() or "username and password not accepted" in str(e).lower():
            error_detail += " Check SMTP_USERNAME and SMTP_PASSWORD. For Gmail, ensure 'App Passwords' are used if 2FA is on."
        elif "connection refused" in str(e).lower() or "timed out" in str(e).lower():
            error_detail += " Check SMTP_SERVER and SMTP_PORT. Ensure your server allows outbound connections on that port."
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{error_detail} Error: {e}"
        )


if __name__ == "_main_":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)