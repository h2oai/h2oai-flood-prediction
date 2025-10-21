import logging
import os
from pathlib import Path
from typing import Callable, Optional, Set, Any, Dict
from time import perf_counter
from abc import ABC, abstractmethod

import structlog
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    model_config = SettingsConfigDict(
        env_file=(
            # ".env.local",      # Local overrides (highest priority)
            # ".env.development", # Environment specific
            # ".env.production",
            # ".env.test",
            ".env",            # Default fallback
        ),
        env_prefix="APP_",
        extra="ignore",
        case_sensitive=False,
    )

    # Environment detection
    env: str = "development"  # development, production, test

    # =============================================================================
    # Core Settings
    # =============================================================================
    log_level: str = "INFO"
    debug: bool = False
    app_name: str = "Generic App"
    app_version: str = "1.0.0"
    app_data_dir: str = ".data"
    cache_dir: str = ".cache"
    web_dir: Optional[str] = '' # For web server files
    # =============================================================================
    # Server Settings
    # =============================================================================
    host: str = "0.0.0.0"
    port: int = 8000
    base_url: str = "/"
    max_workers: int = 10


    # =============================================================================
    # LLM Settings
    # =============================================================================
    h2ogpte_url: str = ""
    h2ogpte_api_key: Optional[str] = None
    h2ogpte_model: str = ""

    # =============================================================================
    # NVIDIA AI Settings
    # =============================================================================
    nvidia_api_key: Optional[str] = None
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_default_model: str = "nvidia/llama-3.3-nemotron-super-49b-v1.5"
    nvidia_embedding_model: str = "nvidia/nv-embedqa-e5-v5"
    nvidia_judge_model: str = "meta/llama-3.1-405b-instruct"

    # =============================================================================
    # Local NVIDIA NIM LLM Settings (Kubernetes Helm Deployment)
    # =============================================================================
    local_nim_api_key: Optional[str] = None  # Optional for local deployment
    local_nim_base_url: str = os.environ.get("NIM_LLM_BASE_URL", "")
    local_nim_default_model: str = os.environ.get("NIM_LLM_DEFAULT_MODEL", "nvidia/llama-3-3-nemotron-super-49b-v1-5")

    # =============================================================================
    # AI Provider Settings
    # =============================================================================
    ai_provider: str = "nvidia"  # "h2ogpte", "nvidia", "local_nim_llm", "hybrid"
    enable_nvidia_agents: bool = False
    enable_nvidia_rag: bool = False
    enable_nvidia_evaluator: bool = False

    # =============================================================================
    # Database Settings
    # =============================================================================
    database_url: Optional[str] = None  # For external databases
    sqlite_timeout: int = 30
    sqlite_pool_size: int = 20

    # =============================================================================
    # Redis Settings
    # =============================================================================
    redis_url: str = "redis://localhost:6379"
    redis_db: int = 0
    redis_password: Optional[str] = None
    redis_ssl: bool = False

    # =============================================================================
    # Authentication Settings (OIDC)
    # =============================================================================
    oidc_authority: str = ""  # Empty for local development
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_scope: str = "openid profile email"
    oidc_user_id_claim: str = "sub"
    oidc_username_claim: str = "preferred_username"
    oidc_email_claim: str = "email"

    # =============================================================================
    # Security Settings
    # =============================================================================
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30
    cors_origins: list = ["*"]
    allowed_hosts: list = ["*"]

    # =============================================================================
    # API Settings
    # =============================================================================
    api_rate_limit: str = "100/minute"
    api_timeout: int = 30
    api_max_retries: int = 3

    # =============================================================================
    # File Processing Settings
    # =============================================================================
    max_file_size: int = 100 * 1024 * 1024  # 100MB
    allowed_file_types: list = [".pdf", ".txt", ".docx", ".csv"]
    upload_chunk_size: int = 8192

    # =============================================================================
    # Background Job Settings
    # =============================================================================
    job_timeout: int = 3600  # 1 hour
    job_ttl: int = 604800    # 1 week
    job_failure_ttl: int = 86400  # 1 day

    # =============================================================================
    # Monitoring & Performance
    # =============================================================================
    enable_metrics: bool = False
    metrics_port: int = 9090
    enable_profiling: bool = False
    slow_query_threshold: float = 1.0  # seconds

    # =============================================================================
    # External Services (customize as needed)
    # =============================================================================
    external_api_url: Optional[str] = None
    external_api_key: Optional[str] = None
    external_api_timeout: int = 30

    # =============================================================================
    # AI Agents Configuration
    # =============================================================================
    agents_enabled: bool = True
    agents_auto_start: bool = True
    agents_check_interval: int = 300  # Default check interval in seconds
    agents_data_cache_ttl: int = 300  # Data cache TTL in seconds

    # Agent-specific settings
    data_collector_interval: int = 300  # 5 minutes
    risk_analyzer_interval: int = 600   # 10 minutes
    emergency_responder_interval: int = 180  # 3 minutes
    predictor_interval: int = 900       # 15 minutes

    # External API settings for agents
    usgs_api_enabled: bool = True
    noaa_api_enabled: bool = True
    openmeteo_api_enabled: bool = True

    # Alert and notification settings
    emergency_alerts_enabled: bool = True
    alert_channels: list = ["EAS", "Cell", "Social", "Radio"]
    max_alerts_per_hour: int = 10

    # =============================================================================
    # Flood Prediction Data Sources
    # =============================================================================
    usgs_api_timeout: int = 30
    usgs_data_refresh_interval: int = 3600  # 1 hour in seconds
    enable_real_time_data: bool = True
    data_source_priority: list = ["usgs", "noaa", "openmeteo"]  # Priority order for data sources

    # =============================================================================
    # Feature Flags
    # =============================================================================
    enable_caching: bool = True
    enable_async_processing: bool = True
    enable_webhooks: bool = False
    maintenance_mode: bool = False

    # Additional Feature Flags
    enable_auth: bool = True
    enable_file_upload: bool = True
    enable_background_jobs: bool = True
    enable_rate_limiting: bool = True
    enable_swagger: bool = True

    # Environment-specific properties
    @property
    def is_development(self) -> bool:
        return self.env.lower() == "development"

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"

    @property
    def is_test(self) -> bool:
        return self.env.lower() == "test"


# Global settings instance
settings = Settings()

# Directory structure
data_dir = Path(settings.app_data_dir)
cache_dir = Path(settings.cache_dir)

# Ensure base directories exist
data_dir.mkdir(parents=True, exist_ok=True)
cache_dir.mkdir(parents=True, exist_ok=True)

server_dir = (
    Path(settings.web_dir) if settings.web_dir else Path(__file__).parent / "www"
)
data_dir = Path(settings.app_data_dir)


def get_user_dir(user_id: str) -> Path:
    return data_dir / user_id


# =============================================================================
# Database Management
# =============================================================================

# Track initialized databases to avoid re-initialization
_known_cache_dbs: Set[str] = set()
_known_user_dbs: Set[str] = set()
_known_app_dbs: Set[str] = set()


def _init_db(path: Path, known: Set[str], init_func: Callable[[str], None]) -> str:
    """Initialize a database if not already initialized"""
    p = str(path)
    if p not in known:
        path.parent.mkdir(parents=True, exist_ok=True)
        init_func(p)
        known.add(p)
    return p


def get_cache_db(cache_name: str = "main") -> str:
    """Get path to cache database"""
    # Import here to avoid circular imports
    # Replace with your actual db module
    try:
        import db
        init_func = db.init_cache_db
    except ImportError:
        def init_func(path: str):
            pass  # Placeholder - replace with actual init function

    return _init_db(cache_dir / f"{cache_name}.db", _known_cache_dbs, init_func)


def get_user_db(user_id: str) -> str:
    """Get path to user-specific database"""
    try:
        import db
        init_func = db.init_app_db
    except ImportError:
        def init_func(path: str):
            pass

    return _init_db(get_user_dir(user_id) / "user.db", _known_user_dbs, init_func)


def get_app_db(db_name: str = "main") -> str:
    """Get path to application database"""
    try:
        import db
        init_func = db.init_app_db
    except ImportError:
        def init_func(path: str):
            pass

    return _init_db(data_dir / f"{db_name}.db", _known_app_dbs, init_func)


# =============================================================================
# Directory Management
# =============================================================================

def get_user_dir(user_id: str) -> Path:
    """Get user-specific directory"""
    return data_dir / "users" / user_id


def get_user_cache_dir(user_id: str) -> Path:
    """Get user-specific cache directory"""
    return cache_dir / "users" / user_id


def get_user_upload_dir(user_id: str) -> Path:
    """Get user-specific upload directory"""
    return get_user_dir(user_id) / "uploads"


def get_user_temp_dir(user_id: str) -> Path:
    """Get user-specific temporary directory"""
    return get_user_dir(user_id) / "temp"


def ensure_user_directories(user_id: str):
    """Ensure all user directories exist"""
    directories = [
        get_user_dir(user_id),
        get_user_cache_dir(user_id),
        get_user_upload_dir(user_id),
        get_user_temp_dir(user_id),
    ]
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)


# =============================================================================
# Logging Configuration
# =============================================================================

def configure_logging():
    """Configure structured logging"""
    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper())
        ),
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="ISO"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer() if not settings.debug
            else structlog.dev.ConsoleRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


# Configure logging
configure_logging()
log = structlog.stdlib.get_logger()


# =============================================================================
# Utility Classes
# =============================================================================

class Timer:
    """Context manager for timing operations"""

    def __enter__(self):
        self._start = perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        dt = perf_counter() - self._start
        self.time = f"{dt:.2f}s"
        self.seconds = dt


class BaseContext(ABC):
    """Abstract base class for operation contexts"""

    @property
    @abstractmethod
    def status(self) -> Optional[str]:
        """Get current status"""
        pass

    @status.setter
    @abstractmethod
    def status(self, message: str):
        """Set current status"""
        pass

    @property
    @abstractmethod
    def aborted(self) -> bool:
        """Check if operation is aborted"""
        pass

    @abstractmethod
    def abort(self):
        """Abort the operation"""
        pass

    @abstractmethod
    def checkpoint(self):
        """Check if operation should continue"""
        pass

    @abstractmethod
    def delete(self):
        """Clean up context"""
        pass


class ConsoleContext(BaseContext):
    """Console-based context for local operations"""

    def __init__(self):
        self._status: Optional[str] = None
        self._aborted: bool = False
        self._log = log

    @property
    def status(self) -> Optional[str]:
        return self._status

    @status.setter
    def status(self, message: str):
        self._log.info("Operation status", status=message)
        self._status = message

    @property
    def aborted(self) -> bool:
        return self._aborted

    def abort(self):
        self._aborted = True
        self._log.warning("Operation aborted")

    def checkpoint(self):
        if self.aborted:
            raise Exception("Operation was aborted")

    def delete(self):
        pass


class OperationAborted(Exception):
    """Exception raised when an operation is aborted"""
    pass


# =============================================================================
# Configuration Validation
# =============================================================================

def validate_settings():
    """Validate critical settings"""
    errors = []

    # Production-specific validations
    if settings.env == "production":
        if settings.secret_key in ["change-me-in-production", "dev-secret-key-not-for-production"]:
            errors.append("SECRET_KEY must be changed in production")

        if settings.debug:
            errors.append("DEBUG must be False in production")

        if settings.cors_origins == ["*"]:
            errors.append("CORS_ORIGINS should not be wildcard (*) in production")

    # General validations
    if settings.oidc_authority and not settings.oidc_client_id:
        errors.append("OIDC_CLIENT_ID is required when OIDC_AUTHORITY is set")

    if not settings.redis_url:
        errors.append("REDIS_URL is required")

    # Port validation
    if not (1 <= settings.port <= 65535):
        errors.append(f"PORT must be between 1 and 65535, got {settings.port}")

    if errors:
        for error in errors:
            log.error("Configuration error", error=error)
        raise ValueError(f"Configuration errors: {', '.join(errors)}")


def print_settings(sensitive_keys: Optional[Set[str]] = None):
    """Print all settings (excluding sensitive ones)"""
    if sensitive_keys is None:
        sensitive_keys = {
            "secret_key", "oidc_client_secret", "redis_password",
            "external_api_key", "database_url"
        }

    log.info("Application settings:")
    for key, value in settings.model_dump().items():
        if key.lower() in sensitive_keys:
            value = "***HIDDEN***" if value else None
        log.info("Setting", key=key, value=value)


def get_config_dict() -> Dict[str, Any]:
    """Get configuration as dictionary for API responses"""
    return {
        "app_name": settings.app_name,
        "app_version": settings.app_version,
        "debug": settings.debug,
        "oidc_authority": settings.oidc_authority,
        "oidc_client_id": settings.oidc_client_id,
        "oidc_scope": settings.oidc_scope,
        "base_url": settings.base_url,
        "max_file_size": settings.max_file_size,
        "allowed_file_types": settings.allowed_file_types,
    }


# =============================================================================
# Initialization
# =============================================================================

def initialize_app():
    """Initialize application with settings validation"""
    log.info("Initializing application",
             app_name=settings.app_name,
             version=settings.app_version)

    # Validate settings
    validate_settings()

    # Print settings if in debug mode
    if settings.debug:
        print_settings()

    # Initialize directories
    data_dir.mkdir(parents=True, exist_ok=True)
    cache_dir.mkdir(parents=True, exist_ok=True)

    log.info("Application initialized successfully")


# Auto-initialize when module is imported
if __name__ != "__main__":
    try:
        initialize_app()
    except Exception as e:
        log.error("Failed to initialize application", error=str(e))
        raise


# =============================================================================
# Main execution for testing
# =============================================================================

if __name__ == "__main__":
    print("Settings Template")
    print("=" * 50)

    initialize_app()

    # Example usage
    print(f"\nData directory: {data_dir}")
    print(f"Cache directory: {cache_dir}")
    print(f"User directory for 'user123': {get_user_dir('user123')}")

    # Timer example
    with Timer() as timer:
        import time
        time.sleep(0.1)
    print(f"\nTimer test: {timer.time}")

    # Context example
    context = ConsoleContext()
    context.status = "Testing context"
    print(f"Context status: {context.status}")