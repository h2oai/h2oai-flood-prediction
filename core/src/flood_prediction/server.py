import json
import os
import uuid
import jwt
import requests
import time
import asyncio
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Annotated, Dict, Any, List

import rq
from fastapi.responses import FileResponse, StreamingResponse
from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    Request,
    Response
)
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from redis import Redis
from rq.exceptions import InvalidJobOperationError
from pydantic import BaseModel
from .settings import settings, server_dir, log
from .settings import configure_logging, initialize_app
from . import db
from .api import llm_call_stream, get_available_llm_models, get_provider_info, get_all_providers_info
from .evaluator import evaluator, EvaluationResult
from .data_sources import fetch_and_update_usgs_data, fetch_and_store_noaa_alerts
from .agents import AgentManager
from .agents.nat_base import FloodPredictionRunner

configure_logging()
initialize_app()
# Set environment variable to fix fork() issues on macOS
os.environ.setdefault('OBJC_DISABLE_INITIALIZE_FORK_SAFETY', 'YES')

# Redis and job queue setup
_redis = Redis.from_url(settings.redis_url)
_job_queue = rq.Queue(connection=_redis, default_timeout=settings.job_timeout)

# Database setup
_db_path = Path(settings.app_data_dir) / "flood_prediction.db"
db.init_app_db(str(_db_path))

# Initialize Agent Manager
_agent_manager = None
if settings.agents_enabled:
    _agent_manager = AgentManager(str(_db_path))
    log.info("AgentManager initialized")

# Initialize NAT Agent Runner
_nat_runner = None
try:
    _nat_runner = FloodPredictionRunner()
    log.info("NAT FloodPredictionRunner initialized")
except Exception as e:
    log.warning(f"NAT FloodPredictionRunner not available: {e}")

# Lifespan context manager for startup/shutdown events
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events"""
    # Startup
    log.info("Application starting up...")
    
    # Start AI agents if enabled and auto-start is configured
    if _agent_manager and settings.agents_auto_start:
        try:
            log.info("Auto-starting AI agents...")
            await _agent_manager.start_all_agents()
            log.info("All AI agents started successfully")
        except Exception as e:
            log.error(f"Failed to auto-start AI agents: {str(e)}")
    
    # Generate initial insights if agent manager is available
    if _agent_manager:
        try:
            log.info("Generating initial agent insights...")
            await _agent_manager._generate_initial_insights()
            log.info("Initial agent insights generated successfully")
        except Exception as e:
            log.error(f"Failed to generate initial agent insights: {str(e)}")
    
    yield
    
    # Shutdown
    log.info("Application shutting down...")
    
    # Stop AI agents if running
    if _agent_manager:
        try:
            log.info("Stopping AI agents...")
            await _agent_manager.stop_all_agents()
            log.info("All AI agents stopped successfully")
        except Exception as e:
            log.error(f"Failed to stop AI agents: {str(e)}")

app = FastAPI(title="Generic API Server", version="1.0.0", lifespan=lifespan)
security = HTTPBearer()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request timing and logging middleware
# @app.middleware("http")
# async def logging_middleware(request: Request, call_next):
#     start_time = time.time()
    
#     # Log request start
#     log.info("Request started", extra={
#         "method": request.method,
#         "url": str(request.url),
#         "client_ip": request.client.host if request.client else "unknown",
#         "user_agent": request.headers.get("user-agent", ""),
#         "request_id": str(uuid.uuid4())[:8],
#     })
    
#     # Process request
#     try:
#         response = await call_next(request)
        
#         # Calculate duration
#         process_time = time.time() - start_time
#         duration_ms = round(process_time * 1000, 2)
        
#         # Log request completion
#         log.info("Request completed", extra={
#             "method": request.method,
#             "url": str(request.url),
#             "status_code": response.status_code,
#             "duration_ms": duration_ms,
#             "client_ip": request.client.host if request.client else "unknown",
#         })
        
#         # Add timing header
#         response.headers["X-Process-Time"] = str(process_time)
        
#         return response
        
#     except Exception as e:
#         # Calculate duration for failed requests
#         process_time = time.time() - start_time
#         duration_ms = round(process_time * 1000, 2)
        
#         # Log request error
#         log.error("Request failed", extra={
#             "method": request.method,
#             "url": str(request.url),
#             "duration_ms": duration_ms,
#             "error": str(e),
#             "client_ip": request.client.host if request.client else "unknown",
#         })
        
#         raise e

# Cache for JWKS (JSON Web Key Set)
_jwks_cache: Dict = {}


# =============================================================================
# Authentication
# =============================================================================

async def get_jwks():
    """Fetch JSON Web Key Set from the OIDC provider"""
    if not _jwks_cache.get("keys"):
        jwks_uri = f"{settings.oidc_authority}/.well-known/openid-configuration"
        try:
            openid_config = requests.get(jwks_uri).json()
            jwks_url = openid_config.get("jwks_uri")
            if jwks_url:
                jwks = requests.get(jwks_url).json()
                _jwks_cache["keys"] = jwks.get("keys", [])
        except Exception as e:
            print(f"Error fetching JWKS: {e}")
    return _jwks_cache.get("keys", [])


def get_token_endpoint(auth_url: str) -> str:
    """Get token endpoint from OIDC discovery"""
    try:
        discovery_url = f"{auth_url}/.well-known/openid-configuration"
        response = requests.get(discovery_url)
        return response.json().get("token_endpoint")
    except Exception:
        return f"{auth_url}/oauth/token"


async def refresh_access_token(user_id: str) -> Optional[str]:
    """Attempt to refresh the access token using the stored refresh token"""
    refresh_token = _redis.get(f"refresh_token:{user_id}")
    if not refresh_token:
        print(f"No refresh token found for user {user_id}")
        return None

    try:
        refresh_token = refresh_token.decode('utf-8')
        token_endpoint = get_token_endpoint(settings.oidc_authority)

        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.oidc_client_id,
        }

        if settings.oidc_client_secret:
            data["client_secret"] = settings.oidc_client_secret

        response = requests.post(token_endpoint, headers=headers, data=data)
        if response.status_code == 200:
            token_data = response.json()
            if "access_token" in token_data:
                # Store the new access token
                expires_in = token_data.get("expires_in", 300)
                access_token = token_data["access_token"]
                _redis.setex(f"access_token:{user_id}", expires_in, access_token)

                # Update refresh token if provided
                if "refresh_token" in token_data:
                    _redis.setex(f"refresh_token:{user_id}", 86400, token_data["refresh_token"])

                print(f"Successfully refreshed access token for user {user_id}")
                return access_token

        print(f"Failed to refresh token: {response.status_code}, {response.text}")
        return None
    except Exception as e:
        print(f"Error refreshing token: {str(e)}")
        return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Validate JWT token and extract user information with auto-refresh"""
    token = credentials.credentials

    if settings.oidc_authority == "":  # local development mode
        if token == "local-token":
            return "local-user"
        raise HTTPException(status_code=401, detail="Invalid local token")

    try:
        # Simple decode without verification (for development)
        # In production, you should properly verify the token signature
        decoded = jwt.decode(token, options={"verify_signature": False})

        # Extract user identifier
        user_id = decoded.get(settings.oidc_user_id_claim)
        if not user_id:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid token: missing {settings.oidc_user_id_claim} claim"
            )

        # Store the token temporarily
        _redis.setex(f"access_token:{user_id}", 300, token)
        return user_id

    except jwt.ExpiredSignatureError:
        try:
            decoded = jwt.decode(token, options={"verify_signature": False, "verify_exp": False})
            user_id = decoded.get(settings.oidc_user_id_claim)

            if user_id:
                print(f"Token expired for user {user_id}, attempting refresh")
                new_token = await refresh_access_token(user_id)
                if new_token:
                    return user_id
        except Exception as e:
            print(f"Error handling expired token: {str(e)}")

        raise HTTPException(status_code=401, detail="Token has expired and refresh failed")

    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


# Define the dependency for getting authenticated user ID
UserID = Annotated[str, Depends(get_current_user)]


# =============================================================================
# Utility Functions
# =============================================================================

def _api(url: str) -> str:
    """Helper to construct API URLs"""
    return f"{settings.base_url}api/{url}"


def _format_utc(dt: datetime) -> str:
    """Format datetime as UTC string"""
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")


def uid() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())


def get_user_access_token(user_id: str) -> Optional[bytes]:
    """Get stored access token for user"""
    return _redis.get(f"access_token:{user_id}")


def get_user_refresh_token(user_id: str) -> Optional[bytes]:
    """Get stored refresh token for user"""
    return _redis.get(f"refresh_token:{user_id}")


# =============================================================================
# Background Job Processing
# =============================================================================

class JobContext:
    """Context manager for background jobs"""
    def __init__(self, job: Optional[rq.job.Job] = None):
        self.job = job or rq.get_current_job()
        self._last_checkpoint_time = datetime.now()

    @property
    def status(self) -> Optional[str]:
        return self.job.get_meta(refresh=True).get("status")

    @status.setter
    def status(self, message: str):
        print(f"Job status: {message}")
        self.job.meta["status"] = message
        self.job.save_meta()

    @property
    def aborted(self) -> bool:
        return self.job.get_meta(refresh=True).get("abort") == 1

    def abort(self):
        self.job.meta["abort"] = 1
        self.job.save_meta()

    def checkpoint(self):
        """Check if job should be aborted"""
        now = datetime.now()
        if (now - self._last_checkpoint_time).total_seconds() > 5:
            self._last_checkpoint_time = now
            if self.aborted:
                raise Exception("Job was aborted")

    def delete(self):
        self.job.delete()


def sample_background_task(user_id: str, task_data: Dict[str, Any]):
    """Sample background task - customize this for your needs"""
    ctx = JobContext()
    try:
        ctx.status = "Starting task..."
        
        # Simulate some work
        import time
        for i in range(10):
            ctx.checkpoint()  # Check for abort
            time.sleep(1)
            ctx.status = f"Processing step {i+1}/10"
        
        ctx.status = "Task completed successfully"
        return {"result": "success", "processed_data": task_data}
        
    except Exception as e:
        ctx.status = f"Task failed: {str(e)}"
        raise e


def update_flood_data_task(user_id: str = "system", site_codes: Optional[List[str]] = None):
    """Background task to update flood prediction data from USGS API"""
    ctx = JobContext()
    try:
        ctx.status = "Starting USGS data update..."
        
        # Use the global database path
        db_path = str(_db_path)
        
        ctx.status = "Fetching data from USGS API..."
        results = fetch_and_update_usgs_data(db_path, site_codes)
        
        ctx.checkpoint()  # Check for abort
        
        if results["success"]:
            ctx.status = f"Successfully updated {results['updated_count']} watersheds"
            log.info("USGS data update job completed", **results)
        else:
            ctx.status = f"Data update failed: {results['message']}"
            log.error("USGS data update job failed", **results)
        
        return results
        
    except Exception as e:
        error_msg = f"USGS data update task failed: {str(e)}"
        ctx.status = error_msg
        log.error("USGS data update task error", error=str(e))
        raise Exception(error_msg)


# =============================================================================
# API Models
# =============================================================================

class JobRequest(BaseModel):
    """Request model for creating a job"""
    name: str
    data: Dict[str, Any] = {}


class JobResponse(BaseModel):
    """Response model for job creation"""
    job_id: str


class Job(BaseModel):
    """Job status model"""
    id: str
    state: str
    aborted: bool
    name: str
    status: Optional[str] = None
    enqueued_at: Optional[str] = None
    started_at: Optional[str] = None
    ended_at: Optional[str] = None


class JobListResponse(BaseModel):
    """Response model for job list"""
    jobs: list[Job]


class JobUpdateRequest(BaseModel):
    """Request model for updating a job"""
    name: Optional[str] = None
    priority: Optional[int] = None


class RefreshTokenRequest(BaseModel):
    """Request model for refresh token"""
    refresh_token: str


class LogEntry(BaseModel):
    """Frontend log entry"""
    timestamp: str
    level: str
    message: str
    data: Optional[Dict[str, Any]] = None
    component: Optional[str] = None
    userId: Optional[str] = None
    sessionId: Optional[str] = None
    duration: Optional[float] = None
    url: Optional[str] = None
    userAgent: Optional[str] = None


class AnalyticsEvent(BaseModel):
    """Analytics event from frontend"""
    event_type: str
    event_data: Dict[str, Any]
    timestamp: str
    userId: Optional[str] = None
    sessionId: Optional[str] = None


# =============================================================================
# Dashboard Models  
# =============================================================================

class DashboardSummary(BaseModel):
    """Dashboard summary statistics"""
    total_watersheds: int
    active_alerts: int
    high_risk_watersheds: int
    moderate_risk_watersheds: int
    low_risk_watersheds: int
    last_updated: str


class Watershed(BaseModel):
    """Watershed information"""
    id: int
    name: str
    region: Optional[str] = "Texas"
    region_code: Optional[str] = "TX"
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    basin_size_sqmi: Optional[float] = None
    current_streamflow_cfs: float
    current_risk_level: str
    risk_score: float
    flood_stage_cfs: Optional[float] = None
    trend: Optional[str] = None
    trend_rate_cfs_per_hour: Optional[float] = None
    last_updated: str


class Alert(BaseModel):
    """Alert information"""
    alert_id: int
    alert_type: str
    watershed: str
    message: str
    severity: str
    issued_time: str
    expires_time: Optional[str] = None
    affected_counties: Optional[List[str]] = None
    data_source: Optional[str] = "sample"


class RiskTrendPoint(BaseModel):
    """Risk trend data point"""
    time: str
    risk: float
    watersheds: int


class DashboardData(BaseModel):
    """Complete dashboard data"""
    summary: DashboardSummary
    watersheds: List[Watershed]
    alerts: List[Alert]
    risk_trends: List[RiskTrendPoint]


# =============================================================================
# Helper Functions
# =============================================================================

def _make_job_id(user_id: str, job_id: str) -> str:
    """Create a composite job ID that includes the user ID"""
    return f"{user_id}/{job_id}"


def _parse_job_id(composite_id: str) -> tuple[str, str]:
    """Parse composite job ID to extract user ID and job ID"""
    user_id, job_id = composite_id.split("/", maxsplit=1)
    return user_id, job_id


def _is_job_owned_by(composite_id: str, expected_user_id: str) -> bool:
    """Check if a job is owned by the expected user"""
    user_id, _ = _parse_job_id(composite_id)
    return user_id == expected_user_id


def _to_job_status(job: rq.job.Job) -> Job:
    """Convert RQ job to our Job model"""
    meta = job.get_meta()
    _, job_id = _parse_job_id(job.id)
    return Job(
        id=job_id,
        state=job.get_status(),
        aborted=meta.get("abort") == 1,
        name=meta.get("name", "Unknown"),
        status=meta.get("status"),
        enqueued_at=_format_utc(job.enqueued_at) if job.enqueued_at else None,
        started_at=_format_utc(job.started_at) if job.started_at else None,
        ended_at=_format_utc(job.ended_at) if job.ended_at else None,
    )


# =============================================================================
# API Endpoints
# =============================================================================

@app.get(_api("config"))
async def get_config():
    config = dict(
        oidc_authority=settings.oidc_authority,
        oidc_client_id=settings.oidc_client_id,
        oidc_client_secret=settings.oidc_client_secret,
        oidc_scope=settings.oidc_scope,
        base_url=settings.base_url,
    )

    headers = {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
    }

    return Response(
        content=json.dumps(config), media_type="application/json", headers=headers
    )


@app.post(_api("logs"))
async def receive_frontend_logs(request: LogEntry):
    """Receive logs from frontend"""
    try:
        # Log frontend entry with backend logger
        log_level = getattr(log, request.level.lower(), log.info)
        log_level(f"Frontend: {request.message}", extra={
            "component": request.component,
            "user_id": request.userId,
            "session_id": request.sessionId,
            "frontend_url": request.url,
            "duration_ms": request.duration,
            "frontend_data": request.data,
            "source": "frontend"
        })
        
        # Store in Redis for real-time monitoring (optional)
        if settings.enable_metrics:
            log_key = f"frontend_logs:{request.sessionId}"
            _redis.lpush(log_key, json.dumps(request.dict()))
            _redis.expire(log_key, 3600)  # Keep for 1 hour
            
        return {"status": "logged"}
        
    except Exception as e:
        log.error(f"Failed to process frontend log: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process log")


@app.post(_api("analytics"))
async def receive_analytics(request: AnalyticsEvent):
    """Receive analytics events from frontend"""
    try:
        # Log analytics event
        log.info(f"Analytics: {request.event_type}", extra={
            "user_id": request.userId,
            "session_id": request.sessionId,
            "event_data": request.event_data,
            "source": "frontend_analytics"
        })
        
        # Store analytics data (you might want to use a dedicated analytics service)
        if settings.enable_metrics:
            analytics_key = f"analytics:{request.event_type}"
            _redis.lpush(analytics_key, json.dumps(request.dict()))
            _redis.expire(analytics_key, 86400)  # Keep for 24 hours
            
        return {"status": "tracked"}
        
    except Exception as e:
        log.error(f"Failed to process analytics event: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process analytics")


@app.post(_api("auth/refresh"))
async def refresh_token(
    user_id: UserID,
    request: RefreshTokenRequest,
):
    """Store and use refresh token to get new access token"""
    refresh_token = request.refresh_token
    if not refresh_token:
        raise HTTPException(status_code=400, detail="Missing refresh token")

    # Store refresh token
    _redis.setex(f"refresh_token:{user_id}", 86400, refresh_token)
    print(f"Stored refresh token for user {user_id}")

    try:
        token_endpoint = get_token_endpoint(settings.oidc_authority)
        headers = {"Content-Type": "application/x-www-form-urlencoded"}
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.oidc_client_id,
        }

        if settings.oidc_client_secret:
            data["client_secret"] = settings.oidc_client_secret

        response = requests.post(token_endpoint, headers=headers, data=data)
        if response.status_code == 200:
            token_data = response.json()
            if "access_token" in token_data:
                expires_in = token_data.get("expires_in", 300)
                _redis.setex(
                    f"access_token:{user_id}", 
                    expires_in,
                    token_data["access_token"]
                )

                if "refresh_token" in token_data:
                    _redis.setex(
                        f"refresh_token:{user_id}", 
                        86400,
                        token_data["refresh_token"]
                    )

                return {"status": "success", "message": "Tokens refreshed successfully"}

        print(f"Failed to refresh token: {response.status_code}")
    except Exception as e:
        print(f"Error refreshing token: {str(e)}")

    return {"status": "stored", "message": "Refresh token stored"}


@app.post(_api("jobs"), response_model=JobResponse)
async def create_job(user_id: UserID, request: JobRequest):
    """Create a new background job"""
    job_id = _make_job_id(user_id, uid())
    
    meta = {"name": request.name}
    
    _job_queue.enqueue(
        sample_background_task,
        job_id=job_id,
        timeout=-1,  # No timeout
        ttl=604800,  # 1 week TTL
        failure_ttl=604800,  # 1 week failure TTL
        meta=meta,
        kwargs={
            "user_id": user_id,
            "task_data": request.data,
        },
    )
    
    _, simple_job_id = _parse_job_id(job_id)
    return JobResponse(job_id=simple_job_id)


@app.get(_api("jobs"), response_model=JobListResponse)
async def list_jobs(user_id: UserID):
    """Get all jobs for the current user"""
    # Get jobs from different registries
    started_job_ids = _job_queue.started_job_registry.get_job_ids()
    failed_job_ids = _job_queue.failed_job_registry.get_job_ids()
    queued_job_ids = _job_queue.job_ids
    finished_job_ids = _job_queue.finished_job_registry.get_job_ids()
    
    all_ids = started_job_ids + failed_job_ids + queued_job_ids + finished_job_ids
    
    # Filter jobs owned by current user
    job_ids = [job_id for job_id in all_ids if _is_job_owned_by(job_id, user_id)]
    jobs = [_job_queue.fetch_job(job_id) for job_id in job_ids if _job_queue.fetch_job(job_id)]
    
    return JobListResponse(jobs=[_to_job_status(job) for job in jobs])


@app.get(_api("jobs/{job_id}"), response_model=Job)
async def get_job(user_id: UserID, job_id: str):
    """Get a specific job by ID"""
    full_job_id = _make_job_id(user_id, job_id)
    job = _job_queue.fetch_job(full_job_id)
    
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return _to_job_status(job)


@app.patch(_api("jobs/{job_id}"))
async def update_job(user_id: UserID, job_id: str, request: JobUpdateRequest):
    """Update job metadata"""
    full_job_id = _make_job_id(user_id, job_id)
    job = _job_queue.fetch_job(full_job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Update job metadata
    if request.name is not None:
        job.meta["name"] = request.name
        job.save_meta()
    
    return {"status": "success", "message": "Job updated"}


@app.delete(_api("jobs/{job_id}"))
async def delete_job(user_id: UserID, job_id: str):
    """Delete a job"""
    full_job_id = _make_job_id(user_id, job_id)
    job = _job_queue.fetch_job(full_job_id)
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    status = job.get_status()
    if status == "started":
        # Abort running job
        JobContext(job).abort()
        return {"status": "success", "message": "Job aborted"}
    
    try:
        job.delete()
        return {"status": "success", "message": "Job deleted"}
    except InvalidJobOperationError as e:
        message = f"Failed deleting job: {e}"
        print(message)
        raise HTTPException(status_code=500, detail=message)


# =============================================================================
# AI Chat API Models
# =============================================================================

class ChatMessage(BaseModel):
    """Chat message model"""
    message: str
    watershed_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None
    use_agent: bool = False
    model: Optional[str] = None

class ChatResponse(BaseModel):
    """AI chat response model"""
    response: str
    confidence: float
    recommendations: List[str] = []
    timestamp: str

# =============================================================================
# NAT Agent Chat API Models
# =============================================================================

class NATChatMessage(BaseModel):
    """NAT agent chat message model"""
    message: str
    agent_type: str = "risk_analyzer"  # data_collector, risk_analyzer, emergency_responder, predictor, all
    location: Optional[str] = "Texas Region"
    forecast_hours: Optional[int] = 24
    scenario: Optional[str] = "routine_check"
    custom_prompt: Optional[str] = None

class NATChatResponse(BaseModel):
    """NAT agent chat response model"""
    output: str
    agent_type: str
    status: str
    logs: List[Dict[str, Any]] = []
    timestamp: str

# =============================================================================
# Analytics API Models
# =============================================================================

class AnalyticsTimeRange(BaseModel):
    """Analytics time range request"""
    range: str = "7d"  # 7d, 30d, 90d
    metric: str = "risk_score"  # risk_score, flow, alerts

class HistoricalDataPoint(BaseModel):
    """Historical data point"""
    date: str
    time: str
    avg_risk_score: float
    avg_flow: float
    high_risk_count: int
    alerts_count: int

class RiskDistribution(BaseModel):
    """Risk distribution data"""
    name: str
    value: int
    color: str
    percentage: int

class WatershedComparison(BaseModel):
    """Watershed comparison data"""
    name: str
    risk_score: float
    flow_ratio: float
    current_flow: float

class FlowComparison(BaseModel):
    """Flow vs flood stage comparison"""
    name: str
    current_flow: float
    flood_stage: float
    capacity_used: float

class AnalyticsData(BaseModel):
    """Complete analytics data"""
    summary: Dict[str, Any]
    historical_data: List[HistoricalDataPoint]
    risk_distribution: List[RiskDistribution]
    watershed_comparison: List[WatershedComparison]
    flow_comparison: List[FlowComparison]

# =============================================================================
# Region API Models
# =============================================================================

class Region(BaseModel):
    """Region information"""
    code: str
    name: str
    description: str
    center_lat: float
    center_lng: float
    zoom: int
    watershed_count: int

# =============================================================================
# Dashboard API Endpoints
# =============================================================================

@app.get(_api("regions"), response_model=List[Region])
async def get_available_regions():
    """Get list of all available regions"""
    try:
        from .data_sources import get_available_regions
        regions = get_available_regions()
        return [Region(**r) for r in regions]
    except Exception as e:
        log.error(f"Failed to get regions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load regions")


@app.get(_api("regions/{region_code}"), response_model=Region)
async def get_region_details(region_code: str):
    """Get details for a specific region"""
    try:
        from .data_sources import get_region_config
        config = get_region_config(region_code)
        if not config:
            raise HTTPException(status_code=404, detail=f"Region {region_code} not found")

        return Region(
            code=config["code"],
            name=config["name"],
            description=config["description"],
            center_lat=config["center_lat"],
            center_lng=config["center_lng"],
            zoom=config["zoom"],
            watershed_count=len(config["sites"])
        )
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Failed to get region details: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load region details")


@app.get(_api("dashboard"), response_model=DashboardData)
async def get_dashboard_data(response: Response, region: Optional[str] = None):
    """Get complete dashboard data, optionally filtered by region"""
    try:
        # Set cache control headers to prevent caching
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

        # Get dashboard data (no auto-population of sample data)
        summary = db.get_dashboard_summary(str(_db_path))
        watersheds = db.get_watersheds(str(_db_path), region_code=region)

        # Initialize watersheds from USGS if database is empty
        if len(watersheds) == 0:
            from .data_sources import create_watersheds_from_usgs_sites
            log.info(f"No watersheds found for region {region or 'TX'}, initializing from USGS sites...")
            result = create_watersheds_from_usgs_sites(str(_db_path), limit=12, region_code=region or "TX")
            if result['created_count'] > 0:
                watersheds = db.get_watersheds(str(_db_path), region_code=region)
                summary = db.get_dashboard_summary(str(_db_path))

        alerts = db.get_active_alerts(str(_db_path), limit=100)  # Increased limit to fetch more alerts
        risk_trends = db.get_risk_trend_data(str(_db_path))

        # Generate sample risk trend data if none exists
        if not risk_trends:
            import random
            import datetime
            now = datetime.datetime.now()
            risk_trends = []
            for i in range(24):
                hour = (now - datetime.timedelta(hours=23-i)).strftime('%H:00')
                risk_trends.append({
                    'time': hour,
                    'risk': round(random.uniform(3.0, 7.0), 1),
                    'watersheds': random.randint(8, 12)
                })

        return DashboardData(
            summary=DashboardSummary(**summary),
            watersheds=[Watershed(**w) for w in watersheds],
            alerts=[Alert(**a) for a in alerts],
            risk_trends=[RiskTrendPoint(**r) for r in risk_trends]
        )

    except Exception as e:
        log.error(f"Failed to get dashboard data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard data")


@app.get(_api("dashboard/summary"), response_model=DashboardSummary)
async def get_dashboard_summary():
    """Get dashboard summary statistics"""
    try:
        summary = db.get_dashboard_summary(str(_db_path))
        if summary['total_watersheds'] == 0:
            # Initialize watersheds from USGS if database is empty (no sample data)
            from .data_sources import create_watersheds_from_usgs_sites
            log.info("No watersheds found, initializing from USGS sites...")
            create_watersheds_from_usgs_sites(str(_db_path), limit=12)
            summary = db.get_dashboard_summary(str(_db_path))

        return DashboardSummary(**summary)
        
    except Exception as e:
        log.error(f"Failed to get dashboard summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard summary")


@app.get(_api("watersheds"), response_model=List[Watershed])
async def get_watersheds(region: Optional[str] = None):
    """Get all watersheds, optionally filtered by region"""
    try:
        watersheds = db.get_watersheds(str(_db_path), region_code=region)
        return [Watershed(**w) for w in watersheds]

    except Exception as e:
        log.error(f"Failed to get watersheds: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load watersheds")


@app.get(_api("alerts"), response_model=List[Alert])
async def get_alerts(limit: int = 100, response: Response = None):
    """Get active alerts"""
    try:
        # Set cache control headers to prevent caching
        if response:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        alerts = db.get_active_alerts(str(_db_path), limit)
        return [Alert(**a) for a in alerts]

    except Exception as e:
        log.error(f"Failed to get alerts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load alerts")


@app.post(_api("alerts/refresh"))
async def refresh_alerts(user_id: UserID):
    """Manually trigger NOAA alerts refresh from real-time API"""
    try:
        if not settings.enable_real_time_data:
            raise HTTPException(status_code=400, detail="Real-time data integration is disabled")

        # Clear expired alerts first
        db.clear_expired_alerts(str(_db_path))

        # Fetch and store NOAA alerts
        noaa_results = fetch_and_store_noaa_alerts(str(_db_path))

        return {
            "status": "success" if noaa_results["success"] else "partial",
            "message": noaa_results["message"],
            "alerts_fetched": noaa_results.get("alerts_fetched", 0),
            "alerts_stored": noaa_results.get("alerts_stored", 0),
            "alerts_skipped": noaa_results.get("alerts_skipped", 0),
            "timestamp": noaa_results.get("timestamp")
        }

    except Exception as e:
        log.error(f"Failed to refresh alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh alerts: {str(e)}")


@app.post(_api("alerts/clear-sample"))
async def clear_sample_alerts_endpoint():
    """Clear all sample alerts from the database"""
    try:
        deleted_count = db.clear_sample_alerts(str(_db_path))
        return {
            "status": "success",
            "message": f"Cleared {deleted_count} sample alerts",
            "deleted_count": deleted_count
        }
    except Exception as e:
        log.error(f"Failed to clear sample alerts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to clear sample alerts: {str(e)}")


@app.post(_api("dashboard/populate-sample-data"))
async def populate_sample_data():
    """Populate database with sample flood prediction data"""
    try:
        db.populate_sample_data(str(_db_path))
        return {"status": "success", "message": "Sample data populated"}

    except Exception as e:
        log.error(f"Failed to populate sample data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to populate sample data")


@app.post(_api("dashboard/refresh-usgs-data"))
async def refresh_usgs_data(user_id: UserID):
    """Manually trigger USGS data refresh"""
    try:
        if not settings.enable_real_time_data:
            raise HTTPException(status_code=400, detail="Real-time data integration is disabled")
        
        # Create background job for USGS data update
        job_id = _make_job_id(user_id, uid())
        
        meta = {"name": "USGS Data Refresh"}
        
        job = _job_queue.enqueue(
            update_flood_data_task,
            job_id=job_id,
            timeout=600,  # 10 minutes timeout
            ttl=3600,  # 1 hour TTL
            failure_ttl=3600,  # 1 hour failure TTL
            meta=meta,
            kwargs={
                "user_id": user_id,
                "site_codes": None  # Use default major river sites
            },
        )
        
        _, simple_job_id = _parse_job_id(job_id)
        return {
            "status": "success", 
            "message": "USGS data refresh started",
            "job_id": simple_job_id
        }
        
    except Exception as e:
        log.error(f"Failed to start USGS data refresh: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start USGS data refresh")


@app.post(_api("dashboard/update-single-watershed/{watershed_id}"))
async def update_single_watershed_data(watershed_id: int, user_id: UserID):
    """Update a single watershed with latest USGS data"""
    try:
        if not settings.enable_real_time_data:
            raise HTTPException(status_code=400, detail="Real-time data integration is disabled")
        
        # Get watershed info
        watersheds = db.get_watersheds(str(_db_path))
        target_watershed = next((w for w in watersheds if w['id'] == watershed_id), None)
        
        if not target_watershed:
            raise HTTPException(status_code=404, detail="Watershed not found")
        
        # Extract USGS site code from watershed name if available
        import re
        site_code_match = re.search(r'USGS (\d{8})', target_watershed['name'])
        if not site_code_match:
            raise HTTPException(
                status_code=400, 
                detail="No USGS site code found for this watershed"
            )
        
        site_code = site_code_match.group(1)
        
        # Create background job for single watershed update
        job_id = _make_job_id(user_id, uid())
        
        meta = {"name": f"Update Watershed {target_watershed['name']}"}
        
        job = _job_queue.enqueue(
            update_flood_data_task,
            job_id=job_id,
            timeout=300,  # 5 minutes timeout
            ttl=1800,  # 30 minutes TTL
            failure_ttl=1800,  # 30 minutes failure TTL
            meta=meta,
            kwargs={
                "user_id": user_id,
                "site_codes": [site_code]
            },
        )
        
        _, simple_job_id = _parse_job_id(job_id)
        return {
            "status": "success",
            "message": f"Watershed {target_watershed['name']} update started",
            "job_id": simple_job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Failed to update single watershed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update watershed data")


# =============================================================================
# Analytics API Endpoints
# =============================================================================

@app.get(_api("analytics"), response_model=AnalyticsData)
async def get_analytics_data(
    time_range: str = "7d",
    metric: str = "risk_score"
):
    """Get complete analytics data"""
    try:
        # Initialize watersheds from USGS if database is empty (no sample data)
        summary = db.get_dashboard_summary(str(_db_path))
        if summary['total_watersheds'] == 0:
            from .data_sources import create_watersheds_from_usgs_sites
            log.info("No watersheds found, initializing from USGS sites...")
            create_watersheds_from_usgs_sites(str(_db_path), limit=12)

        # Get analytics data
        analytics_data = db.get_analytics_data(str(_db_path), time_range, metric)
        
        return AnalyticsData(**analytics_data)
        
    except Exception as e:
        log.error(f"Failed to get analytics data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load analytics data")

@app.get(_api("analytics/historical"), response_model=List[HistoricalDataPoint])
async def get_historical_data(
    time_range: str = "7d"
):
    """Get historical trend data"""
    try:
        historical_data = db.get_historical_analytics_data(str(_db_path), time_range)
        return [HistoricalDataPoint(**point) for point in historical_data]
        
    except Exception as e:
        log.error(f"Failed to get historical data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load historical data")

@app.get(_api("analytics/risk-distribution"), response_model=List[RiskDistribution])
async def get_risk_distribution():
    """Get current risk distribution"""
    try:
        distribution = db.get_risk_distribution_data(str(_db_path))
        return [RiskDistribution(**item) for item in distribution]
        
    except Exception as e:
        log.error(f"Failed to get risk distribution: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load risk distribution")

@app.get(_api("analytics/watershed-comparison"), response_model=List[WatershedComparison])
async def get_watershed_comparison():
    """Get watershed comparison data"""
    try:
        comparison = db.get_watershed_comparison_data(str(_db_path))
        return [WatershedComparison(**item) for item in comparison]
        
    except Exception as e:
        log.error(f"Failed to get watershed comparison: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load watershed comparison")

@app.get(_api("analytics/flow-comparison"), response_model=List[FlowComparison])
async def get_flow_comparison():
    """Get flow vs flood stage comparison"""
    try:
        comparison = db.get_flow_comparison_data(str(_db_path))
        return [FlowComparison(**item) for item in comparison]
        
    except Exception as e:
        log.error(f"Failed to get flow comparison: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load flow comparison")

@app.get(_api("dashboard/insights"))
async def get_dashboard_insights():
    """Get comprehensive dashboard insights and metrics"""
    try:
        # Get base data
        summary = db.get_dashboard_summary(str(_db_path))
        watersheds = db.get_watersheds(str(_db_path))
        analytics_data = db.get_analytics_data(str(_db_path), '24h', 'risk_score')
        
        # Calculate additional insights
        usgs_stations = len([w for w in watersheds if w.get('data_source') == 'usgs'])
        rising_trend_count = len([w for w in watersheds if w.get('trend') == 'rising'])
        average_flow = sum([w.get('current_streamflow_cfs', 0) for w in watersheds]) / len(watersheds) if watersheds else 0
        
        # Calculate model accuracy based on data quality
        total_stations = len(watersheds)
        accuracy_base = 75.0  # Base accuracy
        if usgs_stations > 0:
            accuracy_boost = min((usgs_stations / total_stations) * 15, 15)  # Up to 15% boost for real-time data
            model_accuracy = accuracy_base + accuracy_boost
        else:
            model_accuracy = accuracy_base
        
        # Confidence level based on data availability and risk distribution
        high_risk_ratio = summary['high_risk_watersheds'] / summary['total_watersheds'] if summary['total_watersheds'] > 0 else 0
        if usgs_stations / total_stations > 0.7 and high_risk_ratio < 0.3:
            confidence = "HIGH"
        elif usgs_stations / total_stations > 0.4:
            confidence = "MODERATE" 
        else:
            confidence = "LOW"
            
        return {
            "model_accuracy": round(model_accuracy, 1),
            "usgs_stations": usgs_stations,
            "total_stations": total_stations,
            "rising_trend_count": rising_trend_count,
            "average_flow": round(average_flow, 2),
            "confidence_level": confidence,
            "data_quality_score": round((usgs_stations / total_stations) * 100, 1) if total_stations > 0 else 0,
            "next_update": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
            "system_status": "operational",
            "alert_trend": "stable" if rising_trend_count < 3 else "increasing"
        }
        
    except Exception as e:
        log.error(f"Failed to get dashboard insights: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard insights")

# =============================================================================
# User Settings API Models
# =============================================================================

class UserSettings(BaseModel):
    """User settings model"""
    notifications: Dict[str, Any]
    display: Dict[str, Any]
    data: Dict[str, Any]

class SettingsUpdateRequest(BaseModel):
    """Settings update request model"""
    settings: UserSettings

# =============================================================================
# User Settings API Endpoints
# =============================================================================

@app.get(_api("settings"), response_model=UserSettings)
async def get_user_settings(user_id: UserID):
    """Get current user's settings"""
    try:
        settings = db.get_user_settings(str(_db_path), user_id)
        return UserSettings(**settings)
    except Exception as e:
        log.error(f"Failed to get user settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve settings")

@app.post(_api("settings"))
async def update_user_settings(user_id: UserID, settings: UserSettings):
    """Update current user's settings"""
    try:
        db.save_user_settings(str(_db_path), user_id, settings.dict())
        return {"status": "success", "message": "Settings updated successfully"}
    except Exception as e:
        log.error(f"Failed to save user settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save settings")

@app.delete(_api("settings"))
async def reset_user_settings(user_id: UserID):
    """Reset current user's settings to defaults"""
    try:
        db.delete_user_settings(str(_db_path), user_id)
        return {"status": "success", "message": "Settings reset to defaults"}
    except Exception as e:
        log.error(f"Failed to reset user settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to reset settings")

@app.get(_api("settings/export"))
async def export_user_settings(user_id: UserID):
    """Export current user's settings as JSON file"""
    try:
        settings = db.get_user_settings(str(_db_path), user_id)
        
        # Create JSON response
        import json
        from fastapi.responses import StreamingResponse
        import io
        
        json_str = json.dumps(settings, indent=2)
        json_bytes = io.BytesIO(json_str.encode('utf-8'))
        
        return StreamingResponse(
            json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=flood-prediction-settings.json"}
        )
    except Exception as e:
        log.error(f"Failed to export user settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to export settings")

@app.post(_api("settings/import"))
async def import_user_settings(user_id: UserID, request: Request):
    """Import user settings from JSON"""
    try:
        import json
        
        # Read body as bytes
        body = await request.body()
        if not body:
            raise HTTPException(status_code=400, detail="No file content provided")
            
        # Parse JSON settings
        settings_data = json.loads(body.decode('utf-8'))
        
        # Validate structure (basic validation)
        required_keys = ['notifications', 'display', 'data']
        if not all(key in settings_data for key in required_keys):
            raise HTTPException(status_code=400, detail="Invalid settings file format")
            
        # Save settings
        db.save_user_settings(str(_db_path), user_id, settings_data)
        
        return {"status": "success", "message": "Settings imported successfully", "settings": settings_data}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON format")
    except Exception as e:
        log.error(f"Failed to import user settings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to import settings")

# =============================================================================
# AI Chat API Endpoints
# =============================================================================

@app.get(_api("ai/models"))
async def get_llm_models(provider: Optional[str] = None):
    """Get available LLM models from the specified provider"""
    try:
        models = get_available_llm_models(provider)
        provider_info = get_provider_info(provider)
        return {
            "models": models, 
            "default_model": provider_info.get("default_model"),
            "provider": provider_info.get("name")
        }
    except Exception as e:
        log.error(f"Failed to get LLM models: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get LLM models")

@app.post(_api("ai/chat"), response_model=ChatResponse)
async def chat_with_ai(user_id: UserID, request: ChatMessage):
    """Chat with AI assistant about flood conditions"""
    try:
        # Generate AI response based on the message and context
        response = db.generate_ai_response(
            str(_db_path), 
            request.message, 
            request.watershed_id,
            request.context or {}
        )
        
        return ChatResponse(
            response=response["content"],
            confidence=response["confidence"],
            recommendations=response.get("recommendations", []),
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
    except Exception as e:
        log.error(f"Failed to process AI chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process chat message")


@app.post(_api("ai/chat/stream"))
async def stream_chat_with_ai(user_id: UserID, request: ChatMessage):
    """Stream chat with AI assistant about flood conditions"""
    try:
        import asyncio
        import json
        
        async def generate_stream():
            try:
                import threading
                import concurrent.futures
                from collections import deque
                
                # Use thread-safe deque and event for communication
                chunks_queue = deque()
                done_event = threading.Event()
                error_container = {'error': None}
                
                # Get provider info for evaluation
                provider_info = get_provider_info(None)  # Use default provider
                
                def sync_callback(chunk: str):
                    chunks_queue.append(chunk)
                
                def run_llm_sync():
                    try:
                        # Create a new event loop for this thread
                        import asyncio
                        try:
                            loop = asyncio.get_event_loop()
                        except RuntimeError:
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                        
                        final_response = loop.run_until_complete(llm_call_stream(
                            request.message, 
                            sync_callback, 
                            request.model, 
                            request.use_agent
                        ))
                        chunks_queue.append("__DONE__")
                        done_event.set()
                        return final_response
                    except Exception as e:
                        error_container['error'] = str(e)
                        chunks_queue.append(f"__ERROR__:{str(e)}")
                        done_event.set()
                        return ""
                
                # Start the LLM in a background thread
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    llm_future = executor.submit(run_llm_sync)
                    
                    # Stream chunks as they arrive
                    while not done_event.is_set() or chunks_queue:
                        if chunks_queue:
                            chunk = chunks_queue.popleft()
                            if chunk == "__DONE__":
                                break
                            elif chunk.startswith("__ERROR__"):
                                error_msg = chunk[9:]  # Remove "__ERROR__:" prefix
                                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                                break
                            else:
                                # Send streaming chunk
                                yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\n\n"
                        else:
                            # Small delay to avoid busy waiting and send keepalive
                            await asyncio.sleep(0.1)
                            if not done_event.is_set():
                                yield f"data: {json.dumps({'keepalive': True})}\n\n"
                    
                    # Wait for LLM completion
                    final_response = llm_future.result()
                    
                    # Run evaluation for all responses (agent and non-agent) if we have a complete response
                    if final_response and not error_container['error']:
                        try:
                            evaluation_result = await evaluator.evaluate_chat_response(
                                question=request.message,
                                response=final_response,
                                model_used=request.model or "default",
                                agent_used=request.use_agent,
                                watershed_context=request.context,
                                response_provider=provider_info.get("name", "unknown")  # Use actual provider used
                            )
                            
                            # Send evaluation results
                            evaluation_data = {
                                'evaluation': {
                                    'id': evaluation_result.id,
                                    'overall_score': evaluation_result.metrics.overall,
                                    'confidence': evaluation_result.metrics.confidence,
                                    'safety_score': evaluation_result.metrics.safety,
                                    'helpfulness': evaluation_result.metrics.helpfulness,
                                    'accuracy': evaluation_result.metrics.accuracy,
                                    'reasoning': evaluation_result.judge_reasoning
                                }
                            }
                            yield f"data: {json.dumps(evaluation_data)}\n\n"
                            
                        except Exception as eval_error:
                            log.warning(f"Evaluation failed: {str(eval_error)}")
                            # Don't fail the entire response if evaluation fails
                    
                    yield f"data: {json.dumps({'done': True})}\n\n"
                
            except Exception as e:
                log.error(f"Stream generation error: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
        
    except Exception as e:
        log.error(f"Failed to process streaming AI chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process streaming chat message")


# =============================================================================
# NAT Agent Chat API Endpoints
# =============================================================================

@app.get(_api("nat/agents"))
async def get_available_nat_agents():
    """Get available NAT agents"""
    if not _nat_runner:
        raise HTTPException(status_code=503, detail="NAT agents are not available")
    
    try:
        agents_info = _nat_runner.list_available_agents()
        return agents_info
    except Exception as e:
        log.error(f"Failed to get NAT agents: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get NAT agents")

@app.post(_api("nat/chat"), response_model=NATChatResponse)
async def chat_with_nat_agent(user_id: UserID, request: NATChatMessage):
    """Chat with NAT agents (non-streaming)"""
    if not _nat_runner:
        raise HTTPException(status_code=503, detail="NAT agents are not available")
    
    try:
        # Execute NAT agent workflow based on agent type
        if request.agent_type == "data_collector":
            result = await _nat_runner.run_data_collector(request.custom_prompt or request.message)
        elif request.agent_type == "risk_analyzer":
            result = await _nat_runner.run_risk_analyzer(request.location, request.custom_prompt or request.message)
        elif request.agent_type == "emergency_responder":
            result = await _nat_runner.run_emergency_responder(request.scenario, request.custom_prompt or request.message)
        elif request.agent_type == "predictor":
            result = await _nat_runner.run_predictor(request.forecast_hours, request.location, request.custom_prompt or request.message)
        elif request.agent_type == "h2ogpte_agent":
            result = await _nat_runner.run_h2ogpte_agent("train_model", request.custom_prompt or request.message, request.custom_prompt)
        elif request.agent_type == "all":
            result = await _nat_runner.run_comprehensive_analysis()
        else:
            raise HTTPException(status_code=400, detail=f"Unknown agent type: {request.agent_type}")
        
        return NATChatResponse(
            output=result.get("output", str(result)),
            agent_type=request.agent_type,
            status=result.get("status", "completed"),
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
    except Exception as e:
        log.error(f"Failed to process NAT chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process NAT chat: {str(e)}")

@app.post(_api("nat/chat/stream"))
async def stream_chat_with_nat_agent(user_id: UserID, request: NATChatMessage):
    """Stream chat with NAT agents with filtered logs"""
    if not _nat_runner:
        raise HTTPException(status_code=503, detail="NAT agents are not available")
    
    try:
        import asyncio
        import json
        import logging
        
        async def generate_nat_stream():
            try:
                import threading
                import concurrent.futures
                from collections import deque
                import io
                import sys
                
                # Create custom log handler to capture logs
                log_queue = deque()
                done_event = threading.Event()
                error_container = {'error': None}
                result_container = {'result': None}
                
                # Custom log handler for capturing NAT logs
                class NATLogHandler(logging.Handler):
                    def emit(self, record):
                        message = record.getMessage()
                        
                        # Include important agent logs and filter out noise
                        should_include = False
                        
                        # Always include warnings and errors
                        if record.levelno >= logging.WARNING:
                            should_include = True
                        
                        # Include agent-specific logs
                        elif any(keyword in message for keyword in [
                            '[AGENT]', 'Agent input:', 'Agent\'s thoughts:', 'Final Answer:',
                            'Action:', 'Action Input:', 'Tool\'s response:', 'Calling tools:',
                            'agent.react_agent', 'nat_base', 'Workflow completed'
                        ]):
                            should_include = True
                        
                        # Exclude HTTP requests and other noise
                        elif any(noise in message for noise in [
                            'HTTP Request:', 'httpx', 'POST http', 'GET http'
                        ]):
                            should_include = False
                        
                        if should_include:
                            log_entry = {
                                'timestamp': record.created,
                                'level': record.levelname,
                                'message': message,
                                'logger': record.name
                            }
                            log_queue.append(log_entry)
                
                # Add our handler to capture logs
                handler = NATLogHandler()
                logging.getLogger().addHandler(handler)
                
                def run_nat_sync():
                    try:
                        # Create a new event loop for this thread
                        import asyncio
                        try:
                            loop = asyncio.get_event_loop()
                        except RuntimeError:
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                        
                        # Execute NAT agent workflow based on agent type
                        if request.agent_type == "data_collector":
                            result = loop.run_until_complete(_nat_runner.run_data_collector(request.custom_prompt or request.message))
                        elif request.agent_type == "risk_analyzer":
                            result = loop.run_until_complete(_nat_runner.run_risk_analyzer(request.location, request.custom_prompt or request.message))
                        elif request.agent_type == "emergency_responder":
                            result = loop.run_until_complete(_nat_runner.run_emergency_responder(request.scenario, request.custom_prompt or request.message))
                        elif request.agent_type == "predictor":
                            result = loop.run_until_complete(_nat_runner.run_predictor(request.forecast_hours, request.location, request.custom_prompt or request.message))
                        elif request.agent_type == "h2ogpte_agent":
                            result = loop.run_until_complete(_nat_runner.run_h2ogpte_agent("train_model", request.custom_prompt or request.message, request.custom_prompt))
                        elif request.agent_type == "all":
                            result = loop.run_until_complete(_nat_runner.run_comprehensive_analysis())
                        else:
                            raise ValueError(f"Unknown agent type: {request.agent_type}")
                        
                        result_container['result'] = result
                        done_event.set()
                        return result
                        
                    except Exception as e:
                        error_container['error'] = str(e)
                        done_event.set()
                        return None
                    finally:
                        # Remove our log handler
                        logging.getLogger().removeHandler(handler)
                
                # Start NAT agent in background thread
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    nat_future = executor.submit(run_nat_sync)
                    
                    # Send initial metadata
                    yield f"data: {json.dumps({'type': 'start', 'agent_type': request.agent_type, 'location': request.location})}\n\n"
                    
                    # Stream logs as they arrive
                    while not done_event.is_set() or log_queue:
                        if log_queue:
                            log_entry = log_queue.popleft()
                            yield f"data: {json.dumps({'type': 'log', 'log': log_entry})}\n\n"
                        else:
                            # Small delay and send keepalive
                            await asyncio.sleep(0.1)
                            if not done_event.is_set():
                                yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                    
                    # Wait for completion and get result
                    final_result = nat_future.result()
                    
                    if error_container['error']:
                        yield f"data: {json.dumps({'type': 'error', 'error': error_container['error']})}\n\n"
                    else:
                        result = result_container['result']
                        yield f"data: {json.dumps({'type': 'result', 'output': result.get('output', str(result)), 'status': result.get('status', 'completed')})}\n\n"
                    
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                
            except Exception as e:
                log.error(f"NAT stream generation error: {str(e)}")
                yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_nat_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
        
    except Exception as e:
        log.error(f"Failed to process NAT streaming chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process NAT streaming chat")


# =============================================================================
# AI Provider Management API Endpoints
# =============================================================================

class AIProviderRequest(BaseModel):
    """Request model for AI provider operations"""
    provider: str = "auto"  # "h2ogpte", "nvidia", "auto"
    model: Optional[str] = None
    use_agent: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    context: Optional[Dict[str, Any]] = None

class EnhancedChatMessage(BaseModel):
    """Enhanced chat message model with provider selection"""
    message: str
    watershed_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None
    provider: str = "auto"  # "h2ogpte", "nvidia", "auto"
    model: Optional[str] = None
    use_agent: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class EnhancedChatResponse(BaseModel):
    """Enhanced chat response with provider metadata"""
    response: str
    provider_used: str
    model_used: str
    agent_used: bool
    confidence: float
    recommendations: List[str] = []
    timestamp: str

@app.get(_api("ai/providers"))
async def get_available_providers():
    """Get available AI providers and their capabilities"""
    try:
        providers_info = get_all_providers_info()
        current_provider = settings.ai_provider
        
        return {
            "providers": providers_info,
            "current_default": current_provider,
            "nvidia_features": {
                "agents_enabled": settings.enable_nvidia_agents,
                "rag_enabled": settings.enable_nvidia_rag,
                "evaluator_enabled": settings.enable_nvidia_evaluator
            }
        }
    except Exception as e:
        log.error(f"Failed to get available providers: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get available providers")

@app.get(_api("ai/providers/{provider_name}"))
async def get_provider_details(provider_name: str):
    """Get detailed information about a specific provider"""
    try:
        provider_info = get_provider_info(provider_name)
        return provider_info
    except Exception as e:
        log.error(f"Failed to get provider details: {str(e)}")
        raise HTTPException(status_code=404, detail=f"Provider '{provider_name}' not found or not available")

@app.get(_api("ai/providers/{provider_name}/models"))
async def get_provider_models(provider_name: str):
    """Get available models for a specific provider"""
    try:
        models = get_available_llm_models(provider_name)
        provider_info = get_provider_info(provider_name)
        
        return {
            "provider": provider_name,
            "models": models,
            "default_model": provider_info.get("default_model"),
            "supports_agents": provider_info.get("supports_agents", False)
        }
    except Exception as e:
        log.error(f"Failed to get models for provider {provider_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get models for provider {provider_name}")

@app.post(_api("ai/chat/enhanced"), response_model=EnhancedChatResponse)
async def enhanced_chat_with_ai(user_id: UserID, request: EnhancedChatMessage):
    """Enhanced chat with AI assistant with provider selection"""
    try:
        # Determine which provider to use
        provider_name = request.provider if request.provider != "auto" else None
        
        # Generate AI response using selected provider
        from .api import llm_call  # Import here to avoid circular imports
        
        # Prepare context for response generation
        context = request.context or {}
        if request.watershed_id:
            context["watershed_id"] = request.watershed_id
        
        # Build enhanced prompt with context
        if request.watershed_id:
            watershed_context = db.get_watershed_context(str(_db_path), request.watershed_id)
            enhanced_prompt = f"""
Context: You are an AI assistant helping with flood prediction and water management.

Watershed Information: {watershed_context}

User Question: {request.message}

Please provide a helpful and accurate response based on the available data and context.
"""
        else:
            enhanced_prompt = request.message
        
        # Call the AI provider
        response = await llm_call(
            enhanced_prompt,
            model=request.model,
            use_agent=request.use_agent,
            provider_name=provider_name,
            temperature=request.temperature or 0.7,
            max_tokens=request.max_tokens or 4096
        )
        
        # Get provider info for response metadata
        provider_info = get_provider_info(provider_name)
        
        return EnhancedChatResponse(
            response=response,
            provider_used=provider_info.get("name", "unknown"),
            model_used=request.model or provider_info.get("default_model", "unknown"),
            agent_used=request.use_agent and provider_info.get("supports_agents", False),
            confidence=0.85,  # Placeholder confidence score
            recommendations=[],  # TODO: Add recommendation logic
            timestamp=datetime.now(timezone.utc).isoformat()
        )
        
    except Exception as e:
        log.error(f"Failed to process enhanced AI chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process enhanced chat message")

@app.post(_api("ai/chat/enhanced/stream"))
async def enhanced_stream_chat_with_ai(user_id: UserID, request: EnhancedChatMessage):
    """Enhanced streaming chat with AI assistant with provider selection"""
    try:
        import asyncio
        import json
        
        # Determine which provider to use
        provider_name = request.provider if request.provider != "auto" else None
        
        async def generate_enhanced_stream():
            try:
                import threading
                import concurrent.futures
                from collections import deque
                
                # Use thread-safe deque and event for communication
                chunks_queue = deque()
                done_event = threading.Event()
                error_container = {'error': None}
                provider_info = get_provider_info(provider_name)
                
                def sync_callback(chunk: str):
                    chunks_queue.append(chunk)
                
                def run_llm_sync():
                    try:
                        # Build enhanced prompt with context
                        if request.watershed_id:
                            watershed_context = db.get_watershed_context(str(_db_path), request.watershed_id)
                            enhanced_prompt = f"""
Context: You are an AI assistant helping with flood prediction and water management.

Watershed Information: {watershed_context}

User Question: {request.message}

Please provide a helpful and accurate response based on the available data and context.
"""
                        else:
                            enhanced_prompt = request.message
                        
                        # Create a new event loop for this thread
                        import asyncio
                        try:
                            loop = asyncio.get_event_loop()
                        except RuntimeError:
                            loop = asyncio.new_event_loop()
                            asyncio.set_event_loop(loop)
                        
                        final_response = loop.run_until_complete(llm_call_stream(
                            enhanced_prompt, 
                            sync_callback, 
                            request.model, 
                            request.use_agent,
                            provider_name,
                            temperature=request.temperature or 0.7,
                            max_tokens=request.max_tokens or 4096
                        ))
                        chunks_queue.append("__DONE__")
                        done_event.set()
                        return final_response
                    except Exception as e:
                        error_container['error'] = str(e)
                        chunks_queue.append(f"__ERROR__:{str(e)}")
                        done_event.set()
                        return ""
                
                # Start the LLM in a background thread
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    llm_future = executor.submit(run_llm_sync)
                    
                    # Send provider info first
                    yield f"data: {json.dumps({'provider': provider_info.get('name', 'unknown'), 'model': request.model or provider_info.get('default_model', 'unknown')})}\n\n"
                    
                    # Stream chunks as they arrive
                    while not done_event.is_set() or chunks_queue:
                        if chunks_queue:
                            chunk = chunks_queue.popleft()
                            if chunk == "__DONE__":
                                break
                            elif chunk.startswith("__ERROR__"):
                                error_msg = chunk[9:]  # Remove "__ERROR__:" prefix
                                yield f"data: {json.dumps({'error': error_msg})}\n\n"
                                break
                            else:
                                # Send streaming chunk
                                yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\n\n"
                        else:
                            # Small delay to avoid busy waiting and send keepalive
                            await asyncio.sleep(0.1)
                            if not done_event.is_set():
                                yield f"data: {json.dumps({'keepalive': True})}\n\n"
                    
                    # Wait for LLM completion
                    final_response = llm_future.result()
                    
                    # Run evaluation for all responses (agent and non-agent) if we have a complete response
                    if final_response and not error_container['error']:
                        try:
                            evaluation_result = await evaluator.evaluate_chat_response(
                                question=request.message,
                                response=final_response,
                                model_used=request.model or provider_info.get("default_model", "unknown"),
                                agent_used=request.use_agent,
                                watershed_context=request.context,
                                response_provider=provider_info.get("name", "unknown")  # Use actual provider used
                            )
                            
                            # Send evaluation results
                            evaluation_data = {
                                'evaluation': {
                                    'id': evaluation_result.id,
                                    'overall_score': evaluation_result.metrics.overall,
                                    'confidence': evaluation_result.metrics.confidence,
                                    'safety_score': evaluation_result.metrics.safety,
                                    'helpfulness': evaluation_result.metrics.helpfulness,
                                    'accuracy': evaluation_result.metrics.accuracy,
                                    'reasoning': evaluation_result.judge_reasoning
                                }
                            }
                            yield f"data: {json.dumps(evaluation_data)}\n\n"
                            
                        except Exception as eval_error:
                            log.warning(f"Evaluation failed: {str(eval_error)}")
                            # Don't fail the entire response if evaluation fails
                    
                    yield f"data: {json.dumps({'done': True, 'provider_used': provider_info.get('name', 'unknown')})}\n\n"
                
            except Exception as e:
                log.error(f"Enhanced stream generation error: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(
            generate_enhanced_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream",
            }
        )
        
    except Exception as e:
        log.error(f"Failed to process enhanced streaming AI chat: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process enhanced streaming chat message")


# =============================================================================
# Evaluation API Endpoints  
# =============================================================================

@app.post(_api("evaluation/evaluate"))
async def evaluate_response(request: Dict[str, Any]):
    """Evaluate a chat response using NVIDIA-style LLM-as-Judge"""
    try:
        question = request.get("question", "")
        response = request.get("response", "")
        model_used = request.get("model", "unknown")
        agent_used = request.get("agent_used", False)
        watershed_context = request.get("watershed_context")
        
        if not question or not response:
            raise HTTPException(status_code=400, detail="Question and response are required")
        
        # Run evaluation with cross-provider judging
        response_provider = request.get("response_provider")  # Allow manual specification
        evaluation_result = await evaluator.evaluate_chat_response(
            question=question,
            response=response,
            model_used=model_used,
            agent_used=agent_used,
            watershed_context=watershed_context,
            response_provider=response_provider
        )
        
        return {
            "evaluation_id": evaluation_result.id,
            "metrics": evaluation_result.metrics.dict(),
            "reasoning": evaluation_result.judge_reasoning,
            "duration_ms": evaluation_result.evaluation_duration_ms,
            "timestamp": evaluation_result.timestamp.isoformat()
        }
        
    except Exception as e:
        log.error(f"Failed to evaluate response: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to evaluate response")


@app.get(_api("evaluation/stats"))
async def get_evaluation_stats(hours: int = 24):
    """Get evaluation statistics for the last N hours"""
    try:
        stats = evaluator.get_evaluation_stats(hours=hours)
        return stats
        
    except Exception as e:
        log.error(f"Failed to get evaluation stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get evaluation statistics")


@app.get(_api("evaluation/history"))
async def get_evaluation_history(limit: int = 50):
    """Get recent evaluation history"""
    try:
        # Get recent evaluations from memory (limited to last 100)
        recent_evaluations = evaluator.evaluation_history[-limit:]
        
        return {
            "evaluations": [
                {
                    "id": eval_result.id,
                    "timestamp": eval_result.timestamp.isoformat(),
                    "question": eval_result.question[:100] + "..." if len(eval_result.question) > 100 else eval_result.question,
                    "model": eval_result.model_used,
                    "agent_used": eval_result.agent_used,
                    "overall_score": eval_result.metrics.overall,
                    "confidence": eval_result.metrics.confidence,
                    "safety_score": eval_result.metrics.safety
                }
                for eval_result in reversed(recent_evaluations)
            ]
        }
        
    except Exception as e:
        log.error(f"Failed to get evaluation history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get evaluation history")


# =============================================================================
# AI Agents API Endpoints
# =============================================================================

@app.get(_api("agents"))
async def get_agents_status():
    """Get status of all AI agents"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        agent_status = await _agent_manager.get_agent_status()
        return {
            "agents": agent_status,
            "manager_initialized": _agent_manager.is_initialized,
            "last_update": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        log.error(f"Failed to get agents status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get agents status")

@app.get(_api("agents/insights"))
async def get_agents_insights():
    """Get insights from all AI agents"""
    if not _agent_manager:
        return {
            "error": "AI agents are disabled",
            "insights": {},
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    
    try:
        insights = await _agent_manager.get_all_insights()
        return {
            "insights": insights,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        log.error(f"Failed to get agents insights: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to get agents insights: {str(e)}")

@app.get(_api("agents/alerts"))
async def get_agents_alerts():
    """Get alerts from all AI agents"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        alerts = await _agent_manager.get_all_alerts()
        return {
            "alerts": alerts,
            "generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        log.error(f"Failed to get agents alerts: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get agents alerts")

@app.get(_api("agents/summary"))
async def get_agents_summary():
    """Get summary of all agent activities for dashboard"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        summary = await _agent_manager.get_dashboard_summary()
        return summary
    except Exception as e:
        log.error(f"Failed to get agents summary: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get agents summary")

@app.get(_api("agents/{agent_name}"))
async def get_agent_details(agent_name: str):
    """Get detailed information about a specific agent"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        details = await _agent_manager.get_agent_details(agent_name)
        return details
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Failed to get agent details for {agent_name}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get agent details")

@app.post(_api("agents/{agent_name}/check"))
async def force_agent_check(agent_name: str, user_id: UserID):
    """Force an immediate check for a specific agent"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        result = await _agent_manager.force_agent_check(agent_name)
        return {
            "status": "success",
            "message": f"Force check completed for agent: {agent_name}",
            "result": result
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.error(f"Failed to force check for agent {agent_name}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to force agent check")

@app.post(_api("agents/start"))
async def start_all_agents(user_id: UserID):
    """Start all AI agents"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        await _agent_manager.start_all_agents()
        return {
            "status": "success",
            "message": "All agents started successfully"
        }
    except Exception as e:
        log.error(f"Failed to start agents: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to start agents")

@app.post(_api("agents/stop"))
async def stop_all_agents(user_id: UserID):
    """Stop all AI agents"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        await _agent_manager.stop_all_agents()
        return {
            "status": "success",
            "message": "All agents stopped successfully"
        }
    except Exception as e:
        log.error(f"Failed to stop agents: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to stop agents")

@app.post(_api("agents/collect-data"))
async def collect_external_data(user_id: UserID):
    """Trigger data collection from external APIs"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        data = await _agent_manager.collect_external_data()
        return {
            "status": "success",
            "message": "External data collection completed",
            "data": data
        }
    except Exception as e:
        log.error(f"Failed to collect external data: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to collect external data")

@app.post(_api("agents/forecast"))
async def generate_ai_forecast(hours_ahead: int = 24):
    """Generate AI-powered flood forecast"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        forecast = await _agent_manager.generate_forecast(hours_ahead)
        return {
            "status": "success",
            "forecast": forecast
        }
    except Exception as e:
        log.error(f"Failed to generate forecast: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate forecast")

class EmergencyAlertRequest(BaseModel):
    """Emergency alert request model"""
    title: str
    message: str
    severity: str = "warning"  # info, warning, critical
    affected_areas: List[str] = []
    recommendations: List[str] = []
    channels: List[str] = ["EAS", "Cell", "Social"]

@app.post(_api("agents/emergency-alert"))
async def send_emergency_alert(user_id: UserID, request: EmergencyAlertRequest):
    """Send emergency alert through AI agents"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        alert_data = {
            "title": request.title,
            "message": request.message,
            "severity": request.severity,
            "affected_areas": request.affected_areas,
            "recommendations": request.recommendations,
            "channels": request.channels
        }
        
        success = await _agent_manager.send_emergency_alert(alert_data)
        
        if success:
            return {
                "status": "success",
                "message": "Emergency alert sent successfully"
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to send emergency alert")
    
    except Exception as e:
        log.error(f"Failed to send emergency alert: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send emergency alert")

@app.get(_api("agents/available"))
async def get_available_agents():
    """Get list of available agents"""
    if not _agent_manager:
        raise HTTPException(status_code=503, detail="AI agents are disabled")
    
    try:
        agents = _agent_manager.get_available_agents()
        return {
            "agents": agents,
            "total_count": len(agents)
        }
    except Exception as e:
        log.error(f"Failed to get available agents: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get available agents")

# =============================================================================
# Health Check
# =============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check Redis connection
        _redis.ping()
        
        # Check agents status if enabled
        agents_status = "disabled"
        if _agent_manager:
            try:
                agent_summary = await _agent_manager.get_dashboard_summary()
                agents_status = f"{agent_summary['running_agents']}/{agent_summary['total_agents']} running"
            except:
                agents_status = "error"
        
        return {
            "status": "healthy", 
            "redis": "connected",
            "agents": agents_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy", 
            "redis": f"error: {str(e)}",
            "agents": "unknown",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


@app.get("/")
async def serve_index():
    """Serve the main index.html file"""
    return FileResponse(server_dir / "index.html")

@app.get("/{path:path}")
async def serve_static(path: str):
    """Serve static files, but exclude API routes"""
    # Don't serve static files for API routes
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    f = server_dir / path
    return FileResponse(f if f.is_file() else server_dir / "index.html")

# =============================================================================
# Error Handlers
# =============================================================================

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return {"error": "Not found", "detail": exc.detail}


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    return {"error": "Internal server error", "detail": str(exc)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)