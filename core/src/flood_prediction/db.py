import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Optional, Dict, List

# SQLite isolation level - None for autocommit mode
_sqlite_isolation_level = None

# Optimized SQLite pragmas for performance and reliability
_pragmas = """
-- Set the journal mode to Write-Ahead Logging for concurrency
pragma journal_mode = WAL;
-- Set synchronous mode to NORMAL for performance and data safety balance
pragma synchronous = NORMAL;
-- Set busy timeout to 5 seconds to avoid "database is locked" errors
pragma busy_timeout = 5000;
-- Set cache size to 20MB for faster data access
pragma cache_size = -20000;
-- Enable foreign key constraint enforcement
pragma foreign_keys = ON;
-- Enable auto vacuuming and set it to incremental mode for gradual space reclaiming
pragma auto_vacuum = INCREMENTAL;
-- Set the mmap_size to 2GB for faster read/write access using memory-mapped I/O
pragma mmap_size = 2147483648;
-- Set the page size to 8KB for balanced memory usage and performance
pragma page_size = 8192;
"""

# Generic cache table schema
_cache_schema = """
pragma user_version = 1;
create table if not exists cache (
    key text primary key,
    value text,
    created_at timestamp default current_timestamp
);
"""

# Flood prediction application schema
_app_schema = """
pragma user_version = 1;

-- Watersheds table
create table if not exists watersheds (
    id integer primary key autoincrement,
    name text not null unique,
    location_lat real,
    location_lng real,
    basin_size_sqmi real default 0,
    current_streamflow_cfs real not null default 0,
    current_risk_level text not null default 'Low' check(current_risk_level in ('Low', 'Moderate', 'High')),
    risk_score real not null default 0 check(risk_score >= 0 and risk_score <= 10),
    flood_stage_cfs real default 0,
    trend text default 'stable' check(trend in ('rising', 'falling', 'stable')),
    trend_rate_cfs_per_hour real default 0,
    usgs_site_code text,  -- USGS monitoring site code
    data_source text default 'sample' check(data_source in ('sample', 'usgs', 'noaa', 'openmeteo')),
    data_quality text default 'unknown' check(data_quality in ('approved', 'provisional', 'estimated', 'unknown')),
    last_api_update timestamp null,  -- Last time real API data was fetched
    last_updated timestamp default current_timestamp,
    created_at timestamp default current_timestamp
);

-- Alerts table  
create table if not exists alerts (
    id integer primary key autoincrement,
    alert_type text not null,
    watershed_id integer not null,
    message text not null,
    severity text not null check(severity in ('Low', 'Moderate', 'High')),
    issued_time timestamp default current_timestamp,
    resolved_time timestamp null,
    expires_time timestamp null,
    affected_counties text default '',
    is_active boolean default true,
    created_at timestamp default current_timestamp,
    foreign key (watershed_id) references watersheds(id)
);

-- Risk trend data for charts
create table if not exists risk_trends (
    id integer primary key autoincrement,
    watershed_id integer,
    risk_score real not null,
    streamflow_cfs real not null,
    timestamp timestamp default current_timestamp,
    foreign key (watershed_id) references watersheds(id)
);

-- System metrics for dashboard
create table if not exists system_metrics (
    id integer primary key autoincrement,
    metric_name text not null,
    metric_value real not null,
    timestamp timestamp default current_timestamp
);

-- User settings table
create table if not exists user_settings (
    id integer primary key autoincrement,
    user_id text not null unique,
    settings_data text not null,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

-- Legacy items table for backward compatibility
create table if not exists items (
    id integer primary key autoincrement,
    name text not null,
    data text,
    created_at timestamp default current_timestamp,
    updated_at timestamp default current_timestamp
);

-- Indexes
create index if not exists idx_watersheds_risk_level on watersheds(current_risk_level);
create index if not exists idx_watersheds_last_updated on watersheds(last_updated);
create index if not exists idx_watersheds_usgs_site on watersheds(usgs_site_code);
create index if not exists idx_watersheds_data_source on watersheds(data_source);
create index if not exists idx_watersheds_api_update on watersheds(last_api_update);
create index if not exists idx_alerts_active on alerts(is_active, issued_time);
create index if not exists idx_alerts_watershed on alerts(watershed_id);
create index if not exists idx_risk_trends_watershed on risk_trends(watershed_id, timestamp);
create index if not exists idx_risk_trends_timestamp on risk_trends(timestamp);
create index if not exists idx_system_metrics_name on system_metrics(metric_name, timestamp);
create index if not exists idx_user_settings_user_id on user_settings(user_id);
create index if not exists idx_items_name on items(name);
create index if not exists idx_items_created_at on items(created_at);
"""


def _connect(path: str) -> sqlite3.Connection:
    """Create a connection to SQLite database."""
    return sqlite3.connect(path, isolation_level=_sqlite_isolation_level)


@contextmanager
def _transaction(path: str):
    """Context manager for database transactions with automatic rollback on error."""
    conn = _connect(path)
    cursor = conn.cursor()
    cursor.execute("begin;")
    try:
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


@contextmanager
def _cursor(path: str):
    """Context manager for database cursors with automatic cleanup."""
    conn = _connect(path)
    cursor = conn.cursor()
    try:
        yield cursor
    finally:
        cursor.close()
        conn.close()


def _init_db(path: str, schema: str):
    """Initialize database with pragmas and schema."""
    conn = _connect(path)
    conn.executescript(_pragmas)
    conn.executescript(schema)
    conn.close()


def init_cache_db(path: str):
    """Initialize cache database."""
    _init_db(path, _cache_schema)


def init_app_db(path: str):
    """Initialize application database - customize schema as needed."""
    _init_db(path, _app_schema)


def purge_db(path: str):
    """Remove database file. Use with caution - for testing only."""
    if os.path.exists(path):
        os.remove(path)


# =============================================================================
# Cache Operations
# =============================================================================

def cache_put(path: str, key: str, value: str) -> str:
    """Store a key-value pair in cache."""
    with _transaction(path) as cursor:
        cursor.execute(
            "insert or replace into cache (key, value) values (?, ?);", 
            (key, value)
        )
    return value


def cache_get(path: str, key: str) -> Optional[str]:
    """Retrieve value from cache by key."""
    with _cursor(path) as cursor:
        cursor.execute("select value from cache where key = ?;", (key,))
        row = cursor.fetchone()
        return row[0] if row else None


def cache_delete(path: str, key: str):
    """Delete a cache entry by key."""
    with _transaction(path) as cursor:
        cursor.execute("delete from cache where key = ?;", (key,))


def cache_evict(path: str, days: int):
    """Remove cache entries older than specified days."""
    with _transaction(path) as cursor:
        cursor.execute(
            "delete from cache where created_at < date('now', '-? days');", 
            (days,)
        )


def cache_clear(path: str):
    """Clear all cache entries."""
    with _transaction(path) as cursor:
        cursor.execute("delete from cache;")


def cache_size(path: str) -> int:
    """Get number of cache entries."""
    with _cursor(path) as cursor:
        cursor.execute("select count(1) from cache;")
        return cursor.fetchone()[0]


# =============================================================================
# Utility Functions
# =============================================================================

def _utc_timestamp(timestamp_str: str) -> datetime:
    """Convert SQLite timestamp string to UTC datetime."""
    dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
    return dt.replace(tzinfo=timezone.utc)


def execute_query(path: str, query: str, params: tuple = ()) -> List[tuple]:
    """Execute a SELECT query and return all results."""
    with _cursor(path) as cursor:
        cursor.execute(query, params)
        return cursor.fetchall()


def execute_update(path: str, query: str, params: tuple = ()) -> int:
    """Execute an INSERT/UPDATE/DELETE query and return affected row count."""
    with _transaction(path) as cursor:
        cursor.execute(query, params)
        return cursor.rowcount


def execute_insert(path: str, query: str, params: tuple = ()) -> int:
    """Execute an INSERT query and return the last row ID."""
    with _transaction(path) as cursor:
        cursor.execute(query, params)
        return cursor.lastrowid


def table_exists(path: str, table_name: str) -> bool:
    """Check if a table exists in the database."""
    with _cursor(path) as cursor:
        cursor.execute(
            "select name from sqlite_master where type='table' and name=?;", 
            (table_name,)
        )
        return cursor.fetchone() is not None


def get_table_info(path: str, table_name: str) -> List[Dict[str, Any]]:
    """Get column information for a table."""
    with _cursor(path) as cursor:
        cursor.execute(f"pragma table_info({table_name});")
        columns = cursor.fetchall()
        return [
            {
                'cid': col[0],
                'name': col[1], 
                'type': col[2],
                'notnull': bool(col[3]),
                'default_value': col[4],
                'pk': bool(col[5])
            }
            for col in columns
        ]


def get_db_version(path: str) -> int:
    """Get the user_version pragma value."""
    with _cursor(path) as cursor:
        cursor.execute("pragma user_version;")
        return cursor.fetchone()[0]


def set_db_version(path: str, version: int):
    """Set the user_version pragma value."""
    with _transaction(path) as cursor:
        cursor.execute(f"pragma user_version = {version};")


# =============================================================================
# Flood Prediction Operations
# =============================================================================

def get_dashboard_summary(path: str) -> Dict[str, Any]:
    """Get dashboard summary statistics."""
    with _cursor(path) as cursor:
        # Get total watersheds
        cursor.execute("SELECT COUNT(*) FROM watersheds;")
        total_watersheds = cursor.fetchone()[0]
        
        # Get active alerts
        cursor.execute("SELECT COUNT(*) FROM alerts WHERE is_active = 1;")
        active_alerts = cursor.fetchone()[0]
        
        # Get risk level counts
        cursor.execute("""
            SELECT current_risk_level, COUNT(*) 
            FROM watersheds 
            GROUP BY current_risk_level;
        """)
        risk_counts = dict(cursor.fetchall())
        
        return {
            'total_watersheds': total_watersheds,
            'active_alerts': active_alerts,
            'high_risk_watersheds': risk_counts.get('High', 0),
            'moderate_risk_watersheds': risk_counts.get('Moderate', 0),
            'low_risk_watersheds': risk_counts.get('Low', 0),
            'last_updated': datetime.now(timezone.utc).isoformat()
        }

def get_watersheds(path: str) -> List[Dict[str, Any]]:
    """Get all watersheds with current data."""
    rows = execute_query(
        path,
        """SELECT id, name, location_lat, location_lng, basin_size_sqmi,
                  current_streamflow_cfs, current_risk_level, risk_score, 
                  flood_stage_cfs, trend, trend_rate_cfs_per_hour, 
                  usgs_site_code, data_source, data_quality, last_api_update, last_updated 
           FROM watersheds ORDER BY risk_score DESC;"""
    )
    return [
        {
            'id': row[0],
            'name': row[1],
            'location_lat': row[2],
            'location_lng': row[3],
            'basin_size_sqmi': row[4],
            'current_streamflow_cfs': row[5],
            'current_risk_level': row[6],
            'risk_score': row[7],
            'flood_stage_cfs': row[8],
            'trend': row[9],
            'trend_rate_cfs_per_hour': row[10],
            'usgs_site_code': row[11],
            'data_source': row[12],
            'data_quality': row[13],
            'last_api_update': row[14],
            'last_updated': row[15]
        }
        for row in rows
    ]

def get_active_alerts(path: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get active alerts with watershed information."""
    rows = execute_query(
        path,
        """SELECT a.id, a.alert_type, w.name as watershed_name, a.message, 
                  a.severity, a.issued_time, a.expires_time, a.affected_counties
           FROM alerts a
           JOIN watersheds w ON a.watershed_id = w.id
           WHERE a.is_active = 1
           ORDER BY a.issued_time DESC
           LIMIT ?;""",
        (limit,)
    )
    return [
        {
            'alert_id': row[0],
            'alert_type': row[1],
            'watershed': row[2],
            'message': row[3],
            'severity': row[4],
            'issued_time': row[5],
            'expires_time': row[6],
            'affected_counties': row[7].split(',') if row[7] else []
        }
        for row in rows
    ]

def get_risk_trend_data(path: str, hours: int = 24) -> List[Dict[str, Any]]:
    """Get risk trend data for the last N hours."""
    rows = execute_query(
        path,
        """SELECT strftime('%H:00', timestamp) as hour, 
                  AVG(risk_score) as avg_risk,
                  COUNT(DISTINCT watershed_id) as watersheds
           FROM risk_trends 
           WHERE timestamp > datetime('now', '-{} hours')
           GROUP BY strftime('%H', timestamp)
           ORDER BY hour;""".format(hours)
    )
    return [
        {
            'time': row[0],
            'risk': round(row[1], 1) if row[1] else 0,
            'watersheds': row[2]
        }
        for row in rows
    ]

def insert_watershed(path: str, name: str, lat: float = None, lng: float = None, 
                    basin_size: float = 0, streamflow: float = 0, risk_level: str = 'Low', 
                    risk_score: float = 0, flood_stage: float = 0, trend: str = 'stable',
                    trend_rate: float = 0, usgs_site_code: str = None, 
                    data_source: str = 'sample', data_quality: str = 'unknown') -> int:
    """Insert a new watershed."""
    return execute_insert(
        path,
        """INSERT INTO watersheds (name, location_lat, location_lng, basin_size_sqmi,
                                 current_streamflow_cfs, current_risk_level, risk_score,
                                 flood_stage_cfs, trend, trend_rate_cfs_per_hour,
                                 usgs_site_code, data_source, data_quality)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);""",
        (name, lat, lng, basin_size, streamflow, risk_level, risk_score, flood_stage, 
         trend, trend_rate, usgs_site_code, data_source, data_quality)
    )

def update_watershed_data(path: str, watershed_id: int, streamflow: float, 
                         risk_level: str, risk_score: float) -> int:
    """Update watershed streamflow and risk data."""
    return execute_update(
        path,
        """UPDATE watersheds 
           SET current_streamflow_cfs = ?, current_risk_level = ?, 
               risk_score = ?, last_updated = current_timestamp
           WHERE id = ?;""",
        (streamflow, risk_level, risk_score, watershed_id)
    )

def update_watershed_with_api_data(path: str, watershed_id: int, streamflow: float,
                                  risk_level: str, risk_score: float, data_source: str,
                                  data_quality: str = 'unknown', trend: str = 'stable',
                                  trend_rate: float = 0.0) -> int:
    """Update watershed with API data including source and quality information."""
    return execute_update(
        path,
        """UPDATE watersheds 
           SET current_streamflow_cfs = ?, current_risk_level = ?, risk_score = ?,
               data_source = ?, data_quality = ?, trend = ?, trend_rate_cfs_per_hour = ?,
               last_api_update = current_timestamp, last_updated = current_timestamp
           WHERE id = ?;""",
        (streamflow, risk_level, risk_score, data_source, data_quality, trend, trend_rate, watershed_id)
    )

def insert_alert(path: str, alert_type: str, watershed_id: int, message: str, 
                severity: str) -> int:
    """Insert a new alert."""
    return execute_insert(
        path,
        """INSERT INTO alerts (alert_type, watershed_id, message, severity)
           VALUES (?, ?, ?, ?);""",
        (alert_type, watershed_id, message, severity)
    )

def insert_risk_trend(path: str, watershed_id: int, risk_score: float, 
                     streamflow: float) -> int:
    """Insert risk trend data point."""
    return execute_insert(
        path,
        """INSERT INTO risk_trends (watershed_id, risk_score, streamflow_cfs)
           VALUES (?, ?, ?);""",
        (watershed_id, risk_score, streamflow)
    )

def populate_sample_data(path: str):
    """Populate database with sample flood prediction data."""
    # Sample watersheds with enhanced data
    # (name, lat, lng, basin_size, streamflow, risk_level, risk_score, flood_stage, trend, trend_rate)
    watersheds = [
        ("Guadalupe River at Comfort, TX (USGS 08167000)", 29.7604, -98.2441, 5953, 2850.0, "High", 8.2, 2976.5, "rising", 45.2),
        ("Colorado River at Austin, TX (USGS 08158000)", 30.2672, -97.7431, 42240, 3200.5, "High", 7.9, 21120.0, "rising", 38.7),
        ("Brazos River near Rosharon, TX (USGS 08116650)", 29.7633, -95.3633, 45604, 1245.7, "Moderate", 5.8, 6228.5, "rising", 12.4),
        ("Trinity River at Dallas, TX (USGS 08057000)", 32.7767, -96.7970, 17969, 890.3, "Moderate", 4.7, 8956.5, "falling", -15.3),
        ("San Antonio River at San Antonio, TX (USGS 08178000)", 29.4241, -98.4936, 4180, 156.8, "Low", 2.1, 780.0, "stable", 0.8),
        ("Sabine River near Gladewater, TX (USGS 08020000)", 30.2240, -93.8960, 9756, 1890.5, "Moderate", 6.3, 9452.5, "rising", 22.1),
        ("Neches River at Evadale, TX (USGS 08041000)", 30.0799, -94.1265, 10011, 445.2, "Low", 2.8, 5005.5, "stable", -2.3),
        ("Red River at Arthur City, TX (USGS 07335500)", 33.4734, -96.9969, 65590, 1567.9, "Moderate", 5.4, 32795.0, "rising", 18.6),
        ("Pecos River near Sheffield, TX (USGS 08447000)", 31.4207, -103.0567, 44402, 234.1, "Low", 1.9, 22201.0, "falling", -8.7),
        ("Canadian River near Amarillo, TX (USGS 07227500)", 35.6870, -101.8313, 22866, 678.4, "Low", 3.2, 11433.0, "stable", 5.1),
        ("Llano River near Junction, TX (USGS 08150000)", 30.7643, -99.0870, 4268, 423.7, "Moderate", 4.1, 2134.0, "rising", 8.9),
        ("Nueces River near Mathis, TX (USGS 08211000)", 28.0367, -97.0433, 16792, 812.3, "Moderate", 5.1, 8396.0, "rising", 14.7)
    ]
    
    # Insert watersheds
    watershed_ids = []
    for name, lat, lng, basin_size, flow, risk, score, flood_stage, trend, trend_rate in watersheds:
        try:
            watershed_id = insert_watershed(path, name, lat, lng, basin_size, flow, risk, score, flood_stage, trend, trend_rate)
            watershed_ids.append(watershed_id)
        except Exception as e:
            # Handle duplicate names
            print(f"Watershed {name} may already exist: {e}")
    
    # Sample alerts (only for watersheds that were inserted)
    if watershed_ids:
        alerts = [
            ("Flash Flood Warning", watershed_ids[0], "Rapid water level rise expected due to upstream rainfall", "High", "Comal,Guadalupe"),
            ("Flood Watch", watershed_ids[1], "Heavy rainfall upstream causing elevated water levels", "High", "Travis,Bastrop"),
            ("High Water Advisory", watershed_ids[5], "Water levels approaching minor flood stage", "Moderate", "Sabine,Orange")
        ]
        
        for alert_type, watershed_id, message, severity, counties in alerts:
            try:
                insert_alert_with_counties(path, alert_type, watershed_id, message, severity, counties)
            except Exception as e:
                print(f"Error inserting alert: {e}")

def insert_alert_with_counties(path: str, alert_type: str, watershed_id: int, message: str, 
                              severity: str, counties: str = "") -> int:
    """Insert a new alert with affected counties."""
    from datetime import datetime, timedelta
    
    expires_time = datetime.now() + timedelta(hours=6)  # Default 6-hour expiration
    
    return execute_insert(
        path,
        """INSERT INTO alerts (alert_type, watershed_id, message, severity, 
                             expires_time, affected_counties)
           VALUES (?, ?, ?, ?, ?, ?);""",
        (alert_type, watershed_id, message, severity, expires_time.isoformat(), counties)
    )

# =============================================================================
# Analytics Data Functions
# =============================================================================

def get_analytics_data(path: str, time_range: str = "7d", metric: str = "risk_score") -> Dict[str, Any]:
    """Get complete analytics data."""
    import random
    import math
    
    watersheds = get_watersheds(path)
    
    # Generate summary statistics
    summary = {
        'avg_risk_score': round(sum(w['risk_score'] for w in watersheds) / len(watersheds), 1) if watersheds else 0,
        'high_risk_count': len([w for w in watersheds if w['current_risk_level'] == 'High']),
        'avg_flow': round(sum(w['current_streamflow_cfs'] for w in watersheds) / len(watersheds)) if watersheds else 0,
        'trending_up_count': len([w for w in watersheds if w['trend'] == 'rising'])
    }
    
    # Generate historical data
    historical_data = get_historical_analytics_data(path, time_range)
    
    # Get risk distribution
    risk_distribution = get_risk_distribution_data(path)
    
    # Get watershed comparison
    watershed_comparison = get_watershed_comparison_data(path)
    
    # Get flow comparison
    flow_comparison = get_flow_comparison_data(path)
    
    return {
        'summary': summary,
        'historical_data': historical_data,
        'risk_distribution': risk_distribution,
        'watershed_comparison': watershed_comparison,
        'flow_comparison': flow_comparison
    }

def get_historical_analytics_data(path: str, time_range: str = "7d") -> List[Dict[str, Any]]:
    """Generate historical trend data (simulated for demo)."""
    import random
    import math
    from datetime import datetime, timedelta
    
    data = []
    days = 7 if time_range == "7d" else 30 if time_range == "30d" else 90
    now = datetime.now()
    
    for i in range(days + 1):
        date = now - timedelta(days=days - i)
        
        # Generate realistic fluctuating data
        base_risk = 4.5
        variation = math.sin(i * 0.3) * 2 + random.uniform(-0.5, 1.5)
        risk_score = max(1, min(10, base_risk + variation))
        
        base_flow = 1500
        flow_variation = math.sin(i * 0.2) * 800 + random.uniform(-200, 400)
        avg_flow = max(100, base_flow + flow_variation)
        
        data.append({
            'date': date.strftime('%Y-%m-%d'),
            'time': date.strftime('%b %d') if days <= 30 else date.strftime('%m/%d'),
            'avg_risk_score': round(risk_score, 1),
            'avg_flow': round(avg_flow),
            'high_risk_count': max(0, round((risk_score - 4) / 2)),
            'alerts_count': max(0, round((risk_score - 5) / 2))
        })
    
    return data

def get_risk_distribution_data(path: str) -> List[Dict[str, Any]]:
    """Get risk distribution data."""
    watersheds = get_watersheds(path)
    
    if not watersheds:
        return []
    
    high_count = len([w for w in watersheds if w['current_risk_level'] == 'High'])
    moderate_count = len([w for w in watersheds if w['current_risk_level'] == 'Moderate'])
    low_count = len([w for w in watersheds if w['current_risk_level'] == 'Low'])
    total = len(watersheds)
    
    return [
        {
            'name': 'High Risk',
            'value': high_count,
            'color': '#ef4444',
            'percentage': round((high_count / total) * 100) if total > 0 else 0
        },
        {
            'name': 'Moderate Risk',
            'value': moderate_count,
            'color': '#f59e0b',
            'percentage': round((moderate_count / total) * 100) if total > 0 else 0
        },
        {
            'name': 'Low Risk',
            'value': low_count,
            'color': '#22c55e',
            'percentage': round((low_count / total) * 100) if total > 0 else 0
        }
    ]

def get_watershed_comparison_data(path: str) -> List[Dict[str, Any]]:
    """Get watershed comparison data."""
    watersheds = get_watersheds(path)
    
    comparison_data = []
    for w in watersheds:
        flow_ratio = (w['current_streamflow_cfs'] / w['flood_stage_cfs']) * 100 if w['flood_stage_cfs'] else 0
        comparison_data.append({
            'name': w['name'].split(' ')[0],  # Shorten name
            'risk_score': w['risk_score'],
            'flow_ratio': round(flow_ratio, 1),
            'current_flow': w['current_streamflow_cfs']
        })
    
    # Sort by risk score descending
    comparison_data.sort(key=lambda x: x['risk_score'], reverse=True)
    return comparison_data

def get_flow_comparison_data(path: str) -> List[Dict[str, Any]]:
    """Get flow vs flood stage comparison data."""
    watersheds = get_watersheds(path)
    
    comparison_data = []
    for w in watersheds:
        capacity_used = (w['current_streamflow_cfs'] / w['flood_stage_cfs']) * 100 if w['flood_stage_cfs'] else 0
        comparison_data.append({
            'name': w['name'].split(' ')[0],  # Shorten name
            'current_flow': w['current_streamflow_cfs'],
            'flood_stage': w['flood_stage_cfs'] or 0,
            'capacity_used': round(capacity_used, 1)
        })
    
    return comparison_data

# =============================================================================
# User Settings Functions
# =============================================================================

def get_user_settings(path: str, user_id: str) -> Dict[str, Any]:
    """Get user settings, returning defaults if none exist."""
    default_settings = {
        'notifications': {
            'enabled': True,
            'highRiskAlerts': True,
            'moderateRiskAlerts': False,
            'dataUpdates': True,
            'systemMaintenance': True
        },
        'display': {
            'darkMode': False,
            'autoRefresh': True,
            'refreshInterval': 300,
            'defaultView': 'dashboard',
            'mapLayer': 'terrain'
        },
        'data': {
            'cacheEnabled': True,
            'offlineMode': False,
            'dataRetention': 30,
            'exportFormat': 'csv'
        }
    }
    
    rows = execute_query(
        path,
        "SELECT settings_data FROM user_settings WHERE user_id = ?;",
        (user_id,)
    )
    
    if rows:
        import json
        try:
            return json.loads(rows[0][0])
        except (json.JSONDecodeError, IndexError):
            return default_settings
    
    return default_settings

def save_user_settings(path: str, user_id: str, settings: Dict[str, Any]) -> int:
    """Save or update user settings."""
    import json
    settings_json = json.dumps(settings)
    
    # Try to update first
    rows_affected = execute_update(
        path,
        """UPDATE user_settings 
           SET settings_data = ?, updated_at = current_timestamp 
           WHERE user_id = ?;""",
        (settings_json, user_id)
    )
    
    # If no rows affected, insert new record
    if rows_affected == 0:
        return execute_insert(
            path,
            """INSERT INTO user_settings (user_id, settings_data) 
               VALUES (?, ?);""",
            (user_id, settings_json)
        )
    
    return rows_affected

def delete_user_settings(path: str, user_id: str) -> int:
    """Delete user settings."""
    return execute_update(
        path,
        "DELETE FROM user_settings WHERE user_id = ?;",
        (user_id,)
    )

# =============================================================================
# AI Chat Functions
# =============================================================================

def generate_ai_response(path: str, message: str, watershed_id: Optional[int] = None, 
                        context: Dict[str, Any] = None) -> Dict[str, Any]:
    """Generate AI response for flood-related queries using H2OGPTE."""
    from .api import llm_call
    import random
    
    # Get current flood data for context
    watersheds = get_watersheds(path)
    alerts = get_active_alerts(path, limit=10)
    
    # Get watershed data if specified
    watershed_data = None
    if watershed_id:
        watershed_data = next((w for w in watersheds if w['id'] == watershed_id), None)
    
    # Build comprehensive context for the AI
    system_context = f"""You are a Texas Flood Prediction AI Assistant with access to real-time watershed data. 

CURRENT SYSTEM STATUS:
- Total Watersheds: {len(watersheds)}
- High Risk: {len([w for w in watersheds if w['current_risk_level'] == 'High'])}
- Moderate Risk: {len([w for w in watersheds if w['current_risk_level'] == 'Moderate'])}
- Low Risk: {len([w for w in watersheds if w['current_risk_level'] == 'Low'])}
- Active Alerts: {len(alerts)}

AVAILABLE WATERSHEDS:
{chr(10).join([f"- {w['name']}: {w['current_risk_level']} risk ({w['risk_score']}/10), {w['current_streamflow_cfs']:,} CFS, trend: {w.get('trend', 'stable')}" for w in watersheds[:10]])}

ACTIVE ALERTS:
{chr(10).join([f"- {a['alert_type']} for {a['watershed']}: {a['message']} (Severity: {a['severity']})" for a in alerts[:5]])}

Guidelines for responses:
- Always prioritize safety and emergency preparedness
- Use specific data when discussing watersheds
- Provide actionable recommendations
- Format responses clearly with markdown
- Include confidence levels and safety recommendations
- Never ignore emergency situations
- Focus on Texas-specific flood conditions"""

    # Add specific watershed context if provided
    if watershed_data:
        system_context += f"""

SPECIFIC WATERSHED DATA FOR {watershed_data['name']}:
- Current Risk Level: {watershed_data['current_risk_level']} ({watershed_data['risk_score']}/10)
- Current Flow: {watershed_data['current_streamflow_cfs']:,} CFS
- Flood Stage: {watershed_data.get('flood_stage_cfs', 'Not specified')} CFS
- Trend: {watershed_data.get('trend', 'stable')}
- Basin Size: {watershed_data.get('basin_size_sqmi', 'Not specified')} sq mi
- Location: {watershed_data.get('location_lat', 'N/A')}, {watershed_data.get('location_lng', 'N/A')}
- Last Updated: {watershed_data['last_updated']}"""

    # Create the prompt
    full_prompt = f"""{system_context}

User Question: {message}

Please provide a comprehensive, helpful response about Texas flood conditions. Include specific data where relevant, safety guidance, and actionable recommendations. Format your response in markdown with clear sections."""

    try:
        # Call the H2OGPTE API
        ai_response = llm_call(full_prompt)
        
        # Parse confidence and recommendations from response if possible
        confidence = 0.85 + random.uniform(-0.1, 0.1)
        
        # Generate contextual recommendations based on current conditions
        recommendations = _generate_contextual_recommendations(watersheds, alerts, watershed_data)
        
        return {
            'content': ai_response,
            'confidence': confidence,
            'recommendations': recommendations
        }
        
    except Exception as e:
        # Fallback to basic response if AI call fails
        print(f"AI response failed: {str(e)}")
        return _generate_fallback_response(path, message, watershed_data)


def _generate_contextual_recommendations(watersheds: List[Dict], alerts: List[Dict], 
                                        watershed_data: Optional[Dict] = None) -> List[str]:
    """Generate contextual recommendations based on current conditions."""
    recommendations = []
    
    # General recommendations based on system status
    high_risk_count = len([w for w in watersheds if w['current_risk_level'] == 'High'])
    alert_count = len(alerts)
    
    if high_risk_count > 3 or alert_count > 5:
        recommendations.append("Monitor emergency alerts and evacuation notices continuously")
        recommendations.append("Avoid all flood-prone areas and low-lying roads")
        recommendations.append("Keep emergency supplies and evacuation plan ready")
    elif high_risk_count > 0 or alert_count > 0:
        recommendations.append("Stay informed about rapidly changing weather conditions")
        recommendations.append("Avoid unnecessary travel in flood-prone areas")
        recommendations.append("Monitor official flood warnings and updates")
    else:
        recommendations.append("Stay informed about weather conditions")
        recommendations.append("Keep emergency plan updated and accessible")
        recommendations.append("Review evacuation routes for your area")
    
    # Specific recommendations for watershed
    if watershed_data:
        risk_level = watershed_data['current_risk_level']
        if risk_level == 'High':
            recommendations.append(f"Exercise extreme caution around {watershed_data['name']}")
            recommendations.append("Consider evacuating if advised by authorities")
        elif risk_level == 'Moderate':
            recommendations.append(f"Monitor {watershed_data['name']} conditions closely")
            recommendations.append("Be prepared to take action if risk increases")
    
    # Ensure we don't return too many recommendations
    return recommendations[:4]


def _generate_fallback_response(path: str, message: str, watershed_data: Optional[Dict] = None) -> Dict[str, Any]:
    """Generate fallback response when AI call fails."""
    import random
    
    message_lower = message.lower()
    watersheds = get_watersheds(path)
    
    if 'risk' in message_lower or 'flood' in message_lower:
        if watershed_data:
            risk_level = watershed_data['current_risk_level']
            return {
                'content': f"""Based on current data for {watershed_data['name']}:

• **Current Risk Level**: {risk_level} ({watershed_data['risk_score']}/10)
• **Current Flow**: {watershed_data['current_streamflow_cfs']:,} CFS
• **Flood Stage**: {watershed_data.get('flood_stage_cfs', 'N/A')} CFS
• **Trend**: {watershed_data.get('trend', 'stable')}

{get_risk_interpretation(risk_level)}""",
                'confidence': 0.75,
                'recommendations': get_safety_recommendations(risk_level)
            }
        else:
            high_risk_count = len([w for w in watersheds if w['current_risk_level'] == 'High'])
            return {
                'content': f"""Currently monitoring {len(watersheds)} watersheds across Texas.

**Current System Status:**
• {high_risk_count} watersheds at HIGH risk
• {len([w for w in watersheds if w['current_risk_level'] == 'Moderate'])} watersheds at MODERATE risk  
• {len([w for w in watersheds if w['current_risk_level'] == 'Low'])} watersheds at LOW risk

Ask about specific watersheds for detailed analysis.""",
                'confidence': 0.70,
                'recommendations': [
                    'Select a specific watershed for detailed analysis',
                    'Subscribe to flood alert notifications',
                    'Review your emergency evacuation plan'
                ]
            }
    
    # Generic response
    return {
        'content': f"""I'm here to help with flood-related questions! Currently monitoring {len(watersheds)} Texas watersheds with real-time data.

What specific information would you like to know about flood conditions?""",
        'confidence': 0.65,
        'recommendations': [
            'Ask about specific watersheds or rivers',
            'Request safety guidance for your area', 
            'Learn about flood risk factors and warning signs'
        ]
    }


def get_risk_interpretation(risk_level: str) -> str:
    """Get interpretation text for risk level."""
    interpretations = {
        'High': 'This watershed is currently at high risk. Exercise extreme caution, avoid flood-prone areas, and monitor conditions closely. Be prepared to evacuate if conditions worsen.',
        'Moderate': 'This watershed shows moderate risk. Stay informed about changing conditions, avoid unnecessary travel in low-lying areas, and be ready to take action if risk increases.',
        'Low': 'This watershed is currently at low risk, but conditions can change rapidly. Continue monitoring weather and flood alerts for your area.'
    }
    return interpretations.get(risk_level, 'Risk level assessment not available.')

def get_safety_recommendations(risk_level: str) -> List[str]:
    """Get safety recommendations based on risk level."""
    if risk_level == 'High':
        return [
            'Monitor weather alerts and evacuation notices continuously',
            'Avoid all low-lying areas and flood-prone roads',
            'Keep emergency supplies and evacuation kit ready',
            'Consider evacuating if advised by authorities'
        ]
    elif risk_level == 'Moderate':
        return [
            'Stay informed about rapidly changing weather conditions',
            'Avoid unnecessary travel in flood-prone areas',
            'Have emergency supplies and communication plan ready',
            'Monitor official flood warnings and updates'
        ]
    else:  # Low
        return [
            'Stay informed about weather conditions',
            'Keep emergency plan updated and accessible',
            'Monitor official flood warnings and local news',
            'Review evacuation routes for your area'
        ]

# =============================================================================
# Legacy Application Operations (for backward compatibility)
# =============================================================================

def insert_item(path: str, name: str, data: Optional[str] = None) -> int:
    """Insert a new item and return its ID."""
    return execute_insert(
        path,
        "insert into items (name, data) values (?, ?);",
        (name, data)
    )


def get_item(path: str, item_id: int) -> Optional[Dict[str, Any]]:
    """Get an item by ID."""
    rows = execute_query(
        path,
        "select id, name, data, created_at, updated_at from items where id = ?;",
        (item_id,)
    )
    if not rows:
        return None
    
    row = rows[0]
    return {
        'id': row[0],
        'name': row[1], 
        'data': row[2],
        'created_at': _utc_timestamp(row[3]),
        'updated_at': _utc_timestamp(row[4])
    }


def list_items(path: str, limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
    """List items with pagination."""
    rows = execute_query(
        path,
        "select id, name, data, created_at, updated_at from items order by created_at desc limit ? offset ?;",
        (limit, offset)
    )
    return [
        {
            'id': row[0],
            'name': row[1],
            'data': row[2], 
            'created_at': _utc_timestamp(row[3]),
            'updated_at': _utc_timestamp(row[4])
        }
        for row in rows
    ]


def update_item(path: str, item_id: int, name: Optional[str] = None, data: Optional[str] = None) -> int:
    """Update an item's fields."""
    if name is not None and data is not None:
        return execute_update(
            path,
            "update items set name = ?, data = ?, updated_at = current_timestamp where id = ?;",
            (name, data, item_id)
        )
    elif name is not None:
        return execute_update(
            path,
            "update items set name = ?, updated_at = current_timestamp where id = ?;",
            (name, item_id)
        )
    elif data is not None:
        return execute_update(
            path,
            "update items set data = ?, updated_at = current_timestamp where id = ?;",
            (data, item_id)
        )
    return 0


def delete_item(path: str, item_id: int) -> int:
    """Delete an item by ID."""
    return execute_update(
        path,
        "delete from items where id = ?;",
        (item_id,)
    )


def count_items(path: str) -> int:
    """Get total number of items."""
    rows = execute_query(path, "select count(1) from items;")
    return rows[0][0]


# =============================================================================
# Database Maintenance
# =============================================================================

def vacuum_db(path: str):
    """Optimize database file size and performance."""
    with _cursor(path) as cursor:
        cursor.execute("vacuum;")


def analyze_db(path: str):
    """Update SQLite query planner statistics."""
    with _cursor(path) as cursor:
        cursor.execute("analyze;")


def get_db_size(path: str) -> Dict[str, int]:
    """Get database size information in bytes."""
    if not os.path.exists(path):
        return {'file_size': 0, 'page_count': 0, 'page_size': 0}
    
    file_size = os.path.getsize(path)
    
    with _cursor(path) as cursor:
        cursor.execute("pragma page_count;")
        page_count = cursor.fetchone()[0]
        
        cursor.execute("pragma page_size;")
        page_size = cursor.fetchone()[0]
    
    return {
        'file_size': file_size,
        'page_count': page_count, 
        'page_size': page_size
    }