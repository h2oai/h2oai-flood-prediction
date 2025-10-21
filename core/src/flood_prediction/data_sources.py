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
        """Get detailed information for a specific USGS site using instantaneous values endpoint"""
        # Use the IV (instantaneous values) endpoint which reliably returns site coordinates
        url = f"{self.BASE_URL}/iv/"

        params = {
            'format': 'json',
            'sites': site_code,
            'parameterCd': self.STREAMFLOW_PARAM,  # Request discharge data
            'siteStatus': 'active'
        }

        try:
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()

            data = response.json()

            if 'value' in data and 'timeSeries' in data['value']:
                time_series = data['value']['timeSeries']

                if len(time_series) > 0:
                    source_info = time_series[0]['sourceInfo']

                    # Extract drainage area if available
                    drainage_area = None
                    for prop in source_info.get('siteProperty', []):
                        if prop.get('name') == 'Drainage area':
                            try:
                                drainage_area = float(prop.get('value', 0))
                            except (ValueError, TypeError):
                                pass
                            break

                    # Extract state and county from siteProperty
                    state = 'Unknown'
                    county = 'Unknown'
                    for prop in source_info.get('siteProperty', []):
                        prop_name = prop.get('name', '')
                        if 'State' in prop_name or 'stateCd' in prop_name:
                            state = prop.get('value', 'Unknown')
                        elif 'County' in prop_name or 'countyCd' in prop_name:
                            county = prop.get('value', 'Unknown')

                    return USGSSite(
                        site_code=source_info['siteCode'][0]['value'],
                        site_name=source_info['siteName'],
                        latitude=float(source_info['geoLocation']['geogLocation']['latitude']),
                        longitude=float(source_info['geoLocation']['geogLocation']['longitude']),
                        state=state,
                        county=county,
                        drainage_area_sqmi=drainage_area
                    )

            return None

        except requests.RequestException as e:
            log.error(f"Error fetching USGS site info for {site_code}: {str(e)}")
            return None
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            log.error(f"Error parsing USGS site info response for {site_code}: {str(e)}")
            return None


# =============================================================================
# Regional Configuration
# =============================================================================

REGION_CONFIG = {
    "TX": {
        "name": "Texas",
        "code": "TX",
        "description": "Texas Gulf Coast and major river basins",
        "center_lat": 31.0,
        "center_lng": -99.0,
        "zoom": 6,
        "state_codes": ["TX"],
        "sites": [
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
    },
    "CA": {
        "name": "California",
        "code": "CA",
        "description": "California rivers and watersheds",
        "center_lat": 37.0,
        "center_lng": -120.0,
        "zoom": 6,
        "state_codes": ["CA"],
        "sites": [
            "11447650",  # Sacramento River at Freeport, CA - VERIFIED
            "11303500",  # San Joaquin River near Vernalis, CA - VERIFIED
            "11446500",  # American River at Fair Oaks, CA - VERIFIED
            "11370500",  # Sacramento River at Keswick, CA - VERIFIED
            "11425500",  # Sacramento River at Verona, CA - VERIFIED
            "11389500",  # Sacramento River at Colusa, CA - VERIFIED
            "11467000",  # Russian River at Hacienda Bridge near Guerneville, CA - VERIFIED
            "11464000",  # Russian River near Healdsburg, CA - VERIFIED
            "11407000",  # Feather River at Oroville, CA - VERIFIED
            "11390000",  # Butte Creek near Chico, CA - VERIFIED
        ]
    },
    "FL": {
        "name": "Florida",
        "code": "FL",
        "description": "Florida rivers and coastal watersheds",
        "center_lat": 28.5,
        "center_lng": -82.0,
        "zoom": 6,
        "state_codes": ["FL"],
        "sites": [
            "02246500",  # St. Johns River at Jacksonville, FL - VERIFIED
            "02315500",  # Suwannee River at White Springs, FL - VERIFIED
            "02319800",  # Suwannee River at Dowling Park, FL - VERIFIED
            "02320500",  # Suwannee River at Branford, FL - VERIFIED
            "02358000",  # Apalachicola River at Chattahoochee, FL - VERIFIED
            "02358700",  # Apalachicola River near Blountstown, FL - VERIFIED
            "02296750",  # Peace River at SR 70 at Arcadia, FL - VERIFIED
            "02294650",  # Peace River at Bartow, FL - CORRECTED from 02294655
        ]
    },
    "LA": {
        "name": "Louisiana",
        "code": "LA",
        "description": "Louisiana and Mississippi Delta region",
        "center_lat": 30.5,
        "center_lng": -91.5,
        "zoom": 7,
        "state_codes": ["LA"],
        "sites": [
            "07381600",  # Atchafalaya River at Simmesport, LA
            "07373420",  # Mississippi River at Belle Chasse, LA
            "07374000",  # Mississippi River at Baton Rouge, LA
            "07374525",  # Mississippi River below Red River Landing, LA - ADDED
            "07380120",  # Amite River at Port Vincent, LA
            "07386980",  # Vermilion River at Perry, LA
            "07389000",  # Bayou Teche at Arnaudville, LA
        ]
    },
    "MS": {
        "name": "Mississippi Delta",
        "code": "MS",
        "description": "Mississippi River Delta region",
        "center_lat": 33.0,
        "center_lng": -90.0,
        "zoom": 7,
        "state_codes": ["MS", "AR"],
        "sites": [
            "07289000",  # Mississippi River at Vicksburg, MS
            "07288650",  # Yazoo River at Redwood, MS
            "07288800",  # Big Sunflower River at Sunflower, MS - ADDED
            "02479000",  # Pascagoula River at Merrill, MS
            "02489500",  # Pearl River at Jackson, MS
            "07263620",  # Arkansas River at David D. Terry Lock & Dam, AR
        ]
    },
    "PNW": {
        "name": "Pacific Northwest",
        "code": "PNW",
        "description": "Washington and Oregon watersheds",
        "center_lat": 45.5,
        "center_lng": -122.0,
        "zoom": 6,
        "state_codes": ["WA", "OR"],
        "sites": [
            "14211720",  # Willamette River at Portland, OR - VERIFIED
            "14105700",  # Columbia River at The Dalles, OR - VERIFIED
            "12113000",  # Green River near Auburn, WA - VERIFIED
            "12200500",  # Skagit River near Mount Vernon, WA - VERIFIED
            "12031000",  # Chehalis River at Porter, WA
            "14211500",  # Sandy River below Bull Run River, OR
            "12108500",  # White River at R Street near Auburn, WA - ADDED
        ]
    },
    "UMW": {
        "name": "Upper Midwest",
        "code": "UMW",
        "description": "Minnesota and Wisconsin watersheds",
        "center_lat": 45.0,
        "center_lng": -92.0,
        "zoom": 6,
        "state_codes": ["MN", "WI"],
        "sites": [
            "05344500",  # Mississippi River at Prescott, WI
            "05331000",  # Mississippi River at St. Paul, MN
            "05211000",  # Mississippi River at Grand Rapids, MN
            "05267000",  # Mississippi River near Royalton, MN - ADDED
            "05355200",  # Chippewa River at Durand, WI
            "05120000",  # Red River of the North at Fargo, ND
            "05378500",  # Mississippi River at Winona, MN
        ]
    },
    "NE": {
        "name": "Northeast",
        "code": "NE",
        "description": "New York and Pennsylvania watersheds",
        "center_lat": 41.5,
        "center_lng": -76.0,
        "zoom": 6,
        "state_codes": ["NY", "PA"],
        "sites": [
            "01531500",  # Susquehanna River at Towanda, PA - VERIFIED
            "01357500",  # Mohawk River at Cohoes, NY - VERIFIED
            "01335754",  # Hudson River Above Lock 1 Near Waterford, NY - VERIFIED
            "01463500",  # Delaware River at Trenton, NJ - VERIFIED
            "01536500",  # Susquehanna River at Wilkes-Barre, PA
            "01553500",  # West Branch Susquehanna River at Lewisburg, PA
            "01578310",  # Susquehanna River at Conowingo, MD - ADDED
        ]
    },
    "SE": {
        "name": "Southeast",
        "code": "SE",
        "description": "Georgia and South Carolina watersheds",
        "center_lat": 33.0,
        "center_lng": -82.0,
        "zoom": 6,
        "state_codes": ["GA", "SC"],
        "sites": [
            "02198500",  # Savannah River at Augusta, GA
            "02169000",  # Congaree River at Columbia, SC
            "02202500",  # Ogeechee River near Eden, GA
            "02177000",  # Edisto River near Givhans, SC
            "02228000",  # Altamaha River at Doctortown, GA
            "02226500",  # Altamaha River at Everett City, GA - ADDED
            "02215500",  # Ocmulgee River at Macon, GA
        ]
    },
    "MW": {
        "name": "Mountain West",
        "code": "MW",
        "description": "Colorado and Utah mountain watersheds",
        "center_lat": 39.0,
        "center_lng": -106.0,
        "zoom": 6,
        "state_codes": ["CO", "UT"],
        "sites": [
            "09380000",  # Colorado River at Lees Ferry, AZ
            "09163500",  # Colorado River near Colorado-Utah State Line
            "09070500",  # Colorado River near Dotsero, CO
            "09180000",  # Dolores River near Cisco, UT - ADDED
            "09306500",  # White River near Watson, UT
            "09261000",  # Green River near Jensen, UT
            "09315000",  # Green River at Green River, UT
        ]
    }
}



def get_available_regions() -> List[Dict[str, Any]]:
    """Get list of all available regions with metadata"""
    return [
        {
            "code": config["code"],
            "name": config["name"],
            "description": config["description"],
            "center_lat": config["center_lat"],
            "center_lng": config["center_lng"],
            "zoom": config["zoom"],
            "watershed_count": len(config["sites"])
        }
        for code, config in REGION_CONFIG.items()
    ]


def get_region_config(region_code: str) -> Optional[Dict[str, Any]]:
    """Get configuration for a specific region"""
    return REGION_CONFIG.get(region_code.upper())


def get_major_river_sites_by_region(region_code: str = "TX") -> List[str]:
    """Get USGS site codes for major rivers in the specified region"""
    config = get_region_config(region_code)
    if config:
        return config["sites"]
    # Default to Texas if region not found
    return REGION_CONFIG["TX"]["sites"]


# Backward compatibility
def get_major_texas_river_sites() -> List[str]:
    """Get USGS site codes for major Texas rivers (backward compatibility)"""
    return get_major_river_sites_by_region("TX")


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


def fetch_and_update_usgs_data(db_path: str, site_codes: Optional[List[str]] = None, region_code: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch USGS data and update watershed information in database

    Args:
        db_path: Path to the SQLite database
        site_codes: Optional list of specific site codes to fetch.
        region_code: Optional region code to fetch data for. If None with no site_codes, uses Texas.

    Returns:
        Dict with update results
    """
    if not settings.enable_real_time_data:
        log.info("Real-time data integration is disabled")
        return {"success": False, "message": "Real-time data integration disabled"}

    if site_codes is None:
        if region_code:
            site_codes = get_major_river_sites_by_region(region_code)
        else:
            site_codes = get_major_texas_river_sites()

    usgs_api = USGSWaterServices(timeout=settings.usgs_api_timeout)
    results = {
        "success": True,
        "updated_count": 0,
        "failed_count": 0,
        "errors": [],
        "region_code": region_code or "TX",
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


def create_watersheds_from_usgs_sites(db_path: str, limit: int = 20, region_code: str = "TX") -> Dict[str, Any]:
    """
    Create watershed entries from USGS monitoring sites
    This is useful for initial setup or expanding coverage

    Args:
        db_path: Path to the SQLite database
        limit: Maximum number of sites to process
        region_code: Region code for the watersheds (default: TX)

    Returns:
        Dict with creation results
    """
    usgs_api = USGSWaterServices(timeout=settings.usgs_api_timeout)
    region_config = get_region_config(region_code)

    results = {
        "success": True,
        "created_count": 0,
        "skipped_count": 0,
        "errors": [],
        "region": region_config["name"] if region_config else "Unknown",
        "region_code": region_code
    }

    try:
        # Get major river site codes for the region
        site_codes = get_major_river_sites_by_region(region_code)[:limit]

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

                # Create watershed entry with region info
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
                    data_quality='unknown',
                    region=region_config["name"] if region_config else "Unknown",
                    region_code=region_code
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


def fetch_and_store_noaa_alerts(db_path: str) -> Dict[str, Any]:
    """
    Fetch real-time flood alerts from NOAA Weather API and store them in the database

    Args:
        db_path: Path to the SQLite database

    Returns:
        Dict with fetch and storage results
    """
    results = {
        "success": True,
        "alerts_fetched": 0,
        "alerts_stored": 0,
        "alerts_skipped": 0,
        "errors": [],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

    if not settings.enable_real_time_data:
        log.info("Real-time data integration is disabled")
        return {"success": False, "message": "Real-time data integration disabled"}

    try:
        # Fetch active alerts from NOAA for Texas
        url = "https://api.weather.gov/alerts/active"
        params = {
            'area': 'TX',
            'status': 'actual',
            'message_type': 'alert'
        }
        headers = {
            'User-Agent': 'FloodPredictionSystem/1.0 (github.com/flood-prediction)',
            'Accept': 'application/geo+json'
        }

        response = requests.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()

        features = data.get('features', [])
        results["alerts_fetched"] = len(features)

        # Filter for flood-related alerts
        flood_keywords = ['flood', 'flash flood', 'flooding', 'river', 'stream', 'water']

        # Get all watersheds for matching
        watersheds = db.get_watersheds(db_path)

        for feature in features:
            props = feature.get('properties', {})
            event_type = props.get('event', '').lower()

            # Check if this is a flood-related alert
            if not any(keyword in event_type for keyword in flood_keywords):
                continue

            # Extract alert information
            noaa_id = props.get('id', '')
            alert_type = props.get('event', 'Weather Alert')
            headline = props.get('headline', '')
            description = props.get('description', '')
            severity = props.get('severity', 'Unknown')
            areas = props.get('areaDesc', '')
            effective = props.get('effective', datetime.now(timezone.utc).isoformat())
            expires = props.get('expires', (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat())

            # Create alert message
            message = headline if headline else description[:200]

            # Map NOAA severity to database severity
            severity_map = {
                'Extreme': 'High',
                'Severe': 'High',
                'Moderate': 'Moderate',
                'Minor': 'Low',
                'Unknown': 'Moderate'
            }
            db_severity = severity_map.get(severity, 'Moderate')

            # Try to match alert to watershed(s)
            matched_watersheds = match_alert_to_watersheds(areas, watersheds)

            if not matched_watersheds:
                # Create a general alert for the first watershed if no match
                matched_watersheds = [watersheds[0]] if watersheds else []

            # Store alert for each matched watershed
            for watershed in matched_watersheds:
                alert_id = db.insert_noaa_alert(
                    db_path,
                    alert_type=alert_type,
                    watershed_id=watershed['id'],
                    message=message,
                    severity=db_severity,
                    issued_time=effective,
                    expires_time=expires,
                    counties=areas[:200],  # Truncate if too long
                    noaa_id=noaa_id
                )

                if alert_id:
                    results["alerts_stored"] += 1
                    log.info(f"Stored NOAA alert: {alert_type} for {watershed['name']}")
                else:
                    results["alerts_skipped"] += 1

        results["message"] = f"Fetched {results['alerts_fetched']} alerts, stored {results['alerts_stored']}, skipped {results['alerts_skipped']} duplicates"
        log.info(f"NOAA alerts update completed: {results['message']}")
        return results

    except requests.RequestException as e:
        results["success"] = False
        results["message"] = f"Failed to fetch NOAA alerts: {str(e)}"
        results["errors"].append(str(e))
        log.error(f"NOAA alerts fetch failed: {str(e)}")
        return results
    except Exception as e:
        results["success"] = False
        results["message"] = f"Error processing NOAA alerts: {str(e)}"
        results["errors"].append(str(e))
        log.error(f"NOAA alerts processing failed: {str(e)}")
        return results


def match_alert_to_watersheds(area_description: str, watersheds: List[Dict]) -> List[Dict]:
    """
    Match a NOAA alert area description to watersheds in the database

    Args:
        area_description: NOAA alert area description (e.g., "Travis; Bastrop; Hays")
        watersheds: List of watershed dictionaries

    Returns:
        List of matched watersheds
    """
    if not area_description or not watersheds:
        return []

    matched = []
    area_lower = area_description.lower()

    # Split areas by common delimiters
    area_parts = [part.strip() for part in area_description.replace(';', ',').split(',')]

    for watershed in watersheds:
        watershed_name = watershed.get('name', '').lower()

        # Check if any area is mentioned in the watershed name
        for area in area_parts:
            if area.lower() in watershed_name or watershed_name in area.lower():
                matched.append(watershed)
                break

    return matched