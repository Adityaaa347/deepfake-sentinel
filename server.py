#!/usr/bin/env python3
"""
Veritas Forensic Core - Local Zero-Dependency Server
Uses Python standard library only (http.server)
"""

import http.server
import socketserver
import os
import webbrowser
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS and disable cache during development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

def run():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("================================================================")
        print(" VERITAS // DEEPFAKE SENTINEL & CYBER POLICE SUITE")
        print(" Zero External Dependencies - 100% Local Forensic Processing")
        print(f" Serving live at: http://localhost:{PORT}")
        print("================================================================")
        
        # Optionally launch default browser
        if "--open" in sys.argv:
            try:
                webbrowser.open(f"http://localhost:{PORT}")
            except Exception:
                pass
                
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    run()
