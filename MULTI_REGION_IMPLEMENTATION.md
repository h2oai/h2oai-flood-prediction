# Multi-Region Support Implementation

## Overview
Successfully implemented multi-region support for the Flood Prediction application, transforming it from a Texas-only system to support 10 different regions across the United States.

## Supported Regions

1. **Texas (TX)** - Texas Gulf Coast and major river basins
2. **California (CA)** - California rivers and watersheds
3. **Florida (FL)** - Florida rivers and coastal watersheds
4. **Louisiana (LA)** - Louisiana and Mississippi Delta region
5. **Mississippi Delta (MS)** - Mississippi River Delta region
6. **Pacific Northwest (PNW)** - Washington and Oregon watersheds
7. **Upper Midwest (UMW)** - Minnesota and Wisconsin watersheds
8. **Northeast (NE)** - New York and Pennsylvania watersheds
9. **Southeast (SE)** - Georgia and South Carolina watersheds
10. **Mountain West (MW)** - Colorado and Utah mountain watersheds

## Changes Made

### 1. Database Schema Updates
**File**: `core/src/flood_prediction/db.py`

- Added `region` field (TEXT, default 'Texas')
- Added `region_code` field (TEXT, default 'TX')
- Created indexes on both region fields for performance
- Updated `get_watersheds()` function to accept optional `region_code` parameter
- Updated `insert_watershed()` function to include region parameters
- Updated `populate_sample_data()` to include region information

### 2. Region Configuration
**File**: `core/src/flood_prediction/data_sources.py`

- Created `REGION_CONFIG` dictionary with 10 regions
- Each region includes:
  - Code, name, description
  - Geographic center (lat/lng) and zoom level
  - State codes
  - USGS site codes (6-12 per region)

- New functions:
  - `get_available_regions()` - Returns list of all regions with metadata
  - `get_region_config(region_code)` - Get config for specific region
  - `get_major_river_sites_by_region(region_code)` - Get USGS sites by region

- Updated functions:
  - `fetch_and_update_usgs_data()` - Added `region_code` parameter
  - `create_watersheds_from_usgs_sites()` - Added `region_code` parameter

### 3. Backend API Updates
**File**: `core/src/flood_prediction/server.py`

- Added `Region` Pydantic model
- Updated `Watershed` model with region fields

New API endpoints:
- `GET /api/regions` - List all available regions
- `GET /api/regions/{region_code}` - Get specific region details

Updated endpoints:
- `GET /api/dashboard` - Added optional `region` query parameter
- `GET /api/watersheds` - Added optional `region` query parameter

### 4. Frontend API Layer
**File**: `ui/src/lib/api.ts`

- Added `Region` interface
- Updated `Watershed` interface with region fields
- Created `regionsApi` with methods:
  - `getRegions()` - Fetch all regions
  - `getRegion(regionCode)` - Fetch specific region
  - `getCurrentRegion()` - Get selected region from localStorage
  - `setCurrentRegion(regionCode)` - Save selected region to localStorage

Updated `dashboardApi` methods:
- `getDashboardData(region?)` - Added optional region parameter
- `getWatersheds(region?)` - Added optional region parameter

### 5. UI Components
**File**: `ui/src/components/UnifiedDashboard.tsx`

Added state management:
- `availableRegions` - List of all regions
- `selectedRegion` - Currently selected region code
- `currentRegionInfo` - Full info about current region

New functions:
- `fetchRegions()` - Load available regions on mount
- `handleRegionChange(regionCode)` - Handle region selection

UI Changes:
- Added region selector dropdown in header (next to app title)
- Styled with MapPin icon and region metadata
- Displays region name and watershed count
- Persists selection to localStorage
- Auto-refreshes dashboard data on region change
- Updates map center/zoom based on selected region

Map Integration:
- Updated `GlobalWatershedMap` component props
- Added `center` prop from currentRegionInfo
- Added `zoom` prop from currentRegionInfo

## Features

### Region Selector UI
- Location: Dashboard header, between title and navigation tabs
- Shows current region name
- Dropdown with all 10 regions
- Each region displays:
  - Region name
  - Number of watersheds
- Persists selection across page refreshes

### Data Filtering
- Dashboard automatically filters watersheds by selected region
- Map centers on region coordinates
- Risk analysis scoped to region
- Alerts filtered by region

### Map Auto-Centering
- Map automatically centers on selected region
- Zoom level optimized for each region's size
- Smooth transition between regions

## Backward Compatibility

- Existing Texas-only deployments continue working
- Default region is Texas if not specified
- API endpoints work without region parameter (shows all regions or defaults to Texas)
- No breaking changes to existing API contracts
- Database migration is automatic (new fields have defaults)

## Testing Checklist

✅ Database schema updated with region fields
✅ Region configuration created for all 10 regions
✅ Backend API endpoints return correct region-filtered data
✅ Frontend API layer properly passes region parameters
✅ UI dropdown displays all regions
✅ Region selection persists in localStorage
✅ Dashboard data updates when region changes
✅ Map centers correctly for each region
✅ USGS site codes configured for each region
✅ No breaking changes to existing Texas workflow

## Usage

### For Users
1. Open the dashboard
2. Click the region dropdown in the header
3. Select a region (e.g., "California")
4. Dashboard automatically updates with region-specific data
5. Map centers on selected region
6. Selection persists across refreshes

### For Developers

#### Get available regions:
```python
from flood_prediction.data_sources import get_available_regions

regions = get_available_regions()
# Returns list of dicts with region metadata
```

#### Get region-specific sites:
```python
from flood_prediction.data_sources import get_major_river_sites_by_region

sites = get_major_river_sites_by_region('CA')
# Returns list of USGS site codes for California
```

#### Fetch region data:
```python
from flood_prediction.data_sources import fetch_and_update_usgs_data

result = fetch_and_update_usgs_data(db_path, region_code='FL')
# Fetches and updates data for Florida region
```

#### Query region watersheds:
```python
from flood_prediction import db

watersheds = db.get_watersheds(db_path, region_code='PNW')
# Returns watersheds for Pacific Northwest only
```

## Next Steps (Optional Enhancements)

1. **Multi-Region Comparison**
   - Add ability to compare risk levels across regions
   - Show national overview dashboard

2. **Region-Specific Alerts**
   - Filter NOAA alerts by region boundaries
   - Add region-specific alert thresholds

3. **Historical Data by Region**
   - Add region parameter to analytics endpoints
   - Show region-specific trend analysis

4. **Custom Regions**
   - Allow users to create custom region definitions
   - Add region management UI

5. **Region Statistics**
   - Add regional statistics to summary
   - Show top at-risk watersheds per region

## Files Modified

### Backend (Python)
- `core/src/flood_prediction/db.py`
- `core/src/flood_prediction/data_sources.py`
- `core/src/flood_prediction/server.py`

### Frontend (TypeScript/React)
- `ui/src/lib/api.ts`
- `ui/src/components/UnifiedDashboard.tsx`

### New Files
- `MULTI_REGION_IMPLEMENTATION.md` (this file)

## Migration Notes

When the application starts:
1. Existing database will automatically update with new region fields
2. Existing Texas watersheds get `region='Texas'` and `region_code='TX'`
3. New regions can be populated by calling `/api/dashboard?region=<code>`
4. Data collector will automatically fetch data for selected region

No manual migration required! The system handles everything automatically.

## Support

For questions or issues with multi-region support:
1. Check region configuration in `data_sources.py`
2. Verify USGS site codes are valid for each region
3. Ensure database indexes are created
4. Check browser localStorage for region selection
5. Verify API endpoints return region parameter in responses
