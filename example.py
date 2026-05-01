import os
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from openai import OpenAI, NotFoundError # Import the NotFoundError class

# Load environment variables from a .env file
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Configuration ---
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")

# Check if the API key is available
if not NVIDIA_API_KEY:
    raise ValueError("NVIDIA_API_KEY is not set in the environment. Please check your .env file.")

# --- Initialize the OpenAI client for NVIDIA API ---
# This is the new, recommended way based on the snippet you found.
client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1", # The base URL for NVIDIA's OpenAI-compatible API
  api_key = NVIDIA_API_KEY
)

@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    # --- Get Image Data from Frontend ---
    data = request.json
    if not data or 'image' not in data:
        return jsonify({'error': 'No image data provided'}), 400

    # The image is sent as a data URL (e.g., "data:image/jpeg;base64,...")
    image_data_url = data['image']

    # --- Construct the Payload using the OpenAI library's format ---
    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "You are Euclid, an expert assistant. Look at this image and provide a concise, step-by-step guide on what to do next. Your response should be helpful and clear."
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_data_url # The OpenAI library handles data URLs
                    }
                }
            ]
        }
    ]

    try:
        # --- Make the API Call using the client ---
        # The model name has been updated to the Nemotron model you selected.
        completion = client.chat.completions.create(
          model="nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
          messages=messages,
          max_tokens=1024,
          temperature=1.0,
          top_p=0.01,
          stream=False # Keeping stream=False as the frontend is not set up to handle streaming
        )

        # --- Process the Response ---
        # The response object is now structured and easy to parse
        response_content = completion.choices[0].message.content
        return jsonify({'response': response_content})

    except NotFoundError as e:
        # This is a specific error for when the NVIDIA API returns a 404
        print(f"NVIDIA API Error: Model not found. Please check the model name in app.py. Details: {e}")
        error_message = (
            "The specified AI model was not found (404 Error). "
            "Please ensure the model name 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1' is correct and available on the NVIDIA API."
        )
        return jsonify({'error': error_message}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({'error': f'An unexpected error occurred on the server. Details: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001)