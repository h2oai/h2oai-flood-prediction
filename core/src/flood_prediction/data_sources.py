"""
Data source integrations for flood prediction APIs.
Provides functions to fetch real-time data from USGS, NOAA, and other sources.
"""

import requests
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
import json
from . import db
from .settings import settings

log = logging.getLogger(__name__)


@dataclass
class StreamflowData:
    """Streamflow data from USGS API"""
    site_code: str
    site_name: str
    streamflow_cfs: float
    gage_height_ft: Optional[float]
    timestamp: datetime
    quality_code: str = "A"  # A=Approved, P=Provisional, etc.


@dataclass
class USGSSite:
    """USGS monitoring site information"""
    site_code: str
    site_name: str
    latitude: float
    longitude: float
    state: str
    county: str
    drainage_area_sqmi: Optional[float] = None


class USGSWaterServices:
    """Integration with USGS Water Services API for real-time streamflow data"""
    
    BASE_URL = "https://waterservices.usgs.gov/nwis"
    
    # USGS parameter codes
    STREAMFLOW_PARAM = "00060"  # Discharge, cubic feet per second
    GAGE_HEIGHT_PARAM = "00065"  # Gage height, feet
    
    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'FloodPredictionApp/1.0 (Python requests)'
        })
    
    def get_texas_sites(self, limit: int = 50) -> List[USGSSite]:
        """Get USGS monitoring sites in Texas"""
        url = f"{self.BASE_URL}/site/"
        
        params = {
            'format': 'json',
            'stateCd': 'TX',  # Texas
            'siteType': 'ST',  # Stream sites only
            'hasDataTypeCd': 'iv',  # Has instantaneous values
            'parameterCd': self.STREAMFLOW_PARAM,
            'siteStatus': 'active',
            'outputDataTypeCd': 'iv'
        }
        
        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            data = response.json()
            sites = []
            
            if 'value' in data and 'timeSeries' in data['value']:
                # This is for site info from instantaneous values endpoint
                time_series = data['value']['timeSeries']
                for ts in time_series[:limit]:
                    source_info = ts['sourceInfo']
                    site = USGSSite(
                        site_code=source_info['siteCode'][0]['value'],
                        site_name=source_info['siteName'],
                        latitude=float(source_info['geoLocation']['geogLocation']['latitude']),
                        longitude=float(source_info['geoLocation']['geogLocation']['longitude']),
                        state=source_info.get('siteProperty', [{}])[0].get('value', 'TX'),
                        county=source_info.get('siteProperty', [{}])[1].get('value', 'Unknown') if len(source_info.get('siteProperty', [])) > 1 else 'Unknown'
                    )
                    sites.append(site)
            
            log.info(f"Retrieved {len(sites)} USGS sites in Texas")
            return sites
            
        except requests.RequestException as e:
            log.error(f"Error fetching USGS sites: {str(e)}")
            return []
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            log.error(f"Error parsing USGS sites response: {str(e)}")
            return []
    
    def get_streamflow_data(self, site_codes: List[str], period: str = "P1D") -> List[StreamflowData]:
        """
        Get real-time streamflow data for specified sites
        
        Args:
            site_codes: List of USGS site codes (e.g., ['08167000', '08176500'])
            period: Period code (P1D = past 1 day, P7D = past 7 days)
        """
        if not site_codes:
            return []
        
        url = f"{self.BASE_URL}/iv/"
        sites_param = ','.join(site_codes)
        
        params = {
            'format': 'json',
            'sites': sites_param,
            'period': period,
            'parameterCd': f"{self.STREAMFLOW_PARAM},{self.GAGE_HEIGHT_PARAM}",
            'siteStatus': 'active'
        }
        
        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            data = response.json()
            streamflow_data = []
            
            if 'value' in data and 'timeSeries' in data['value']:
                time_series = data['value']['timeSeries']
                
                for ts in time_series:
                    source_info = ts['sourceInfo']
                    variable = ts['variable']
                    values = ts.get('values', [{}])[0].get('value', [])
                    
                    if not values:
                        continue
                    
                    # Get the most recent value
                    latest_value = values[-1]
                    
                    # Parse the data based on parameter type
                    param_code = variable['variableCode'][0]['value']
                    
                    if param_code == self.STREAMFLOW_PARAM and latest_value['value'] != '-999999':
                        try:
                            streamflow_cfs = float(latest_value['value'])
                            timestamp = datetime.fromisoformat(latest_value['dateTime'].replace('Z', '+00:00'))
                            
                            # Look for gage height in the same site's data
                            gage_height = None
                            for other_ts in time_series:
                                if (other_ts['sourceInfo']['siteCode'][0]['value'] == source_info['siteCode'][0]['value'] and
                                    other_ts['variable']['variableCode'][0]['value'] == self.GAGE_HEIGHT_PARAM):
                                    other_values = other_ts.get('values', [{}])[0].get('value', [])
                                    if other_values and other_values[-1]['value'] != '-999999':
                                        gage_height = float(other_values[-1]['value'])
                                    break
                            
                            streamflow_data.append(StreamflowData(
                                site_code=source_info['siteCode'][0]['value'],
                                site_name=source_info['siteName'],
                                streamflow_cfs=streamflow_cfs,
                                gage_height_ft=gage_height,
                                timestamp=timestamp,
                                quality_code=latest_value.get('qualifiers', ['A'])[0] if latest_value.get('qualifiers') else 'A'
                            ))
                        except (ValueError, KeyError) as e:
                            log.warning(f"Error parsing streamflow data for site {source_info['siteCode'][0]['value']}: {str(e)}")
                            continue
            
            log.info(f"Retrieved streamflow data for {len(streamflow_data)} sites")
            return streamflow_data
            
        except requests.RequestException as e:
            log.error(f"Error fetching USGS streamflow data: {str(e)}")
            return []
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            log.error(f"Error parsing USGS streamflow response: {str(e)}")
            return []
    
    def get_site_info(self, site_code: str) -> Optional[USGSSite]:
        """Get detailed information for a specific USGS site"""
        url = f"{self.BASE_URL}/site/"
        
        params = {
            'format': 'json',
            'sites': site_code,
            'siteOutput': 'expanded'
        }
        
        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            
            data = response.json()
            
            if 'value' in data and 'timeSeries' in data['value']:
                for ts in data['value']['timeSeries']:
                    source_info = ts['sourceInfo']
                    
                    # Extract drainage area if available
                    drainage_area = None
                    for prop in source_info.get('siteProperty', []):
                        if prop.get('name') == 'Drainage area':
                            try:
                                drainage_area = float(prop.get('value', 0))
                            except (ValueError, TypeError):
                                pass
                            break
                    
                    return USGSSite(
                        site_code=source_info['siteCode'][0]['value'],
                        site_name=source_info['siteName'],
                        latitude=float(source_info['geoLocation']['geogLocation']['latitude']),
                        longitude=float(source_info['geoLocation']['geogLocation']['longitude']),
                        state=source_info.get('siteProperty', [{}])[0].get('value', 'TX'),
                        county=source_info.get('siteProperty', [{}])[1].get('value', 'Unknown') if len(source_info.get('siteProperty', [])) > 1 else 'Unknown',
                        drainage_area_sqmi=drainage_area
                    )
            
            return None
            
        except requests.RequestException as e:
            log.error(f"Error fetching USGS site info for {site_code}: {str(e)}")
            return None
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            log.error(f"Error parsing USGS site info response: {str(e)}")
            return None


def get_major_texas_river_sites() -> List[str]:
    """Get USGS site codes for major Texas rivers mentioned in the sample data"""
    return [
        # Major Texas Rivers - these are real USGS site codes
        "08167000",  # Guadalupe River at Comfort, TX
        "08158000",  # Colorado River at Austin, TX  
        "08116650",  # Brazos River near Rosharon, TX
        "08057000",  # Trinity River at Dallas, TX
        "08178000",  # San Antonio River at San Antonio, TX
        "08020000",  # Sabine River near Longview, TX
        "08041000",  # Neches River at Evadale, TX
        "07335500",  # Red River at Denison Dam near Denison, TX
        "08447000",  # Pecos River near Girvin, TX
        "07227500",  # Canadian River near Amarillo, TX
        "08150000",  # Llano River at Llano, TX
        "08211000",  # Nueces River near Mathis, TX
    ]


def calculate_risk_level(streamflow_cfs: float, flood_stage_cfs: Optional[float] = None) -> Tuple[str, float]:
    """
    Calculate flood risk level and score based on streamflow data
    
    Returns:
        Tuple of (risk_level, risk_score) where:
        - risk_level: "Low", "Moderate", or "High"  
        - risk_score: 0.0 to 10.0
    """
    if flood_stage_cfs and streamflow_cfs >= flood_stage_cfs:
        # At or above flood stage
        risk_level = "High"
        risk_score = min(10.0, 7.0 + (streamflow_cfs / flood_stage_cfs - 1.0) * 3.0)
    elif flood_stage_cfs and streamflow_cfs >= flood_stage_cfs * 0.8:
        # 80-99% of flood stage
        risk_level = "Moderate" 
        ratio = streamflow_cfs / flood_stage_cfs
        risk_score = 4.0 + (ratio - 0.8) * 15.0  # 4.0 to 7.0 range
    elif streamflow_cfs > 1000:
        # High flow without flood stage reference
        risk_level = "Moderate"
        risk_score = min(7.0, 3.0 + (streamflow_cfs / 2000.0) * 2.0)
    elif streamflow_cfs > 500:
        # Moderate flow
        risk_level = "Low"
        risk_score = 2.0 + (streamflow_cfs / 500.0)
    else:
        # Low flow
        risk_level = "Low"
        risk_score = min(3.0, max(0.5, streamflow_cfs / 200.0))
    
    return risk_level, round(risk_score, 1)


def calculate_trend(current_flow: float, previous_flow: float, time_diff_hours: float) -> Tuple[str, float]:
    """
    Calculate flow trend based on current vs previous measurements
    
    Returns:
        Tuple of (trend, rate_cfs_per_hour) where:
        - trend: "rising", "falling", or "stable"
        - rate_cfs_per_hour: rate of change in CFS per hour
    """
    if time_diff_hours <= 0:
        return "stable", 0.0
    
    rate_per_hour = (current_flow - previous_flow) / time_diff_hours
    
    if abs(rate_per_hour) < 1.0:
        trend = "stable"
    elif rate_per_hour > 0:
        trend = "rising"
    else:
        trend = "falling"
    
    return trend, round(rate_per_hour, 1)


def update_watershed_with_usgs_data(db_path: str, usgs_data: StreamflowData) -> bool:
    """
    Update watershed data in database with USGS streamflow data
    
    Args:
        db_path: Path to the SQLite database
        usgs_data: USGS streamflow data
        
    Returns:
        bool: True if update was successful
    """
    try:
        # Find watershed by matching site code in name or create new entry
        watersheds = db.get_watersheds(db_path)
        target_watershed = None
        
        # Try to match by USGS site code in watershed name
        for watershed in watersheds:
            if usgs_data.site_code in watershed.get('name', '') or usgs_data.site_name.lower() in watershed.get('name', '').lower():
                target_watershed = watershed
                break
        
        # If no match found, we could create a new watershed, but for now let's just log
        if not target_watershed:
            log.warning(f"No matching watershed found for USGS site {usgs_data.site_code} ({usgs_data.site_name})")
            return False
        
        # Get current watershed data for trend calculation
        current_flow = target_watershed['current_streamflow_cfs']
        flood_stage = target_watershed.get('flood_stage_cfs')
        
        # Calculate risk level and score
        risk_level, risk_score = calculate_risk_level(usgs_data.streamflow_cfs, flood_stage)
        
        # Calculate trend if we have previous data
        time_diff = (usgs_data.timestamp - datetime.now(timezone.utc)).total_seconds() / 3600
        trend, trend_rate = calculate_trend(usgs_data.streamflow_cfs, current_flow, abs(time_diff))
        
        # Update watershed data using the enhanced API-aware function
        rows_affected = db.update_watershed_with_api_data(
            db_path,
            target_watershed['id'],
            usgs_data.streamflow_cfs,
            risk_level,
            risk_score,
            data_source='usgs',
            data_quality='approved' if usgs_data.quality_code == 'A' else 'provisional' if usgs_data.quality_code == 'P' else 'unknown',
            trend=trend,
            trend_rate=trend_rate
        )
        
        # Insert risk trend data point
        try:
            db.insert_risk_trend(db_path, target_watershed['id'], risk_score, usgs_data.streamflow_cfs)
        except Exception as e:
            log.warning(f"Could not insert risk trend data: {e}")
        
        log.info(f"Updated watershed {target_watershed['name']} with USGS data: {usgs_data.streamflow_cfs} CFS, {risk_level} risk")
        return rows_affected > 0
        
    except Exception as e:
        log.error(f"Error updating watershed with USGS data: {str(e)}")
        return False


def fetch_and_update_usgs_data(db_path: str, site_codes: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Fetch USGS data and update watershed information in database
    
    Args:
        db_path: Path to the SQLite database
        site_codes: Optional list of specific site codes to fetch. If None, uses major Texas rivers.
        
    Returns:
        Dict with update results
    """
    if not settings.enable_real_time_data:
        log.info("Real-time data integration is disabled")
        return {"success": False, "message": "Real-time data integration disabled"}
    
    if site_codes is None:
        site_codes = get_major_texas_river_sites()
    
    usgs_api = USGSWaterServices(timeout=settings.usgs_api_timeout)
    results = {
        "success": True,
        "updated_count": 0,
        "failed_count": 0,
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    try:
        # Fetch streamflow data
        streamflow_data = usgs_api.get_streamflow_data(site_codes, period="P1D")
        
        if not streamflow_data:
            results["success"] = False
            results["message"] = "No USGS data retrieved"
            return results
        
        # Update watersheds with fetched data
        for data in streamflow_data:
            try:
                if update_watershed_with_usgs_data(db_path, data):
                    results["updated_count"] += 1
                else:
                    results["failed_count"] += 1
            except Exception as e:
                results["failed_count"] += 1
                results["errors"].append(f"Failed to update {data.site_code}: {str(e)}")
        
        results["message"] = f"Updated {results['updated_count']} watersheds, {results['failed_count']} failed"
        log.info(f"USGS data update completed: {results['message']}")
        
        return results
        
    except Exception as e:
        results["success"] = False
        results["message"] = f"USGS data fetch failed: {str(e)}"
        results["errors"].append(str(e))
        log.error(f"USGS data fetch failed: {str(e)}")
        return results


def create_watersheds_from_usgs_sites(db_path: str, limit: int = 20) -> Dict[str, Any]:
    """
    Create watershed entries from USGS monitoring sites
    This is useful for initial setup or expanding coverage
    
    Args:
        db_path: Path to the SQLite database  
        limit: Maximum number of sites to process
        
    Returns:
        Dict with creation results
    """
    usgs_api = USGSWaterServices(timeout=settings.usgs_api_timeout)
    results = {
        "success": True,
        "created_count": 0,
        "skipped_count": 0,
        "errors": []
    }
    
    try:
        # Get major river site codes
        site_codes = get_major_texas_river_sites()[:limit]
        
        for site_code in site_codes:
            try:
                # Get site information
                site_info = usgs_api.get_site_info(site_code)
                if not site_info:
                    results["skipped_count"] += 1
                    continue
                
                # Get current streamflow data
                streamflow_data = usgs_api.get_streamflow_data([site_code], period="P1D")
                current_flow = 0.0
                if streamflow_data:
                    current_flow = streamflow_data[0].streamflow_cfs
                
                # Calculate estimated flood stage (rough estimate based on drainage area)
                flood_stage = None
                if site_info.drainage_area_sqmi:
                    # Very rough estimate: larger drainage areas tend to have higher flood stages
                    flood_stage = max(1000, site_info.drainage_area_sqmi * 10)
                
                # Calculate initial risk
                risk_level, risk_score = calculate_risk_level(current_flow, flood_stage)
                
                # Create watershed entry
                watershed_id = db.insert_watershed(
                    db_path,
                    name=f"{site_info.site_name} (USGS {site_info.site_code})",
                    lat=site_info.latitude,
                    lng=site_info.longitude,
                    basin_size=site_info.drainage_area_sqmi or 0,
                    streamflow=current_flow,
                    risk_level=risk_level,
                    risk_score=risk_score,
                    flood_stage=flood_stage or 0,
                    trend="stable",
                    trend_rate=0.0,
                    usgs_site_code=site_info.site_code,
                    data_source='usgs',
                    data_quality='unknown'
                )
                
                if watershed_id:
                    results["created_count"] += 1
                    log.info(f"Created watershed for USGS site {site_code}: {site_info.site_name}")
                else:
                    results["skipped_count"] += 1
                    
            except Exception as e:
                results["skipped_count"] += 1
                results["errors"].append(f"Failed to process site {site_code}: {str(e)}")
                log.warning(f"Failed to process USGS site {site_code}: {str(e)}")
        
        results["message"] = f"Created {results['created_count']} watersheds from USGS sites"
        return results
        
    except Exception as e:
        results["success"] = False
        results["message"] = f"Failed to create watersheds from USGS sites: {str(e)}"
        results["errors"].append(str(e))
        log.error(f"Failed to create watersheds from USGS sites: {str(e)}")
        return results