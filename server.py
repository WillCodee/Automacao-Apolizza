#!/usr/bin/env python3
"""Servidor local com proxy reverso para a API do ClickUp (resolve CORS)."""

import http.server
import urllib.request
import urllib.error
import json
import os
import sys

PORT = 8080
CLICKUP_API = "https://api.clickup.com/api/v2"
CLICKUP_TOKEN = "pk_61006622_9IIQ18GMO2C22ER8C8UP2D214GDBHITO"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


class DashboardHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        # Proxy: /api/v2/* -> ClickUp API
        if self.path.startswith("/api/v2/"):
            self.proxy_clickup()
            return
        # Redireciona / para dashboard.html
        if self.path == "/":
            self.path = "/dashboard.html"
        super().do_GET()

    def do_PUT(self):
        if self.path.startswith("/api/v2/"):
            self.proxy_clickup(method="PUT")
            return
        self.send_error(405)

    def proxy_clickup(self, method="GET"):
        target_url = CLICKUP_API + self.path[len("/api/v2"):]
        headers = {"Authorization": CLICKUP_TOKEN, "Content-Type": "application/json"}

        body = None
        if method == "PUT":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length else None

        try:
            req = urllib.request.Request(target_url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Content-Length", len(data))
                self.end_headers()
                self.wfile.write(data)
        except urllib.error.HTTPError as e:
            error_body = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", len(error_body))
            self.end_headers()
            self.wfile.write(error_body)
        except Exception as e:
            error_msg = json.dumps({"error": str(e)}).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", len(error_msg))
            self.end_headers()
            self.wfile.write(error_msg)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        path = args[0].split()[1] if args else ""
        if path.startswith("/api/"):
            sys.stderr.write(f"\033[36m[PROXY]\033[0m {format % args}\n")
        else:
            sys.stderr.write(f"\033[32m[FILE]\033[0m  {format % args}\n")


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), DashboardHandler)
    print(f"\033[32m{'='*50}\033[0m")
    print(f"\033[32m  Dashboard Apolizza - Servidor Local\033[0m")
    print(f"\033[32m  http://localhost:{PORT}\033[0m")
    print(f"\033[32m  Proxy ClickUp API ativo em /api/v2/*\033[0m")
    print(f"\033[32m{'='*50}\033[0m")
    print(f"\033[33m  Pressione Ctrl+C para parar\033[0m\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
        server.server_close()
