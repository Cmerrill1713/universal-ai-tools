"""
Network Exfiltration Guardrail for Local-Only AI Agents
Blocks outbound network access unless explicitly allowed
"""
import os
import socket as _socket
from typing import Any

# Check if network access is allowed
ALLOW_NET = os.getenv("ALLOW_NET", "0") == "1"


class NetworkBlockedError(RuntimeError):
    """Raised when attempting network access in local-only mode"""
    pass


class LocalOnlySocket(_socket.socket):
    """
    Socket wrapper that blocks outbound connections in local-only mode
    Allows only localhost connections for inter-service communication
    """
    
    def connect(self, address):
        if not ALLOW_NET:
            # Allow localhost connections
            host = address[0] if isinstance(address, tuple) else address
            if host in ("127.0.0.1", "localhost", "::1"):
                return super().connect(address)
            
            # Block all other outbound connections
            raise NetworkBlockedError(
                f"Outbound network access blocked in local-only mode. "
                f"Attempted connection to: {address}. "
                f"Set ALLOW_NET=1 to enable (not recommended for agents)."
            )
        return super().connect(address)
    
    def connect_ex(self, address):
        if not ALLOW_NET:
            host = address[0] if isinstance(address, tuple) else address
            if host not in ("127.0.0.1", "localhost", "::1"):
                raise NetworkBlockedError(
                    f"Outbound network access blocked. Target: {address}"
                )
        return super().connect_ex(address)


def enable_network_guardrail():
    """
    Install network guardrail globally
    Call this at application startup to enforce local-only mode
    """
    if not ALLOW_NET:
        # Monkeypatch socket to block outbound connections
        _socket.socket = LocalOnlySocket
        print("🔒 Network guardrail enabled - local-only mode active")
    else:
        print("⚠️  Network guardrail disabled - outbound access allowed")


def is_network_allowed() -> bool:
    """Check if network access is currently allowed"""
    return ALLOW_NET


def allow_network_temporarily():
    """
    Context manager to temporarily allow network access
    
    Usage:
        with allow_network_temporarily():
            # Network-requiring operation
            download_model()
    """
    global ALLOW_NET
    
    class _AllowNetContext:
        def __enter__(self):
            global ALLOW_NET
            self.old_value = ALLOW_NET
            ALLOW_NET = True
            print("🌐 Network temporarily allowed")
            return self
        
        def __exit__(self, *args):
            global ALLOW_NET
            ALLOW_NET = self.old_value
            print("🔒 Network access revoked")
    
    return _AllowNetContext()


# Example usage in agent bootstrap
if __name__ == "__main__":
    print("Testing network guardrail...")
    
    # Enable guardrail
    enable_network_guardrail()
    
    # Test localhost (should work)
    try:
        test_sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
        test_sock.connect(("127.0.0.1", 8014))
        print("✅ Localhost connection allowed")
        test_sock.close()
    except Exception as e:
        print(f"❌ Localhost test failed: {e}")
    
    # Test external (should block)
    try:
        test_sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
        test_sock.connect(("8.8.8.8", 80))
        print("❌ External connection NOT blocked (security issue!)")
        test_sock.close()
    except NetworkBlockedError as e:
        print(f"✅ External connection blocked: {e}")
    except Exception as e:
        print(f"⚠️  Test inconclusive: {e}")

