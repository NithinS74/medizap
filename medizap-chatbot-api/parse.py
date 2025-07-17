import pandas as pd
import json

# Load the dataset
# It's good practice to specify the encoding if you know it,
# or let pandas try to infer. 'utf-8' is a common default.
# The `on_bad_lines='skip'` can be useful if your CSV has malformed rows.
df = pd.read_csv('./book1.csv', encoding='utf-8', on_bad_lines='skip')

# Clean and process
disease_data = []
for _, row in df.iterrows():
    # Ensure all fields are treated as strings before stripping and splitting
    # This handles cases where a cell might be NaN (float) or other non-string type
    disease = str(row['Disease']).strip()
    description = str(row['Description']).strip()

    # Convert to string, split by comma, strip whitespace from each item,
    # convert to lowercase, and filter out any empty strings that might result
    # from multiple commas (e.g., "symptom1,,symptom2") or trailing commas.
    symptoms = [s.strip().lower() for s in str(row['Symptoms']).split(',') if s.strip()]

    # Apply the same logic for medicines
    medicines = [m.strip() for m in str(row['Medicines']).split(',') if m.strip()]
    
    disease_data.append({
        "disease": disease,
        "description": description,
        "symptoms": symptoms,
        "medicines": medicines
    })

# Save to JSON (or pass to LangChain directly)
with open("disease_knowledge.json", "w") as f:
    json.dump(disease_data, f, indent=2)

print("CSV parsing complete and 'disease_knowledge.json' created successfully.")
