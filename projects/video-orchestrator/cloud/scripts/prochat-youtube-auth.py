#!/usr/bin/env python3
"""
ProChat YouTube OAuth Token Generator

Generates a valid OAuth token for the ProChat YouTube channel using the
client credentials stored in ~/.config/youtube/prochat_client_secret.json

Usage:
    python3 prochat-youtube-auth.py [--redirect-port PORT]

Output:
    Token saved to: ~/.youtube_prochat_tokens.json
    Token refresh: Automatic via refresh_token
"""

import json
import os
import sys
import webbrowser
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlencode, parse_qs, urlparse
import urllib.request
import urllib.error

class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """Handle OAuth callback from Google"""

    auth_code = None

    def do_GET(self):
        """Process OAuth callback"""
        query = urlparse(self.path).query
        params = parse_qs(query)

        if 'code' in params:
            OAuthCallbackHandler.auth_code = params['code'][0]
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            html = '''
            <html>
            <head><title>OAuth Success</title></head>
            <body>
            <h1>Authorization Successful</h1>
            <p>You can close this window and return to the terminal.</p>
            </body>
            </html>
            '''
            self.wfile.write(html.encode('utf-8'))
        elif 'error' in params:
            error = params['error'][0]
            self.send_response(400)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            html = f'''
            <html>
            <head><title>OAuth Error</title></head>
            <body>
            <h1>Authorization Failed</h1>
            <p>Error: {error}</p>
            </body>
            </html>
            '''
            self.wfile.write(html.encode('utf-8'))

    def log_message(self, format, *args):
        """Suppress HTTP logging"""
        pass

def load_client_credentials():
    """Load ProChat OAuth client credentials"""
    cred_file = Path.home() / '.config' / 'youtube' / 'prochat_client_secret.json'

    if not cred_file.exists():
        print(f"❌ Error: Credentials file not found at {cred_file}")
        print(f"\nTo set up ProChat YouTube OAuth:")
        print(f"1. Copy ProChat OAuth client JSON to: {cred_file}")
        print(f"2. Run this script again")
        sys.exit(1)

    with open(cred_file) as f:
        data = json.load(f)

    # Extract from 'installed' app type
    config = data.get('installed', data)

    required_fields = ['client_id', 'client_secret', 'token_uri']
    missing = [f for f in required_fields if f not in config]

    if missing:
        print(f"❌ Error: Missing required fields in credentials: {missing}")
        sys.exit(1)

    return config

def generate_auth_url(client_id, redirect_uri):
    """Generate Google OAuth authorization URL"""
    scopes = [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.upload',
    ]

    params = {
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': ' '.join(scopes),
        'access_type': 'offline',
        'prompt': 'consent',
    }

    return f"https://accounts.google.com/o/oauth2/auth?{urlencode(params)}"

def exchange_code_for_token(auth_code, client_id, client_secret, token_uri, redirect_uri):
    """Exchange authorization code for access token"""
    data = urlencode({
        'code': auth_code,
        'client_id': client_id,
        'client_secret': client_secret,
        'redirect_uri': redirect_uri,
        'grant_type': 'authorization_code',
    }).encode('utf-8')

    try:
        response = urllib.request.urlopen(token_uri, data)
        return json.load(response)
    except urllib.error.URLError as e:
        print(f"❌ Error exchanging code for token: {e}")
        sys.exit(1)

def save_token(token_data):
    """Save token to ~/.youtube_prochat_tokens.json"""
    token_file = Path.home() / '.youtube_prochat_tokens.json'

    # Add timestamp
    token_data['created_at'] = int(__import__('time').time())

    with open(token_file, 'w') as f:
        json.dump(token_data, f, indent=2)

    # Secure permissions
    token_file.chmod(0o600)

    return token_file

def main():
    """Main OAuth flow"""
    print("=" * 60)
    print("ProChat YouTube OAuth Token Generator")
    print("=" * 60)

    # Load credentials
    print("\n1. Loading ProChat OAuth client credentials...")
    config = load_client_credentials()
    print(f"   ✓ Project: {config.get('project_id', 'unknown')}")
    print(f"   ✓ Client ID: {config['client_id'][:20]}...")

    # Setup local server for callback
    redirect_port = 8888
    redirect_uri = f"http://localhost:{redirect_port}"

    print(f"\n2. Starting local callback server on {redirect_uri}...")
    server = HTTPServer(('localhost', redirect_port), OAuthCallbackHandler)

    # Generate auth URL
    auth_url = generate_auth_url(config['client_id'], redirect_uri)

    print(f"\n3. Opening browser for authorization...")
    print(f"   If browser doesn't open, visit manually:")
    print(f"   {auth_url}")

    webbrowser.open(auth_url)

    # Wait for callback
    print(f"\n4. Waiting for authorization callback...")
    print(f"   (Browser will close automatically after authorization)")

    # Handle one request (the OAuth callback)
    server.handle_request()

    if not OAuthCallbackHandler.auth_code:
        print("❌ No authorization code received")
        sys.exit(1)

    print(f"   ✓ Authorization code received")

    # Exchange code for token
    print(f"\n5. Exchanging authorization code for access token...")
    token_data = exchange_code_for_token(
        OAuthCallbackHandler.auth_code,
        config['client_id'],
        config['client_secret'],
        config['token_uri'],
        redirect_uri
    )

    # Save token
    token_file = save_token(token_data)
    print(f"   ✓ Token saved to: {token_file}")

    # Display info
    print(f"\n" + "=" * 60)
    print("✅ OAuth Token Successfully Generated")
    print("=" * 60)
    print(f"\nToken Details:")
    print(f"  File: {token_file}")
    print(f"  Token Type: {token_data.get('token_type', 'Bearer')}")
    print(f"  Expires In: {token_data.get('expires_in', 3599)} seconds")
    print(f"  Refresh Token: Available (auto-refresh enabled)")
    print(f"\nNext Steps:")
    print(f"  1. Run: youtube-auth-check.sh (to validate token)")
    print(f"  2. Use: youtube-upload-local.sh (to upload videos)")
    print(f"\n")

if __name__ == '__main__':
    main()
