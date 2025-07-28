import os
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_caching import Cache
import redis
from datetime import datetime, timezone
import uuid
import json
import ollama
from flask_cors import CORS
# client = ollama.Client()

# model = "gemma3"
# prompt = "What is the capital of Pakistan?"

# response = client.generate(model=model, prompt=prompt)

# print(f"Model: {model}")
# print(f"Prompt: {prompt}")
# print(f"Response: {response['response']}")

app = Flask(__name__)
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://chatuser:chatpass@localhost:5432/ollama_chat')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

app.config.update(
    SQLALCHEMY_DATABASE_URI=DATABASE_URL,
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    CACHE_TYPE='RedisCache',
    CACHE_REDIS_URL=REDIS_URL,
    SECRET_KEY=os.getenv('SECRET_KEY', 'your-secret-key-change-in-production'),
    SESSION_TYPE='redis',
    SESSION_REDIS=redis.from_url(REDIS_URL)
)

# Initialize extensions
db = SQLAlchemy(app)
migrate = Migrate(app, db)
cache = Cache(app)
redis_client = redis.from_url(REDIS_URL)
app = Flask(__name__)

CORS(app)

client = ollama.Client()

def parse_data(request):
    data = request.json
    user_message = data.get('user_message', '')
    model = data.get('model', 'gemma3')
    if not user_message:
        return None, None, jsonify({"error": "User message is required"}), 400
    if not model:
        return None, None, jsonify({"error": "Model is required"}), 400
    return user_message, model, None, None
  
# what does serve frontend do and why is it neccessary?
@app.route('/')
def serve_frontend():
    """Serve the frontend HTML file"""
    return send_from_directory('.', 'index.html')  
# what does serve static do and why is it neccessary?
@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS)"""
    return send_from_directory('.', filename)
    
@app.route('/generate', methods=['POST'])
def chat():
    try:
      user_message, model, error_response, status_code = parse_data(request)
      
      if error_response:
            return error_response, status_code
      
      print(f"Received message for model {model}:")
      print(f"Content: {user_message[:100]}{'...' if len(user_message) > 100 else ''}")
        
      # Generate response using Ollama
      response = client.generate(model=model, prompt=user_message)
      
      return jsonify({
          "model": model,
          "prompt": user_message,
          "response": response['response']
      })
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error in chat endpoint: {error_msg}")
        
        # Handle specific Ollama errors
        if "model" in error_msg.lower() and "not found" in error_msg.lower():
            return jsonify({
                "error": f"Model '{request.json.get('model', 'unknown')}' not found. Please make sure it's downloaded with 'ollama pull {request.json.get('model', 'gemma3')}'",
                "status": "error"
            }), 404
        elif "connection" in error_msg.lower():
            return jsonify({
                "error": "Cannot connect to Ollama server. Please make sure Ollama is running.",
                "status": "error"
            }), 503
        else:
            return jsonify({
                "error": f"Server error: {error_msg}",
                "status": "error"
            }), 500

      
@app.route('/models', methods=['GET'])
def get_available_models():
  """Get list of available models from Ollama"""
  try:
      # This would require ollama client to have a list method
      # For now, return a default list
      models = [
          {"name": "gemma3", "size": "3.3GB"},
          {"name": "llama3", "size": "4.7GB"},
          {"name": "mistral", "size": "4.1GB"},
          {"name": "codellama", "size": "3.8GB"},
          {"name": "phi3", "size": "2.3GB"}
      ]
      
      return jsonify({"models": models})
  except Exception as e:
      return jsonify({"error": str(e)}), 500
def health_check():
  """Health check endpoint"""
  try:
      # Test connection to Ollama
      response = client.generate(model='gemma3', prompt='Hello', stream=False)
      return jsonify({"status": "healthy", "ollama": "connected"})
  except Exception as e:
      return jsonify({"status": "unhealthy", "error": str(e)}), 503

if __name__ == '__main__':
  print("Starting Ollama Chat Backend...")
  print("Make sure Ollama is running: ollama serve")
  print("Available at: http://localhost:5000")
  
  # Check if running in development
  debug_mode = os.environ.get('FLASK_ENV') == 'development'
  
  app.run(host='0.0.0.0', port=5001, debug=debug_mode)