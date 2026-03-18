#!/usr/bin/env python3
"""
SwjshAK Server Credential Manager
==================================
Encrypts and stores server credentials locally using Fernet (AES-128-CBC).
The encryption key is derived from a master password YOU remember — nothing stored in plain text.

Usage:
  python server_creds.py store          # Store new credentials (prompts for master password + server password)
  python server_creds.py retrieve       # Retrieve stored credentials (prompts for master password)
  python server_creds.py ssh            # Print the SSH command ready to copy/paste
  python server_creds.py gen-ssh-key    # Generate an SSH keypair for passwordless login (recommended)

The encrypted vault is saved to: ~/.swjsh/vault.enc
"""

import os
import sys
import json
import base64
import getpass
import hashlib
import subprocess
from pathlib import Path

try:
    from cryptography.fernet import Fernet, InvalidToken
except ImportError:
    print("Installing cryptography package...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography", "--quiet"])
    from cryptography.fernet import Fernet, InvalidToken

VAULT_DIR = Path.home() / ".swjsh"
VAULT_FILE = VAULT_DIR / "vault.enc"
SSH_KEY_PATH = Path.home() / ".ssh" / "swjsh_server"


def derive_key(master_password: str) -> bytes:
    """Derive a Fernet key from the master password using PBKDF2."""
    # Use a fixed salt tied to the app (not secret, just uniqueness)
    salt = b"SwjshAK-VaultSalt-2026"
    # 600,000 iterations per OWASP 2024 recommendation for PBKDF2-SHA256
    key_bytes = hashlib.pbkdf2_hmac("sha256", master_password.encode(), salt, 600_000)
    return base64.urlsafe_b64encode(key_bytes)


def store_credentials():
    """Prompt for credentials and encrypt them to disk."""
    print("\n=== SwjshAK Credential Vault ===\n")

    master_pw = getpass.getpass("Create a master password (you'll need this to decrypt): ")
    master_pw2 = getpass.getpass("Confirm master password: ")

    if master_pw != master_pw2:
        print("Passwords don't match. Aborting.")
        sys.exit(1)

    print()
    server_ip = input("Server IP address: ").strip()
    server_user = input("Server SSH user [root]: ").strip() or "root"
    server_port = input("Server SSH port [22]: ").strip() or "22"
    server_pw = getpass.getpass("Server password: ")

    creds = {
        "server_ip": server_ip,
        "server_user": server_user,
        "server_port": server_port,
        "server_password": server_pw,
    }

    # Encrypt
    key = derive_key(master_pw)
    f = Fernet(key)
    encrypted = f.encrypt(json.dumps(creds).encode())

    # Save
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    VAULT_FILE.write_bytes(encrypted)
    print(f"\nCredentials encrypted and saved to: {VAULT_FILE}")
    print("You'll need your master password to retrieve them.\n")


def retrieve_credentials() -> dict:
    """Decrypt and return stored credentials."""
    if not VAULT_FILE.exists():
        print("No vault found. Run: python server_creds.py store")
        sys.exit(1)

    master_pw = getpass.getpass("Master password: ")
    key = derive_key(master_pw)
    f = Fernet(key)

    try:
        decrypted = f.decrypt(VAULT_FILE.read_bytes())
        creds = json.loads(decrypted.decode())
        return creds
    except InvalidToken:
        print("Wrong master password.")
        sys.exit(1)


def show_credentials():
    """Display decrypted credentials."""
    creds = retrieve_credentials()
    print(f"\n  Server IP:   {creds['server_ip']}")
    print(f"  User:        {creds['server_user']}")
    print(f"  Port:        {creds['server_port']}")
    print(f"  Password:    {'*' * len(creds['server_password'])} (hidden)")
    print(f"\n  SSH command: ssh -p {creds['server_port']} {creds['server_user']}@{creds['server_ip']}\n")


def print_ssh_command():
    """Print just the SSH command."""
    creds = retrieve_credentials()
    cmd = f"ssh -p {creds['server_port']} {creds['server_user']}@{creds['server_ip']}"
    print(f"\n  {cmd}\n")
    print("  (Password will be prompted by SSH — or use gen-ssh-key for passwordless login)\n")


def generate_ssh_key():
    """Generate an SSH keypair and show how to install it on the server."""
    if SSH_KEY_PATH.exists():
        print(f"\nSSH key already exists at: {SSH_KEY_PATH}")
        overwrite = input("Overwrite? [y/N]: ").strip().lower()
        if overwrite != "y":
            print("Keeping existing key.")
        else:
            _create_key()
    else:
        _create_key()

    # Show install instructions
    print("\n=== To enable passwordless SSH login ===\n")
    print("Run this command to copy your key to the server:\n")

    if VAULT_FILE.exists():
        try:
            creds = retrieve_credentials()
            print(f'  ssh-copy-id -i {SSH_KEY_PATH}.pub -p {creds["server_port"]} {creds["server_user"]}@{creds["server_ip"]}')
        except SystemExit:
            print(f"  ssh-copy-id -i {SSH_KEY_PATH}.pub root@YOUR_SERVER_IP")
    else:
        print(f"  ssh-copy-id -i {SSH_KEY_PATH}.pub root@YOUR_SERVER_IP")

    print("\nAfter that, you can SSH without a password:\n")
    print(f"  ssh -i {SSH_KEY_PATH} root@YOUR_SERVER_IP\n")


def _create_key():
    """Actually generate the keypair."""
    SSH_KEY_PATH.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ssh-keygen",
        "-t", "ed25519",
        "-f", str(SSH_KEY_PATH),
        "-C", "swjsh-server-key",
        "-N", "",  # No passphrase on the key (vault protects the server password)
    ], check=True)
    print(f"\nKey generated: {SSH_KEY_PATH}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    cmd = sys.argv[1].lower()

    if cmd == "store":
        store_credentials()
    elif cmd == "retrieve":
        show_credentials()
    elif cmd == "ssh":
        print_ssh_command()
    elif cmd == "gen-ssh-key":
        generate_ssh_key()
    else:
        print(f"Unknown command: {cmd}")
        print("Commands: store, retrieve, ssh, gen-ssh-key")
        sys.exit(1)


if __name__ == "__main__":
    main()
