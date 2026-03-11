"""AES-256-GCM encryption for sensitive data (API keys, secrets).

Uses a 256-bit master key from the ENCRYPTION_KEY environment variable.
Each encryption produces a unique 96-bit nonce, so identical plaintexts
yield different ciphertexts. The nonce is prepended to the ciphertext
for storage and extracted automatically on decryption.
"""

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

_NONCE_BYTES = 12  # 96-bit nonce recommended for AES-GCM


def _get_aesgcm() -> AESGCM:
    """Build an AESGCM cipher from the configured encryption key."""
    raw_key = settings.encryption_key
    if not raw_key:
        raise RuntimeError(
            "ENCRYPTION_KEY is not configured. "
            "Generate one with: python -c \"from cryptography.hazmat.primitives.ciphers.aead import AESGCM; "
            "import base64; print(base64.urlsafe_b64encode(AESGCM.generate_key(bit_length=256)).decode())\""
        )
    key_bytes = base64.urlsafe_b64decode(raw_key)
    if len(key_bytes) != 32:
        raise RuntimeError(
            f"ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits), got {len(key_bytes)}"
        )
    return AESGCM(key_bytes)


def encrypt(plaintext: str) -> str:
    """Encrypt a string and return a base64-encoded ciphertext.

    Format: base64(nonce || ciphertext || tag)
    The nonce is generated fresh for each call.
    """
    aesgcm = _get_aesgcm()
    nonce = os.urandom(_NONCE_BYTES)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt(token: str) -> str:
    """Decrypt a base64-encoded ciphertext produced by encrypt().

    Extracts the nonce from the first 12 bytes, then decrypts the rest.
    Raises ValueError if the token is tampered with or the key is wrong.
    """
    aesgcm = _get_aesgcm()
    raw = base64.urlsafe_b64decode(token)
    if len(raw) < _NONCE_BYTES + 1:
        raise ValueError("Encrypted token is too short")
    nonce = raw[:_NONCE_BYTES]
    ciphertext = raw[_NONCE_BYTES:]
    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext_bytes.decode("utf-8")


def mask_key(key: str) -> str:
    """Return a masked version of an API key for display.

    Shows the first 3 and last 4 characters: 'sk-...xK2a'
    """
    if len(key) <= 8:
        return "****"
    return f"{key[:3]}...{key[-4:]}"
