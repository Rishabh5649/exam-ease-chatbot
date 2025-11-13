import os
import io
import base64
import numpy as np
from PIL import Image
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS

# LLM client
from groq import Groq

# Face / emotion detection
import cv2
from deepface import DeepFace

# --- Load env and configuration ---
load_dotenv()

app = Flask(__name__)
# Allow requests from any origin for /chat during development
CORS(app, resources={r"/chat": {"origins": "*"}})

# --- Initialize Groq client safely ---
groq_api_key = os.getenv("GROQ_API_KEY")
client = None

if not groq_api_key:
    print("❌ GROQ_API_KEY missing in .env — Groq client disabled.")
else:
    try:
        client = Groq(api_key=groq_api_key)
        print("✅ Groq client initialized successfully.")
    except TypeError as e:
        # handle mismatched dependency error (e.g., unexpected 'proxies' kwarg)
        print(f"❌ Groq client TypeError: {e}")
        client = None
    except Exception as e:
        print(f"❌ Groq client init error: {e}")
        client = None

# --- Load / warm-up DeepFace models and Haar cascade ---
# Use OpenCV's default haarcascade path to be robust across systems
haar_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
try:
    face_cascade = cv2.CascadeClassifier(haar_path)
    if face_cascade.empty():
        print(f"❌ Failed to load Haar cascade from {haar_path}. Face detection disabled.")
        face_cascade = None
    else:
        print(f"✅ Haar cascade loaded from {haar_path}.")
except Exception as e:
    print(f"❌ Error loading Haar cascade: {e}")
    face_cascade = None

# Warm-up DeepFace emotion model to reduce first-call latency
try:
    print("⏳ Warming up DeepFace emotion model (may take a few seconds)...")
    DeepFace.build_model("Emotion")
    print("✅ DeepFace emotion model ready.")
except Exception as e:
    print(f"❌ Error warming DeepFace model: {e}")

# --- Bot persona (system prompt) ---
SYSTEM_PROMPT = """
You are Exam Ease, a supportive and empathetic chatbot designed to help students in India manage the stress of exams (like board exams, university finals, JEE, NEET, etc.).
Your personality is calm, encouraging, and understanding. You are a supportive peer, not a therapist.
Keep responses concise, friendly, and easy to read.
Never give medical advice. If a user expresses thoughts of self-harm, your ONLY goal is to provide the KIRAN Mental Health Helpline number (1800-599-0019) and encourage them to call.
"""

# Conversation history in memory
chat_history = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "assistant", "content": "Hello! I'm Exam Ease, your friendly support bot. Exam season can be tough, but you're not alone. What's on your mind today?"}
]

# --- Helper: emotion detection from a base64 image string ---
def detect_emotion_from_image(base64_image_data: str):
    """
    Accepts a base64 data URL (e.g. "data:image/jpeg;base64,...."),
    converts to an OpenCV BGR frame, tries Haar face detection and then
    uses DeepFace.analyze to predict emotion. Returns a string label.
    """
    if not face_cascade:
        print("❌ face_cascade is not available. Skipping face detection.")
        return "unknown"

    if not base64_image_data:
        print("❌ No image data provided to detect_emotion_from_image.")
        return "no_image"

    try:
        # split header if present
        if "," in base64_image_data:
            header, encoded = base64_image_data.split(",", 1)
        else:
            encoded = base64_image_data

        image_bytes = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        frame = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

        # Convert to grayscale for Haar detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        print(f"DEBUG: faces detected: {len(faces)}")

        # If no faces found, still try DeepFace with enforce_detection=False
        try:
            result = DeepFace.analyze(
                frame,
                actions=["emotion"],
                detector_backend="opencv",
                enforce_detection=False
            )
        except Exception as e:
            print(f"❌ DeepFace.analyze raised exception: {e}")
            return "error"

        # result may be a list or dict depending on deepface version
        if isinstance(result, list) and len(result) > 0:
            result = result[0]

        detected_emotion = result.get("dominant_emotion", "neutral")
        print(f"🧠 Detected emotion: {detected_emotion}")
        return detected_emotion

    except Exception as e:
        print(f"❌ Exception in detect_emotion_from_image: {e}")
        return "error"

# --- /chat endpoint (receives message + optional base64 image) ---
@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    # Handle preflight
    if request.method == "OPTIONS":
        return "", 204

    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON payload"}), 400

        user_message = data.get("message")
        image_data = data.get("image")  # optional base64 data URL

        if not user_message:
            return jsonify({"error": "No message provided"}), 400

        # Detect emotion if image provided
        detected_emotion = "unknown"
        if image_data:
            detected_emotion = detect_emotion_from_image(image_data)

        # Append user message and the emotion context to the chat history
        chat_history.append({"role": "user", "content": user_message})

        # If Groq client is available, call the LLM; else produce a simple fallback reply
        if client:
            # Add a contextual system message about the detected emotion
            augmented_history = chat_history + [
                {"role": "system", "content": f"Context: The user's facial expression appears to be '{detected_emotion}'. Please consider this when replying."}
            ]
            try:
                response = client.chat.completions.create(
                    messages=augmented_history,
                    model="llama-3.1-8b-instant"
                )
                bot_reply = response.choices[0].message.content
            except Exception as e:
                print(f"❌ Error calling Groq LLM: {e}")
                bot_reply = "Sorry, I'm having trouble generating a thoughtful reply right now. Please try again in a moment."
        else:
            # Fallback reply when Groq is not initialized
            bot_reply = "Hello — I'm running in offline mode right now and can't access the language model. I can still try to help: " + (
                user_message[:300] + ("..." if len(user_message) > 300 else "")
            )

        # Save bot reply to history
        chat_history.append({"role": "assistant", "content": bot_reply})

        # Return both reply and detected emotion to frontend
        return jsonify({"reply": bot_reply, "emotion": detected_emotion})

    except Exception as e:
        print(f"An error occurred in /chat: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

# --- Run locally ---
if __name__ == "__main__":
    print("Starting Flask server on port 5000...")
    app.run(debug=True, port=5000)
