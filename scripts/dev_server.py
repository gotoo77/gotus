#!/usr/bin/env python3
"""Serveur local de développement avec erreurs lisibles."""

from __future__ import annotations

import argparse
import errno
import http.server
import json
import socket
import socketserver
import sys
from pathlib import Path


DEFAULT_CONFIG = Path(__file__).with_name("dev_server.config.json")
DEFAULT_HOST = "localhost"
DEFAULT_PORT = 8080


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Lance le serveur local de Gotus.")
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG,
        help="Fichier JSON de configuration du serveur.",
    )
    parser.add_argument("--host", help="Adresse d'écoute.")
    parser.add_argument("--port", type=int, help="Port d'écoute.")
    return parser.parse_args()


def read_config(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"{path}: JSON invalide : {error}") from error

    if not isinstance(data, dict):
        raise ValueError(f"{path}: la configuration doit être un objet JSON.")
    return data


def server_options(args: argparse.Namespace) -> tuple[str, int]:
    config = read_config(args.config)
    host = args.host or str(config.get("host") or DEFAULT_HOST)
    port_value = args.port if args.port is not None else config.get("port", DEFAULT_PORT)

    try:
        port = int(port_value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"Port invalide : {port_value!r}") from error

    if not 1 <= port <= 65535:
        raise ValueError(f"Port invalide : {port}.")
    return host, port


def local_ip() -> str | None:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("8.8.8.8", 80))
            return probe.getsockname()[0]
    except OSError:
        return None


def display_urls(host: str, port: int) -> None:
    if host in {"0.0.0.0", "::"}:
        print(f"Serveur local : http://localhost:{port}/", flush=True)
        if ip := local_ip():
            print(f"Depuis Windows/WSL : http://{ip}:{port}/", flush=True)
        return

    print(f"Serveur local : http://{host}:{port}/", flush=True)
    if host in {"localhost", "127.0.0.1"}:
        print(
            "Pour exposer aussi une URL Windows/WSL : "
            f"python3 scripts/dev_server.py --host 0.0.0.0 --port {port}",
            flush=True,
        )


def main() -> int:
    args = parse_args()
    try:
        host, port = server_options(args)
    except ValueError as error:
        print(f"Erreur de configuration : {error}", file=sys.stderr)
        return 1

    handler = http.server.SimpleHTTPRequestHandler

    try:
        with ReusableTCPServer((host, port), handler) as server:
            display_urls(host, port)
            server.serve_forever()
    except OSError as error:
        if error.errno == errno.EADDRINUSE:
            print(
                f"Erreur : le port {port} est déjà utilisé sur {host}.",
                file=sys.stderr,
            )
            print(
                f"Fermez le serveur existant ou lancez : "
                f"python3 scripts/dev_server.py --host {host} --port {port + 1}",
                file=sys.stderr,
            )
            return 1
        print(f"Erreur serveur local : {error}", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nServeur arrêté.")
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
