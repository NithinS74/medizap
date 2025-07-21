import json

# Set the conversion rate from Indonesian Rupiah (IDR) to Indian Rupees (INR)
# Based on the current approximate exchange rate.
IDR_TO_INR_RATE = 0.0053

# Define the input and output filenames
input_filename = 'data-drug.json'
output_filename = 'data-drug-inr.json'

try:
    # --- Step 1: Read the original JSON data ---
    # Open the input file in read mode with UTF-8 encoding to handle special characters.
    with open(input_filename, 'r', encoding='utf-8') as f:
        drug_data = json.load(f)

    # --- Step 2: Process and convert the prices ---
    # Loop through each drug record in the loaded data.
    for drug in drug_data:
        # Check if the 'price' key exists and is a list to avoid errors.
        if 'price' in drug and isinstance(drug['price'], list):
            # Loop through each price entry within the drug's price list.
            for price_entry in drug['price']:
                # Ensure the 'price' key exists within the price entry.
                if 'price' in price_entry:
                    try:
                        # Convert the price string to a floating-point number.
                        idr_price = float(price_entry['price'])
                        
                        # Apply the exchange rate to calculate the price in INR.
                        inr_price = idr_price * IDR_TO_INR_RATE
                        
                        # Update the price value with the new INR price,
                        # formatted as a string with two decimal places.
                        price_entry['price'] = f"{inr_price:.2f}"
                    except (ValueError, TypeError) as e:
                        # Handle cases where the price is not a valid number.
                        print(f"Warning: Could not convert price for drug '{drug.get('name', 'Unknown')}'. Invalid price value: {price_entry['price']}. Error: {e}")

    # --- Step 3: Save the updated data to a new file ---
    # Open the output file in write mode.
    with open(output_filename, 'w', encoding='utf-8') as f:
        # Write the modified Python dictionary back to a JSON file.
        # `indent=4` makes the file human-readable.
        # `ensure_ascii=False` preserves non-ASCII characters.
        json.dump(drug_data, f, indent=4, ensure_ascii=False)

    print(f"Success! Price conversion is complete.")
    print(f"The updated data has been saved to '{output_filename}'.")

# --- Error Handling ---
except FileNotFoundError:
    print(f"Error: The file '{input_filename}' was not found. Please make sure it is in the same directory as the script.")
except json.JSONDecodeError:
    print(f"Error: The file '{input_filename}' is not a valid JSON file. Please check its format.")
except Exception as e:
    print(f"An unexpected error occurred: {e}")
