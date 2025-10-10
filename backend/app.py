import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq

# Load environment variables from a .env file
load_dotenv()

# --- CONFIGURATION ---
app = Flask(__name__)
# Allow requests from your frontend's origin (e.g., http://localhost:5173)
CORS(app, resources={r"/chat": {"origins": "*"}}) 

# Configure the Groq API client
try:
    groq_api_key = os.environ.get("GROQ_API_KEY")
    client = Groq(api_key=groq_api_key)
    print("✅ Groq client initialized successfully.")
except Exception as e:
    print(f"❌ Error initializing Groq client: {e}")
    raise ValueError("Groq API Key not found or is invalid. Please set it in your .env file.")


# Define the bot's persona and rules (System Prompt)
SYSTEM_PROMPT = """
You are Exam Ease, a supportive and empathetic chatbot designed to help students in India manage the stress of exams (like board exams, university finals, JEE, NEET, etc.). 
Your personality is calm, encouraging, and understanding. You are a supportive peer, not a therapist. 
Keep responses concise, friendly, and easy to read. 
Never give medical advice. If a user expresses thoughts of self-harm, your ONLY goal is to provide the KIRAN Mental Health Helpline number (1800-599-0019) and encourage them to call.
"""

# Store conversation history in memory
chat_history = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "assistant", "content": "Hello! I'm Exam Ease, your friendly support bot. Exam season can be tough, but you're not alone. What's on your mind today?"}
]

# --- API ENDPOINT ---
@app.route('/chat', methods=['POST', 'OPTIONS'])
def chat():
    # Handle the browser's preflight "safety-check" request
    if request.method == 'OPTIONS':
        return '', 204

    try:
        user_message = request.json.get('message')
        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        # Add user message to history
        chat_history.append({"role": "user", "content": user_message})

        # Generate the chat completion
        chat_completion = client.chat.completions.create(
            messages=chat_history,
            model="llama-3.1-8b-instant", # Using the powerful Llama 3 70B model
        )
        
        bot_reply = chat_completion.choices[0].message.content
        
        # Add bot's reply to history
        chat_history.append({"role": "assistant", "content": bot_reply})

        return jsonify({"reply": bot_reply})

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

# --- RUN THE APP LOCALLY ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)

