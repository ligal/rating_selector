# Serverless Redesign Plan — Azure SQL + Azure Functions (GitHub Pages front-end)

Overview
- Objective: Move the word list from a static file to a serverless backend using Azure SQL (serverless) as the canonical store and Azure Functions as the API layer, while keeping the public front-end on GitHub Pages. Add a small manage UI on the site to manage words and their audio. For now we will not implement user accounts or user management; write operations are protected by a function key.

Architecture
- Front-end: GitHub Pages (existing site). Add a /manage SPA that calls the API.
- API: Azure Functions (HTTP-triggered). Functions validate a function-key header for write operations.
- Database: Azure SQL (Serverless tier) for words and audio; auto-pauses when idle to reduce cost. Audio will be stored in the Words table as VARBINARY(MAX).
- Storage: No separate storage account; audio files will live in the SQL DB for this MVP.

Azure Resources to Provision
- Azure SQL Database (Serverless). Minimal cores and low storage to save costs. Enable automated backups.
- Function App (Consumption plan recommended initially). Set app settings: SQL_CONN, FUNCTION_MANAGE_KEY (or use Function-native keys), CORS origins.

DB Schema (core table)
- Words
  - id INT IDENTITY PRIMARY KEY
  - word NVARCHAR(200) NOT NULL UNIQUE
  - audio VARBINARY(MAX) NULL -- store mp3 bytes
  - audio_filename NVARCHAR(255) NULL
  - audio_mime NVARCHAR(100) NULL -- e.g., 'audio/mpeg'
  - created_at DATETIME2 DEFAULT SYSUTCDATETIME()
  - updated_at DATETIME2 NULL

Note: audit table and separate storage account references removed per requirements.

API Endpoints (Functions)
- GET /api/words
  - Public read endpoint. Returns JSON array of metadata: [{id, word, hasAudio, audioUrl}] (optional pagination).
- GET /api/words/{id}/audio
  - Public. Returns binary audio stream from the audio column. Sets Content-Type to audio_mime.
- POST /api/words
  - Manage-only (function key). Accept multipart/form-data (fields: word, file=file) or JSON with base64. Inserts or updates word + audio into SQL.
- DELETE /api/words/{id}
  - Manage-only (function key). Deletes word row.
- POST /api/migrate (manage)
  - One-off migration helper to import public/tts/*.mp3 into DB (or run a local migration script).

Security and Auth
- For MVP: use a Function key for write endpoints. Store the key in Function App settings and send via X-Manage-Key or X-Function-Key header or as query param for manage calls.
- Enforce CORS to the GitHub Pages origin(s) only.
- Validate and sanitize inputs server-side; enforce max word length and reject malformed requests.
- Use HTTPS for all endpoints.

Front-end Changes
- Manage page (/manage): a small SPA page added to the repo to list words, add/delete words, and require the function key (entered by manager). There is no user account or login flow in this MVP.
- Public pages: switch reads from public/words.txt to GET /api/words. Keep fallback to public/words.txt for resilience during transition.

Migration Plan
- A Node or Python migration script can enumerate public/tts/*.mp3, derive the word from the filename (decode URL-encoded names), read file bytes into a Buffer and INSERT INTO Words (word, audio, audio_filename, audio_mime).
- Optional: keep public/tts as a fallback during transition, but this plan treats SQL as the primary storage for audio.

CI/CD and Deployment
- Use GitHub Actions to deploy Azure Functions (use azure/functions-action) and optionally run DB migrations.
- Store AZURE_CREDENTIALS and any deployment secrets in GitHub Secrets.

Operational Notes
- Cost: choose Serverless Azure SQL to minimize cost when idle. Functions typically remain in free tier for light traffic.
- Monitoring: enable Application Insights for Functions.
- Backups: use built-in SQL backups and retention policy.
- Secrets: store SQL_CONN and function keys in Function App Configuration (not in client code).

MVP Implementation Steps (to perform next)
1) Create resource definitions (ARM/Bicep or manual via Portal) for: Azure SQL (serverless) and Function App.
2) Implement a Functions project (Node) with GET/POST/DELETE endpoints and config to read SQL_CONN and function key.
3) Add a migration script (Node or Python) to import public/tts/*.mp3 into the DB.
4) Add /manage page to the front-end that calls POST/DELETE endpoints (protected by function key entered by manager).
5) Test end-to-end locally (Functions Core Tools) and on deployed resources. Enable CORS.
6) Deploy via GitHub Actions and run migration once.

Files to add during implementation
- functions/ (Azure Functions project)
  - host.json, local.settings.json (local only), package.json, index.js handlers
- migrations/import_words.js (migration script)
- public/manage.html (manage page + small UI)
- .github/workflows/azure-functions-deploy.yml (deploy workflow)

Environment Variables / App Settings
- SQL_CONN: full connection string to Azure SQL
- FUNCTION_MANAGE_KEY: function key used to protect write endpoints
- CORS_ALLOWED_ORIGINS: https://<your-gh-pages>.github.io

Future Enhancements
- Replace function-key auth with Azure AD for manage users when you want per-user identity.
- If you later prefer, move TTS files to Blob Storage for better lifecycle & bandwidth control.
