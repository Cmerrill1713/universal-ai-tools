"""
Database utilities and health checks
Addresses: db-auth-fix issue
"""

import os
import logging
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class DatabaseHealthChecker:
    """Database health checker with graceful error handling"""
    
    def __init__(self, connection_string: Optional[str] = None):
        self.connection_string = connection_string or os.getenv('DATABASE_URL')
        self._connection = None
    
    async def check_connection(self) -> Dict[str, Any]:
        """
        Check database connection health
        Returns health status with detailed information
        """
        try:
            if not self.connection_string:
                return {
                    "status": "error",
                    "message": "Database URL not configured",
                    "details": "DATABASE_URL environment variable is not set"
                }
            
            # Try to import psycopg (async version)
            try:
                import psycopg
            except ImportError:
                return {
                    "status": "error",
                    "message": "Database driver not available",
                    "details": "psycopg package is not installed"
                }
            
            # Test connection
            async with psycopg.AsyncConnection.connect(self.connection_string) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("SELECT 1")
                    result = await cur.fetchone()
                    
                    if result and result[0] == 1:
                        return {
                            "status": "healthy",
                            "message": "Database connection successful",
                            "details": "Connection test passed"
                        }
                    else:
                        return {
                            "status": "error",
                            "message": "Database query failed",
                            "details": "Unexpected query result"
                        }
                        
        except Exception as e:
            error_type = type(e).__name__
            error_message = str(e)
            
            # Categorize errors for better handling
            if "password authentication failed" in error_message.lower():
                return {
                    "status": "error",
                    "message": "Database authentication failed",
                    "details": "Invalid credentials or user permissions",
                    "error_type": error_type,
                    "suggestion": "Check DATABASE_URL credentials and user permissions"
                }
            elif "connection refused" in error_message.lower():
                return {
                    "status": "error",
                    "message": "Database connection refused",
                    "details": "Database server is not running or not accessible",
                    "error_type": error_type,
                    "suggestion": "Check if database server is running and accessible"
                }
            elif "timeout" in error_message.lower():
                return {
                    "status": "error",
                    "message": "Database connection timeout",
                    "details": "Connection attempt timed out",
                    "error_type": error_type,
                    "suggestion": "Check network connectivity and database server load"
                }
            else:
                return {
                    "status": "error",
                    "message": f"Database error: {error_type}",
                    "details": error_message,
                    "error_type": error_type,
                    "suggestion": "Check database configuration and server status"
                }
    
    async def get_database_info(self) -> Dict[str, Any]:
        """
        Get database information and statistics
        """
        try:
            import psycopg
            
            async with psycopg.AsyncConnection.connect(self.connection_string) as conn:
                async with conn.cursor() as cur:
                    # Get database version
                    await cur.execute("SELECT version()")
                    version = await cur.fetchone()
                    
                    # Get database size
                    await cur.execute("""
                        SELECT pg_size_pretty(pg_database_size(current_database()))
                    """)
                    size = await cur.fetchone()
                    
                    # Get active connections
                    await cur.execute("""
                        SELECT count(*) FROM pg_stat_activity 
                        WHERE state = 'active'
                    """)
                    active_connections = await cur.fetchone()
                    
                    return {
                        "version": version[0] if version else "Unknown",
                        "size": size[0] if size else "Unknown",
                        "active_connections": active_connections[0] if active_connections else 0,
                        "status": "healthy"
                    }
                    
        except Exception as e:
            return {
                "status": "error",
                "message": f"Failed to get database info: {str(e)}",
                "error_type": type(e).__name__
            }


@asynccontextmanager
async def get_database_connection():
    """
    Context manager for database connections with proper error handling
    """
    connection = None
    try:
        import psycopg
        
        connection_string = os.getenv('DATABASE_URL')
        if not connection_string:
            raise ValueError("DATABASE_URL environment variable is not set")
        
        connection = await psycopg.AsyncConnection.connect(connection_string)
        yield connection
        
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        raise
    finally:
        if connection:
            await connection.close()


async def test_database_operations() -> Dict[str, Any]:
    """
    Test basic database operations
    """
    try:
        async with get_database_connection() as conn:
            async with conn.cursor() as cur:
                # Test basic query
                await cur.execute("SELECT 1 as test")
                result = await cur.fetchone()
                
                # Test table existence (common tables)
                await cur.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    LIMIT 5
                """)
                tables = await cur.fetchall()
                
                return {
                    "status": "healthy",
                    "message": "Database operations successful",
                    "test_query_result": result[0] if result else None,
                    "available_tables": [table[0] for table in tables] if tables else []
                }
                
    except Exception as e:
        return {
            "status": "error",
            "message": f"Database operations failed: {str(e)}",
            "error_type": type(e).__name__
        }