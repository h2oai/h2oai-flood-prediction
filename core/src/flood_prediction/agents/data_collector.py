"""
Enhanced Data Collector Agent with improved error handling and updated API endpoints
"""

import asyncio
import aiohttp
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import json
import logging
from urllib.parse import urlencode

from .base_agent import BaseAgent, AgentInsight, AgentAlert

logger = logging.getLogger(__name__)

class DataCollectorAgent(BaseAgent):
    """Enhanced agent responsible for collecting real-time data from external APIs"""
    
    def __init__(self):
        super().__init__(
            name="Data Collector",
            description="Continuously pulls real-time flood data from USGS, NOAA, and weather APIs",
            check_interval=300  # Check every 5 minutes
        )
        self.last_usgs_update = None
        self.last_noaa_update = None
        self.last_weather_update = None
        self.data_quality_score = 0.0
        self.api_retry_attempts = 3
        self.request_timeout = 30
        self.initialized_time = datetime.now(timezone.utc)
        self.has_attempted_collection = False
        
    async def analyze(self, data: Dict[str, Any]) -> List[AgentInsight]:
        """Analyze data collection status and quality"""
        insights = []
        
        # Data freshness insight
        freshness_score = self._calculate_data_freshness()
        insights.append(AgentInsight(
            title="🔄 Data Freshness",
            value=f"{freshness_score:.0f}% current",
            change=self._get_freshness_trend(),
            trend='up' if freshness_score > 85 else 'down' if freshness_score < 70 else 'stable',
            urgency='high' if freshness_score < 50 else 'normal'
        ))
        
        # API status insight
        api_status = await self._check_api_status()
        working_apis = sum(1 for status in api_status.values() if status)
        total_apis = len(api_status)
        
        insights.append(AgentInsight(
            title="🌐 API Connectivity",
            value=f"{working_apis}/{total_apis} active",
            trend='up' if working_apis == total_apis else 'down' if working_apis < total_apis/2 else 'stable',
            urgency='high' if working_apis < total_apis/2 else 'normal'
        ))
        
        # Data quality insight
        self.data_quality_score = self._calculate_data_quality()
        insights.append(AgentInsight(
            title="📊 Data Quality",
            value=f"{self.data_quality_score:.1f}/10",
            change=f"{self._get_quality_change():+.1f}",
            trend='up' if self.data_quality_score > 8 else 'down' if self.data_quality_score < 6 else 'stable',
            urgency='high' if self.data_quality_score < 5 else 'normal'
        ))
        
        # Update frequency insight
        updates_per_hour = self._calculate_update_frequency()
        insights.append(AgentInsight(
            title="⚡ Update Frequency",
            value=f"{updates_per_hour} updates/hour",
            trend='stable',
            urgency='normal'
        ))
        
        return insights
    
    async def check_alerts(self, data: Dict[str, Any]) -> List[AgentAlert]:
        """Check for data collection issues that require alerts"""
        alerts = []
        
        # Check for stale data
        if self._is_data_stale():
            alerts.append(AgentAlert(
                id=f"data_stale_{datetime.now().strftime('%Y%m%d')}",
                title="⚠️ Stale Data Detected",
                message="Some data sources haven't updated in over 2 hours. Real-time monitoring may be affected.",
                severity="warning",
                source_agent=self.name,
                recommendations=[
                    "Check API connectivity",
                    "Verify API keys and endpoints",
                    "Switch to backup data sources if available"
                ]
            ))
        
        # Check for API failures
        api_status = await self._check_api_status()
        failed_apis = [api for api, status in api_status.items() if not status]
        
        if failed_apis:
            alerts.append(AgentAlert(
                id=f"api_failure_{len(failed_apis)}_{datetime.now().strftime('%Y%m%d%H')}",
                title="🚨 API Connection Failures",
                message=f"Failed to connect to {len(failed_apis)} data sources: {', '.join(failed_apis)}",
                severity="critical" if len(failed_apis) > len(api_status)/2 else "warning",
                source_agent=self.name,
                recommendations=[
                    "Check internet connectivity",
                    "Verify API endpoints are operational",
                    "Consider using cached data temporarily",
                    "Enable backup data sources"
                ]
            ))
        
        return alerts

    async def _make_request_with_retry(self, url: str, params: dict = None, headers: dict = None) -> Optional[Dict[str, Any]]:
        """Make HTTP request with retry logic and better error handling"""
        for attempt in range(self.api_retry_attempts):
            try:
                connector = aiohttp.TCPConnector(limit=10, ttl_dns_cache=300)
                timeout = aiohttp.ClientTimeout(total=self.request_timeout)
                
                async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                    async with session.get(url, params=params, headers=headers) as response:
                        if response.status == 200:
                            content_type = response.headers.get('content-type', '')
                            if 'application/json' in content_type:
                                return await response.json()
                            else:
                                text_data = await response.text()
                                # Try to parse as JSON anyway
                                try:
                                    return json.loads(text_data)
                                except json.JSONDecodeError:
                                    logger.warning(f"Non-JSON response from {url}: {text_data[:200]}")
                                    return None
                        else:
                            logger.warning(f"HTTP {response.status} from {url} (attempt {attempt + 1})")
                            if attempt == self.api_retry_attempts - 1:
                                return None
                            await asyncio.sleep(2 ** attempt)  # Exponential backoff
            
            except asyncio.TimeoutError:
                logger.warning(f"Timeout accessing {url} (attempt {attempt + 1})")
            except Exception as e:
                logger.error(f"Error accessing {url} (attempt {attempt + 1}): {e}")
            
            if attempt < self.api_retry_attempts - 1:
                await asyncio.sleep(2 ** attempt)
        
        return None
    
    async def collect_usgs_data(self, site_codes: List[str] = None) -> Dict[str, Any]:
        """Collect real-time data from USGS Water Data API with current conditions"""
        self.has_attempted_collection = True

        if site_codes is None:
            # Major Texas watersheds - verified active sites from data_sources.py
            site_codes = [
                "08167000",  # Guadalupe River at Comfort, TX
                "08158000",  # Colorado River at Austin, TX
                "08116650",  # Brazos River near Rosharon, TX
                "08057000",  # Trinity River at Dallas, TX
                "08178000",  # San Antonio River at San Antonio, TX
                "08020000",  # Sabine River near Longview, TX
                "08041000",  # Neches River at Evadale, TX
                "08150000",  # Llano River at Llano, TX
                "08211000",  # Nueces River near Mathis, TX
            ]

        # Updated USGS API endpoint for instantaneous values
        base_url = "https://waterservices.usgs.gov/nwis/iv/"
        params = {
            'format': 'json',
            'sites': ','.join(site_codes),
            'parameterCd': '00060,00065',  # Discharge (CFS) and Gage height (ft)
            'period': 'PT6H',  # Last 6 hours for most current data
            'siteStatus': 'active'
        }

        data = await self._make_request_with_retry(base_url, params)
        if data:
            self.last_usgs_update = datetime.now(timezone.utc)
            processed_data = self._process_usgs_data(data)

            # Add metadata about data collection
            processed_data['_metadata'] = {
                'collection_time': datetime.now(timezone.utc).isoformat(),
                'sites_requested': len(site_codes),
                'sites_returned': len(processed_data) - 1,  # Exclude metadata
                'data_freshness': 'real-time',
                'source': 'USGS Water Services API'
            }

            return processed_data

        logger.error("All USGS API attempts failed")
        return {
            '_metadata': {
                'collection_time': datetime.now(timezone.utc).isoformat(),
                'sites_requested': len(site_codes),
                'sites_returned': 0,
                'status': 'failed',
                'source': 'USGS Water Services API'
            }
        }
    
    async def collect_noaa_flood_data(self) -> Dict[str, Any]:
        """Collect real-time flood alerts and forecasts from NOAA"""
        self.has_attempted_collection = True
        try:
            # Collect current active flood alerts for Texas
            base_url = "https://api.weather.gov/alerts/active"
            params = {
                'area': 'TX',
                'status': 'actual',
                'message_type': 'alert'
            }

            headers = {
                'User-Agent': 'FloodPredictionSystem/1.0 (github.com/flood-prediction)',
                'Accept': 'application/geo+json'
            }

            data = await self._make_request_with_retry(base_url, params, headers)
            if data:
                self.last_noaa_update = datetime.now(timezone.utc)
                processed_data = self._process_noaa_data(data)

                # Filter for flood-related alerts
                flood_alerts = []
                flood_keywords = ['flood', 'flash flood', 'flooding', 'river', 'stream']

                for alert in processed_data.get('alerts', []):
                    event = alert.get('event', '').lower()
                    if any(keyword in event for keyword in flood_keywords):
                        flood_alerts.append(alert)

                processed_data['alerts'] = flood_alerts
                processed_data['_metadata'] = {
                    'collection_time': datetime.now(timezone.utc).isoformat(),
                    'total_alerts': len(flood_alerts),
                    'data_freshness': 'real-time',
                    'source': 'NOAA Weather Service API'
                }

                return processed_data

            # Fallback to tides data if alerts API fails
            logger.warning("NOAA alerts API failed, falling back to tides data")
            return await self._collect_noaa_tides_data()

        except Exception as e:
            logger.error(f"Error collecting NOAA data: {e}")
            return {
                'alerts': [],
                'forecasts': [],
                '_metadata': {
                    'collection_time': datetime.now(timezone.utc).isoformat(),
                    'status': 'failed',
                    'error': str(e),
                    'source': 'NOAA Weather Service API'
                }
            }
    
    async def _collect_noaa_tides_data(self) -> Dict[str, Any]:
        """Fallback to NOAA Tides and Currents API"""
        # Texas coastal stations for water levels
        stations = [
            "8771450",  # Galveston Pier 21
            "8779770",  # Corpus Christi
            "8775870",  # Port Arthur
            "8770822"   # Texas Point, Sabine Pass
        ]
        
        tide_data = {}
        base_url = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"
        
        for station in stations:
            params = {
                'product': 'water_level',
                'application': 'FloodPredictionSystem',
                'station': station,
                'date': 'latest',
                'datum': 'MLLW',
                'units': 'english',
                'time_zone': 'lst_ldt',
                'format': 'json'
            }
            
            data = await self._make_request_with_retry(base_url, params)
            if data:
                tide_data[station] = data
        
        if tide_data:
            self.last_noaa_update = datetime.now(timezone.utc)
        
        return tide_data
    
    async def collect_weather_data(self) -> Dict[str, Any]:
        """Collect real-time weather data from Open-Meteo with current conditions"""
        self.has_attempted_collection = True
        try:
            # Texas major cities coordinates for weather context
            locations = [
                {"name": "Houston", "lat": 29.7604, "lon": -95.3698},
                {"name": "Dallas", "lat": 32.7767, "lon": -96.7970},
                {"name": "Austin", "lat": 30.2672, "lon": -97.7431},
                {"name": "San Antonio", "lat": 29.4241, "lon": -98.4936},
                {"name": "Fort Worth", "lat": 32.7555, "lon": -97.3308},
                {"name": "El Paso", "lat": 31.7619, "lon": -106.4850}
            ]

            weather_data = {}
            base_url = "https://api.open-meteo.com/v1/forecast"

            for location in locations:
                params = {
                    'latitude': location['lat'],
                    'longitude': location['lon'],
                    'current': 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,cloud_cover',
                    'hourly': 'precipitation_probability,precipitation,rain,weather_code,temperature_2m',
                    'daily': 'precipitation_sum,rain_sum,precipitation_probability_max,weather_code,temperature_2m_max,temperature_2m_min',
                    'forecast_days': 3,
                    'timezone': 'America/Chicago',
                    'temperature_unit': 'fahrenheit',
                    'precipitation_unit': 'inch'
                }

                data = await self._make_request_with_retry(base_url, params)
                if data:
                    # Extract current conditions
                    current = data.get('current', {})
                    current_rain_mm = current.get('rain', 0) or current.get('precipitation', 0)
                    current_rain_in = current_rain_mm * 0.0393701  # mm to inches

                    # Extract next 24h forecast
                    hourly = data.get('hourly', {})
                    next_24h_precip = sum(hourly.get('precipitation', [])[:24]) if hourly.get('precipitation') else 0

                    weather_data[location['name']] = {
                        'location': location,
                        'current_conditions': {
                            'temperature_f': current.get('temperature_2m', 0),
                            'humidity_percent': current.get('relative_humidity_2m', 0),
                            'current_precipitation_mm': current_rain_mm,
                            'current_precipitation_in': round(current_rain_in, 2),
                            'weather_code': current.get('weather_code', 0),
                            'cloud_cover_percent': current.get('cloud_cover', 0),
                            'observation_time': current.get('time', '')
                        },
                        'forecast_24h': {
                            'total_precipitation_mm': round(next_24h_precip, 2),
                            'total_precipitation_in': round(next_24h_precip * 0.0393701, 2)
                        },
                        'raw_forecast': data,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }

            if weather_data:
                self.last_weather_update = datetime.now(timezone.utc)

                # Add metadata
                weather_data['_metadata'] = {
                    'collection_time': datetime.now(timezone.utc).isoformat(),
                    'locations_collected': len(weather_data) - 1,
                    'data_freshness': 'real-time',
                    'source': 'Open-Meteo API'
                }

            return weather_data

        except Exception as e:
            logger.error(f"Error collecting weather data: {e}")
            return {
                '_metadata': {
                    'collection_time': datetime.now(timezone.utc).isoformat(),
                    'status': 'failed',
                    'error': str(e),
                    'source': 'Open-Meteo API'
                }
            }
    
    async def collect_flood_forecast_data(self) -> Dict[str, Any]:
        """Collect flood forecast data from Open-Meteo Flood API"""
        self.has_attempted_collection = True
        try:
            # Major Texas river locations for flood forecasting
            locations = [
                {"name": "Trinity River Dallas", "lat": 32.7767, "lon": -96.7970},
                {"name": "Trinity River Houston", "lat": 29.7604, "lon": -95.3698},
                {"name": "Brazos River College Station", "lat": 30.6280, "lon": -96.3344},
                {"name": "Colorado River Austin", "lat": 30.2672, "lon": -97.7431},
                {"name": "San Antonio River", "lat": 29.4241, "lon": -98.4936},
                {"name": "Guadalupe River", "lat": 29.8833, "lon": -97.9425},
                {"name": "Sabine River", "lat": 32.0835, "lon": -94.1266}
            ]
            
            flood_data = {}
            base_url = "https://flood-api.open-meteo.com/v1/flood"
            
            for location in locations:
                params = {
                    'latitude': location['lat'],
                    'longitude': location['lon'],
                    'daily': 'river_discharge,river_discharge_mean,river_discharge_median',
                    'forecast_days': 7
                }
                
                data = await self._make_request_with_retry(base_url, params)
                if data:
                    flood_data[location['name']] = {
                        'location': location,
                        'forecast': data,
                        'timestamp': datetime.now(timezone.utc).isoformat()
                    }
            
            return flood_data
        
        except Exception as e:
            logger.error(f"Error collecting flood forecast data: {e}")
            return {}
    
    def _process_usgs_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process raw USGS data into standardized format with real-time values"""
        processed = {}

        try:
            time_series = raw_data.get('value', {}).get('timeSeries', [])

            for series in time_series:
                site_info = series.get('sourceInfo', {})
                site_code = site_info.get('siteCode', [{}])[0].get('value', '')
                site_name = site_info.get('siteName', '')

                # Get parameter info
                param_info = series.get('variable', {})
                param_code = param_info.get('variableCode', [{}])[0].get('value', '')
                param_name = param_info.get('variableName', '')
                unit = param_info.get('unit', {}).get('unitCode', '')

                values = series.get('values', [{}])[0].get('value', [])
                if values:
                    latest_value = values[-1]
                    value_str = latest_value.get('value', '0')

                    # Handle non-numeric values and negative indicators
                    try:
                        numeric_value = float(value_str)
                        # USGS uses -999999 for missing data
                        if numeric_value < -999990:
                            numeric_value = 0.0
                    except (ValueError, TypeError):
                        numeric_value = 0.0

                    timestamp = latest_value.get('dateTime', '')

                    if site_code not in processed:
                        geo_location = site_info.get('geoLocation', {}).get('geogLocation', {})
                        processed[site_code] = {
                            'site_code': site_code,
                            'name': site_name,
                            'latitude': float(geo_location.get('latitude', 0)) if geo_location.get('latitude') else None,
                            'longitude': float(geo_location.get('longitude', 0)) if geo_location.get('longitude') else None,
                            'parameters': {},
                            'current_streamflow_cfs': 0.0,
                            'current_gage_height_ft': 0.0,
                            'last_measurement_time': timestamp
                        }

                    processed[site_code]['parameters'][param_code] = {
                        'name': param_name,
                        'value': numeric_value,
                        'unit': unit,
                        'timestamp': timestamp,
                        'quality': latest_value.get('qualifiers', ['A'])[0] if latest_value.get('qualifiers') else 'A'
                    }

                    # Store streamflow and gage height at top level for easy access
                    if param_code == '00060':  # Discharge (CFS)
                        processed[site_code]['current_streamflow_cfs'] = numeric_value
                    elif param_code == '00065':  # Gage height (ft)
                        processed[site_code]['current_gage_height_ft'] = numeric_value

            # Calculate data age for each site
            now = datetime.now(timezone.utc)
            for site_code in processed:
                if site_code != '_metadata':
                    last_time_str = processed[site_code].get('last_measurement_time', '')
                    try:
                        last_time = datetime.fromisoformat(last_time_str.replace('Z', '+00:00'))
                        age_minutes = (now - last_time).total_seconds() / 60
                        processed[site_code]['data_age_minutes'] = round(age_minutes, 1)
                    except:
                        processed[site_code]['data_age_minutes'] = None

        except Exception as e:
            logger.error(f"Error processing USGS data: {e}")

        return processed
    
    def _process_noaa_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process raw NOAA data into standardized format"""
        processed = {
            'alerts': [],
            'forecasts': [],
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        try:
            features = raw_data.get('features', [])
            
            for feature in features:
                properties = feature.get('properties', {})
                alert = {
                    'id': properties.get('id'),
                    'event': properties.get('event'),
                    'headline': properties.get('headline'),
                    'description': properties.get('description'),
                    'instruction': properties.get('instruction'),
                    'severity': properties.get('severity'),
                    'urgency': properties.get('urgency'),
                    'areas': properties.get('areaDesc'),
                    'effective': properties.get('effective'),
                    'expires': properties.get('expires')
                }
                processed['alerts'].append(alert)
        
        except Exception as e:
            logger.error(f"Error processing NOAA data: {e}")
        
        return processed
    
    def _calculate_data_freshness(self) -> float:
        """Calculate overall data freshness score (0-100)"""
        now = datetime.now(timezone.utc)
        scores = []
        
        # If no data has been collected yet, show age since initialization
        if not self.has_attempted_collection:
            init_age_minutes = (now - self.initialized_time).total_seconds() / 60
            # Start at 100% and decrease 5% per minute for first 20 minutes
            initialization_score = max(0, 100 - (init_age_minutes * 5))
            return initialization_score
        
        # Check each data source freshness
        if self.last_usgs_update:
            age_minutes = (now - self.last_usgs_update).total_seconds() / 60
            usgs_score = max(0, 100 - (age_minutes / 60) * 10)  # Decrease 10% per hour
            scores.append(usgs_score)
        else:
            # If attempted but no successful update, score based on time since attempt
            scores.append(0)
        
        if self.last_noaa_update:
            age_minutes = (now - self.last_noaa_update).total_seconds() / 60
            noaa_score = max(0, 100 - (age_minutes / 120) * 10)  # More lenient for NOAA
            scores.append(noaa_score)
        else:
            scores.append(0)
        
        if self.last_weather_update:
            age_minutes = (now - self.last_weather_update).total_seconds() / 60
            weather_score = max(0, 100 - (age_minutes / 60) * 5)  # Weather data can be less fresh
            scores.append(weather_score)
        else:
            scores.append(0)
        
        return sum(scores) / len(scores) if scores else 0
    
    def _calculate_data_quality(self) -> float:
        """Calculate data quality score based on completeness and recency"""
        quality_factors = []
        
        # API availability factor
        api_count = 0
        working_count = 0
        if hasattr(self, '_last_api_status'):
            api_count = len(self._last_api_status)
            working_count = sum(1 for status in self._last_api_status.values() if status)
        
        if api_count > 0:
            api_score = (working_count / api_count) * 10
            quality_factors.append(api_score)
        
        # Data freshness factor
        freshness = self._calculate_data_freshness()
        freshness_score = (freshness / 100) * 10
        quality_factors.append(freshness_score)
        
        # Data completeness factor (simplified)
        completeness_score = 8.0  # Baseline score
        quality_factors.append(completeness_score)
        
        return sum(quality_factors) / len(quality_factors) if quality_factors else 0.0
    
    def _get_freshness_trend(self) -> Optional[str]:
        """Get trend indicator for data freshness"""
        # This would compare with previous freshness scores stored in database
        return None
    
    async def _check_api_status(self) -> Dict[str, bool]:
        """Check if APIs are accessible with improved endpoint validation"""
        apis = {
            'USGS': 'https://waterservices.usgs.gov/nwis/iv/',
            'NOAA_Weather': 'https://api.weather.gov/alerts',
            'NOAA_Tides': 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter',
            'OpenMeteo_Weather': 'https://api.open-meteo.com/v1/forecast',
            'OpenMeteo_Flood': 'https://flood-api.open-meteo.com/v1/flood'
        }

        status = {}

        for name, url in apis.items():
            try:
                # Setup default test params
                test_params = {}
                headers = {}

                if 'usgs' in url.lower():
                    test_params = {
                        'format': 'json',
                        'sites': '08057000',
                        'parameterCd': '00060',
                        'period': 'P1D'
                    }

                elif 'weather.gov' in url:
                    test_params = {'area': 'TX', 'limit': '1'}
                    headers = {
                        'User-Agent': 'FloodPredictionSystem/1.0 (contact@floodprediction.com)',
                        'Accept': 'application/geo+json'
                    }

                elif 'tidesandcurrents' in url:
                    test_params = {
                        'product': 'water_level',
                        'application': 'FloodPredictionSystem',
                        'station': '8771450',
                        'date': 'latest',
                        'datum': 'MLLW',
                        'units': 'english',
                        'time_zone': 'lst_ldt',
                        'format': 'json'
                    }

                elif 'open-meteo.com' in url and 'flood' not in url:
                    test_params = {
                        'latitude': '32.78',
                        'longitude': '-96.80',
                        'current': 'temperature_2m'
                    }

                elif 'flood-api' in url:
                    test_params = {
                        'latitude': '32.78',
                        'longitude': '-96.80',
                        'daily': 'river_discharge',
                        'forecast_days': 3
                    }

                connector = aiohttp.TCPConnector(limit=5)
                timeout = aiohttp.ClientTimeout(total=10)

                async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                    async with session.get(url, params=test_params, headers=headers) as response:
                        status[name] = response.status < 400
                        if not status[name]:
                            logger.warning(f"{name} API returned HTTP {response.status}")
            except Exception as e:
                logger.debug(f"API check failed for {name}: {e}")
                status[name] = False

        self._last_api_status = status
        return status
    
    def _is_data_stale(self) -> bool:
        """Check if any data is considered stale"""
        now = datetime.now(timezone.utc)
        stale_threshold = timedelta(hours=2)
        
        if self.last_usgs_update and (now - self.last_usgs_update) > stale_threshold:
            return True
        if self.last_noaa_update and (now - self.last_noaa_update) > stale_threshold * 2:  # More lenient
            return True
        if self.last_weather_update and (now - self.last_weather_update) > stale_threshold:
            return True
        
        return False
    
    def _get_quality_change(self) -> float:
        """Get change in data quality score"""
        # This would compare with previous quality scores stored in database
        return 0.0
    
    def _calculate_update_frequency(self) -> int:
        """Calculate updates per hour based on check interval"""
        if self.check_interval:
            return int(3600 / self.check_interval)  # 3600 seconds per hour
        return 12  # Default: every 5 minutes = 12 per hour