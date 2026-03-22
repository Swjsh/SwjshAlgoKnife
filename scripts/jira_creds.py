#!/usr/bin/env python3
"""
Jira Credential Manager for SwjshAlgoKnife
Encrypts and stores Jira API credentials securely.

Usage:
    python scripts/jira_creds.py generate-key   # One-time: create keyfile
    python scripts/jira_creds.py encrypt        # Encrypt your API token
    python scripts/jira_creds.py decrypt        # Test decryption
    python scripts/jira_creds.py status         # Check credential files exist
    python scripts/jira_creds.py show           # Output raw token (for piping)
"""

import base64
import getpass
import json
import os
import sys
from pathlib import Path

# Use cryptography library for AES encryption
try:
    from cryptography.fernet import Fernet
except ImportError:
    print("ERROR: 'cryptography' package required. Run: pip install cryptography")
    sys.exit(1)

# Credential storage location
SWJSH_DIR = Path.home() / ".swjsh"
KEY_FILE = SWJSH_DIR / "jira.key"
ENC_FILE = SWJSH_DIR / "jira.enc"
CONFIG_FILE = SWJSH_DIR / "jira_config.json"


def ensure_dir():
    """Create .swjsh directory if it doesn't exist."""
    SWJSH_DIR.mkdir(parents=True, exist_ok=True)


def generate_key():
    """Generate a new Fernet key and save it."""
    ensure_dir()
    if KEY_FILE.exists():
        confirm = input(f"Key file exists at {KEY_FILE}. Overwrite? (y/N): ")
        if confirm.lower() != 'y':
            print("Aborted.")
            return False

    key = Fernet.generate_key()
    KEY_FILE.write_bytes(key)
    print(f"Key generated: {KEY_FILE}")
    print("IMPORTANT: Back up this key file! Without it, encrypted tokens are useless.")
    return True


def load_key():
    """Load the Fernet key from disk."""
    if not KEY_FILE.exists():
        print(f"ERROR: Key file not found at {KEY_FILE}")
        print("Run: python scripts/jira_creds.py generate-key")
        return None
    return KEY_FILE.read_bytes()


def encrypt_credentials():
    """Encrypt Jira API token and save config."""
    key = load_key()
    if not key:
        return False

    fernet = Fernet(key)

    print("\n=== Jira Credential Encryption ===\n")

    # Get API token (hidden input)
    token = getpass.getpass("Jira API Token: ")
    if not token.strip():
        print("ERROR: Token cannot be empty.")
        return False

    # Get email
    email = input("Jira Email (e.g., jack.watergun@gmail.com): ").strip()
    if not email:
        print("ERROR: Email cannot be empty.")
        return False

    # Get base URL (with default)
    default_url = "https://swjshalgoknife.atlassian.net"
    base_url = input(f"Jira Base URL [{default_url}]: ").strip()
    if not base_url:
        base_url = default_url

    # Encrypt the token
    encrypted_token = fernet.encrypt(token.encode())

    ensure_dir()

    # Save encrypted token
    ENC_FILE.write_bytes(encrypted_token)
    print(f"Encrypted token saved: {ENC_FILE}")

    # Save config (email + base_url - not sensitive)
    config = {
        "email": email,
        "base_url": base_url
    }
    CONFIG_FILE.write_text(json.dumps(config, indent=2))
    print(f"Config saved: {CONFIG_FILE}")

    print("\nCredentials encrypted successfully!")
    print("Test with: python scripts/jira_creds.py decrypt")
    return True


def decrypt_token():
    """Decrypt and return the API token."""
    key = load_key()
    if not key:
        return None

    if not ENC_FILE.exists():
        print(f"ERROR: Encrypted token not found at {ENC_FILE}")
        print("Run: python scripts/jira_creds.py encrypt")
        return None

    fernet = Fernet(key)
    encrypted_token = ENC_FILE.read_bytes()

    try:
        token = fernet.decrypt(encrypted_token).decode()
        return token
    except Exception as e:
        print(f"ERROR: Decryption failed: {e}")
        return None


def load_config():
    """Load email and base_url from config file."""
    if not CONFIG_FILE.exists():
        print(f"ERROR: Config file not found at {CONFIG_FILE}")
        return None

    try:
        return json.loads(CONFIG_FILE.read_text())
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid config file: {e}")
        return None


def get_credentials():
    """
    Main entry point for jira_client.py.
    Returns (email, token, base_url) or None on error.
    """
    token = decrypt_token()
    if not token:
        return None

    config = load_config()
    if not config:
        return None

    return (config["email"], token, config["base_url"])


def cmd_status():
    """Show credential file status."""
    print("\n=== Jira Credential Status ===\n")

    files = [
        (KEY_FILE, "Encryption key"),
        (ENC_FILE, "Encrypted token"),
        (CONFIG_FILE, "Config (email/url)")
    ]

    all_ok = True
    for path, desc in files:
        exists = path.exists()
        status = "OK" if exists else "MISSING"
        print(f"  [{status}] {desc}: {path}")
        if not exists:
            all_ok = False

    if all_ok:
        print("\nAll credential files present.")
        # Test decryption
        creds = get_credentials()
        if creds:
            email, _, base_url = creds
            print(f"  Email: {email}")
            print(f"  URL: {base_url}")
            print("  Token: ******* (encrypted)")
    else:
        print("\nRun these commands to set up:")
        if not KEY_FILE.exists():
            print("  python scripts/jira_creds.py generate-key")
        if not ENC_FILE.exists() or not CONFIG_FILE.exists():
            print("  python scripts/jira_creds.py encrypt")


def cmd_decrypt():
    """Test decryption and show masked token."""
    token = decrypt_token()
    if token:
        masked = token[:4] + "*" * (len(token) - 8) + token[-4:]
        print(f"Decryption successful!")
        print(f"Token: {masked}")
        return True
    return False


def cmd_show():
    """Output raw token (for piping to other scripts)."""
    token = decrypt_token()
    if token:
        print(token, end='')
        return True
    return False


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        cmd_status()
        return

    command = sys.argv[1].lower().replace('-', '_')

    if command == "generate_key":
        generate_key()
    elif command == "encrypt":
        encrypt_credentials()
    elif command == "decrypt":
        cmd_decrypt()
    elif command == "status":
        cmd_status()
    elif command == "show":
        cmd_show()
    else:
        print(f"Unknown command: {sys.argv[1]}")
        print(__doc__)


if __name__ == "__main__":
    main()
