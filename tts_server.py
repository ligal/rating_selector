from flask import Flask, request, send_file, jsonify
from gtts import gTTS
from io import BytesIO
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/tts', methods=['GET'])
def tts():
    text = request.args.get('text', '')
    lang = request.args.get('lang', 'he')
    slow = request.args.get('slow', 'false').lower() in ('1', 'true', 'yes')

    if not text:
        return jsonify({'error': 'missing text parameter'}), 400

    try:
        t = gTTS(text, lang=lang, slow=slow)
        buf = BytesIO()
        t.write_to_fp(buf)
        buf.seek(0)
        return send_file(buf, mimetype='audio/mpeg', as_attachment=False, download_name='tts.mp3')
    except Exception as e:
        return jsonify({'error': 'tts failed', 'details': str(e)}), 500

if __name__ == '__main__':
    # Run on localhost:5002
    app.run(host='127.0.0.1', port=5002)
