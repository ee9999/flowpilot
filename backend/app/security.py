import hashlib
import hmac
import secrets


def hash_password(password):
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**15, r=8, p=1, maxmem=64*1024**2)
    return f"{salt.hex()}:{key.hex()}"


def verify_password(password, encoded):
    salt, expected = encoded.split(":")
    key = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**15, r=8, p=1, maxmem=64*1024**2)
    return hmac.compare_digest(key.hex(), expected)


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()
