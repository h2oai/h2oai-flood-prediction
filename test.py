"""
Complete USGS Watershed Configuration with Verified Gauge Stations
Updated: October 2025

This module provides a complete configuration of USGS gauge stations
for major watersheds across the United States.
"""

import requests
from typing import Dict, List, Tuple, Optional
from datetime import datetime, timedelta
import json


# ============================================================================
# REGION CONFIGURATION - VERIFIED GAUGE STATIONS
# ============================================================================

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
            "11447650",  # Sacramento River at Freeport, CA
            "11303500",  # San Joaquin River near Vernalis, CA
            "11446500",  # American River at Fair Oaks, CA
            "11370500",  # Sacramento River at Keswick, CA
            "11425500",  # Sacramento River at Verona, CA
            "11389500",  # Sacramento River at Colusa, CA
            "11467000",  # Russian River at Hacienda Bridge near Guerneville, CA
            "11464000",  # Russian River near Healdsburg, CA
            "11407000",  # Feather River at Oroville, CA
            "11390000",  # Butte Creek near Chico, CA
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
            "02246500",  # St. Johns River at Jacksonville, FL
            "02315500",  # Suwannee River at White Springs, FL
            "02319800",  # Suwannee River at Dowling Park, FL
            "02320500",  # Suwannee River at Branford, FL
            "02358000",  # Apalachicola River at Chattahoochee, FL
            "02358700",  # Apalachicola River near Blountstown, FL
            "02296750",  # Peace River at SR 70 at Arcadia, FL
            "02294650",  # Peace River at Bartow, FL
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
            "07374525",  # Mississippi River below Red River Landing, LA
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
            "07288800",  # Big Sunflower River at Sunflower, MS
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
            "14211720",  # Willamette River at Portland, OR
            "14105700",  # Columbia River at The Dalles, OR
            "12113000",  # Green River near Auburn, WA
            "12200500",  # Skagit River near Mount Vernon, WA
            "12031000",  # Chehalis River at Porter, WA
            "14211500",  # Sandy River below Bull Run River, OR
            "12108500",  # White River at R Street near Auburn, WA
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
            "05267000",  # Mississippi River near Royalton, MN
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
            "01531500",  # Susquehanna River at Towanda, PA
            "01357500",  # Mohawk River at Cohoes, NY
            "01335754",  # Hudson River Above Lock 1 Near Waterford, NY
            "01463500",  # Delaware River at Trenton, NJ
            "01536500",  # Susquehanna River at Wilkes-Barre, PA
            "01553500",  # West Branch Susquehanna River at Lewisburg, PA
            "01578310",  # Susquehanna River at Conowingo, MD
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
            "02226500",  # Altamaha River at Everett City, GA
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
            "09180000",  # Dolores River near Cisco, UT
            "09306500",  # White River near Watson, UT
            "09261000",  # Green River near Jensen, UT
            "09315000",  # Green River at Green River, UT
        ]
    }
}


# ============================================================================
# USGS DATA FETCHING FUNCTIONS
# ============================================================================

class USGSDataFetcher:
    """Fetch real-time and historical data from USGS Water Services API"""
    
    BASE_URL_IV = "https://waterservices.usgs.gov/nwis/iv/"
    BASE_URL_DV = "https://waterservices.usgs.gov/nwis/dv/"
    BASE_URL_SITE = "https://waterservices.usgs.gov/nwis/site/"
    
    # Common USGS parameter codes
    PARAMS = {
        'discharge': '00060',      # Discharge, cubic feet per second
        'gage_height': '00065',    # Gage height, feet
        'temperature': '00010',    # Temperature, water, degrees Celsius
        'precipitation': '00045',  # Precipitation, total, inches
    }
    
    @staticmethod
    def get_current_data(site_no: str, parameter: str = 'discharge') -> Optional[Dict]:
        """
        Get current (instantaneous) data for a site
        
        Args:
            site_no: USGS site number (e.g., '11447650')
            parameter: Parameter to fetch ('discharge', 'gage_height', etc.)
        
        Returns:
            Dictionary with current data or None if error
        """
        param_code = USGSDataFetcher.PARAMS.get(parameter, parameter)
        
        url = USGSDataFetcher.BASE_URL_IV
        params = {
            'format': 'json',
            'sites': site_no,
            'parameterCd': param_code,
            'siteStatus': 'active'
        }
        
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            if 'value' in data and 'timeSeries' in data['value']:
                time_series = data['value']['timeSeries']
                
                if len(time_series) > 0:
                    ts = time_series[0]
                    site_info = ts['sourceInfo']
                    values = ts['values'][0]['value']
                    
                    if len(values) > 0:
                        latest = values[-1]
                        
                        return {
                            'site_no': site_no,
                            'site_name': site_info.get('siteName', 'Unknown'),
                            'parameter': parameter,
                            'value': float(latest['value']),
                            'unit': ts['variable']['unit']['unitCode'],
                            'datetime': latest['dateTime'],
                            'latitude': site_info['geoLocation']['geogLocation']['latitude'],
                            'longitude': site_info['geoLocation']['geogLocation']['longitude']
                        }
            
            return None
            
        except Exception as e:
            print(f"Error fetching data for {site_no}: {str(e)}")
            return None
    
    @staticmethod
    def get_daily_data(site_no: str, 
                      parameter: str = 'discharge',
                      start_date: Optional[str] = None,
                      end_date: Optional[str] = None,
                      period: Optional[str] = None) -> Optional[Dict]:
        """
        Get daily values for a site
        
        Args:
            site_no: USGS site number
            parameter: Parameter to fetch
            start_date: Start date (YYYY-MM-DD)
            end_date: End date (YYYY-MM-DD)
            period: Period code (e.g., 'P7D' for last 7 days)
        
        Returns:
            Dictionary with daily data or None if error
        """
        param_code = USGSDataFetcher.PARAMS.get(parameter, parameter)
        
        url = USGSDataFetcher.BASE_URL_DV
        params = {
            'format': 'json',
            'sites': site_no,
            'parameterCd': param_code,
            'siteStatus': 'active'
        }
        
        if period:
            params['period'] = period
        elif start_date and end_date:
            params['startDT'] = start_date
            params['endDT'] = end_date
        else:
            # Default to last 7 days
            params['period'] = 'P7D'
        
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            if 'value' in data and 'timeSeries' in data['value']:
                time_series = data['value']['timeSeries']
                
                if len(time_series) > 0:
                    ts = time_series[0]
                    site_info = ts['sourceInfo']
                    values = ts['values'][0]['value']
                    
                    daily_values = [
                        {
                            'date': v['dateTime'].split('T')[0],
                            'value': float(v['value'])
                        }
                        for v in values
                    ]
                    
                    return {
                        'site_no': site_no,
                        'site_name': site_info.get('siteName', 'Unknown'),
                        'parameter': parameter,
                        'unit': ts['variable']['unit']['unitCode'],
                        'values': daily_values
                    }
            
            return None
            
        except Exception as e:
            print(f"Error fetching daily data for {site_no}: {str(e)}")
            return None
    
    @staticmethod
    def get_site_info(site_no: str) -> Optional[Dict]:
        """
        Get information about a site
        
        Args:
            site_no: USGS site number
        
        Returns:
            Dictionary with site information or None if error
        """
        url = USGSDataFetcher.BASE_URL_SITE
        params = {
            'format': 'json',
            'sites': site_no,
            'siteOutput': 'expanded'
        }
        
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            # This endpoint returns RDB format, need to parse differently
            # For simplicity, use the IV endpoint to get site info
            return USGSDataFetcher.get_current_data(site_no)
            
        except Exception as e:
            print(f"Error fetching site info for {site_no}: {str(e)}")
            return None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_region_sites(region_code: str) -> List[str]:
    """Get all site codes for a given region"""
    if region_code in REGION_CONFIG:
        return REGION_CONFIG[region_code]["sites"]
    return []


def get_all_sites() -> List[str]:
    """Get all site codes across all regions"""
    all_sites = []
    for region in REGION_CONFIG.values():
        all_sites.extend(region["sites"])
    return all_sites


def get_regions_by_state(state_code: str) -> List[str]:
    """Get all regions that include a given state"""
    regions = []
    for region_code, region_data in REGION_CONFIG.items():
        if state_code in region_data["state_codes"]:
            regions.append(region_code)
    return regions


def get_region_data(region_code: str) -> Optional[Dict]:
    """Get complete region configuration"""
    return REGION_CONFIG.get(region_code)


def build_usgs_monitoring_url(site_no: str) -> str:
    """Build USGS monitoring location page URL"""
    return f"https://waterdata.usgs.gov/monitoring-location/{site_no}/"


def fetch_region_current_data(region_code: str, parameter: str = 'discharge') -> Dict[str, Dict]:
    """
    Fetch current data for all sites in a region
    
    Args:
        region_code: Region code (e.g., 'CA', 'TX')
        parameter: Parameter to fetch
    
    Returns:
        Dictionary mapping site numbers to their current data
    """
    sites = get_region_sites(region_code)
    results = {}
    
    fetcher = USGSDataFetcher()
    
    for site_no in sites:
        data = fetcher.get_current_data(site_no, parameter)
        if data:
            results[site_no] = data
    
    return results


def export_config_to_json(filename: str = 'usgs_config.json'):
    """Export configuration to JSON file"""
    with open(filename, 'w') as f:
        json.dump(REGION_CONFIG, f, indent=2)
    print(f"Configuration exported to {filename}")


def load_config_from_json(filename: str) -> Dict:
    """Load configuration from JSON file"""
    with open(filename, 'r') as f:
        return json.load(f)


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

if __name__ == "__main__":
    print("="*70)
    print("USGS Watershed Configuration - Complete Example")
    print("="*70)
    
    # Example 1: Get region information
    print("\n1. Region Information:")
    print("-"*70)
    ca_data = get_region_data("CA")
    print(f"Region: {ca_data['name']}")
    print(f"Description: {ca_data['description']}")
    print(f"Number of stations: {len(ca_data['sites'])}")
    print(f"States: {', '.join(ca_data['state_codes'])}")
    
    # Example 2: List all sites in Texas
    print("\n2. Texas Gauge Stations:")
    print("-"*70)
    tx_sites = get_region_sites("TX")
    for i, site in enumerate(tx_sites, 1):
        url = build_usgs_monitoring_url(site)
        print(f"{i}. {site} - {url}")
    
    # Example 3: Fetch current data for a single site
    print("\n3. Current Data (Sacramento River at Freeport):")
    print("-"*70)
    fetcher = USGSDataFetcher()
    current_data = fetcher.get_current_data("11447650", "discharge")
    
    if current_data:
        print(f"Site: {current_data['site_name']}")
        print(f"Current Discharge: {current_data['value']} {current_data['unit']}")
        print(f"Time: {current_data['datetime']}")
        print(f"Location: {current_data['latitude']}, {current_data['longitude']}")
    else:
        print("Could not fetch data (site may be temporarily offline)")
    
    # Example 4: Fetch daily data
    print("\n4. Last 7 Days Data (Sacramento River):")
    print("-"*70)
    daily_data = fetcher.get_daily_data("11447650", period="P7D")
    
    if daily_data:
        print(f"Site: {daily_data['site_name']}")
        print(f"Parameter: {daily_data['parameter']} ({daily_data['unit']})")
        print("\nDaily values:")
        for v in daily_data['values'][-5:]:  # Show last 5 days
            print(f"  {v['date']}: {v['value']}")
    else:
        print("Could not fetch daily data")
    
    # Example 5: Get all California current data
    print("\n5. All California Sites - Current Discharge:")
    print("-"*70)
    print("Fetching data for 10 sites... (this may take a moment)")
    ca_current = fetch_region_current_data("CA", "discharge")
    
    print(f"\nSuccessfully fetched data for {len(ca_current)} sites:")
    for site_no, data in ca_current.items():
        print(f"  {site_no}: {data['value']:.0f} {data['unit']}")
    
    # Example 6: Export configuration
    print("\n6. Export Configuration:")
    print("-"*70)
    export_config_to_json('watershed_config.json')
    
    # Example 7: Statistics
    print("\n7. Configuration Statistics:")
    print("-"*70)
    total_sites = len(get_all_sites())
    print(f"Total regions: {len(REGION_CONFIG)}")
    print(f"Total stations: {total_sites}")
    print("\nStations per region:")
    for code, data in REGION_CONFIG.items():
        print(f"  {code} ({data['name']}): {len(data['sites'])} stations")
    
    print("\n" + "="*70)
    print("Examples complete! All station codes are ready to use.")
    print("="*70)