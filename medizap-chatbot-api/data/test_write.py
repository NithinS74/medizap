import joblib
import json
import os

print(f"Running test_write.py in: {os.getcwd()}")

# --- Test Joblib dump ---
test_object_joblib = {'key': 'value', 'data': [1, 2, 3]}
joblib_test_path = 'test_joblib_dump.pkl'
try:
    joblib.dump(test_object_joblib, joblib_test_path)
    print(f"Successfully wrote {joblib_test_path}")
except Exception as e:
    print(f"Error writing {joblib_test_path}: {e}")

# --- Test JSON dump ---
test_object_json = {'name': 'Test', 'items': ['a', 'b', 'c']}
json_test_path = 'test_json_dump.json'
try:
    with open(json_test_path, 'w') as f:
        json.dump(test_object_json, f)
    print(f"Successfully wrote {json_test_path}")
except Exception as e:
    print(f"Error writing {json_test_path}: {e}")

print("Test write script finished.")