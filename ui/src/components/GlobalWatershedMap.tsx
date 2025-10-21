'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Watershed } from '@/lib/api'

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Custom risk-based icons
const createRiskIcon = (riskLevel: string) => {
    const colors = {
        'High': '#ef4444',
        'Moderate': '#f59e0b', 
        'Low': '#22c55e',
        'Unknown': '#6b7280'
    }
    
    const color = colors[riskLevel as keyof typeof colors] || colors.Unknown
    
    return L.divIcon({
        html: `<div style="
            background-color: ${color};
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>`,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    })
}

// Component to control map view (center and zoom or fit bounds)
const MapController = ({
    watersheds,
    center,
    zoom
}: {
    watersheds: Watershed[]
    center?: [number, number]
    zoom?: number
}) => {
    const map = useMap()

    useEffect(() => {
        // If center and zoom are provided, use them
        if (center && zoom) {
            map.setView(center, zoom)
        } else if (watersheds.length > 0) {
            // Otherwise, fit bounds to watersheds
            const validCoords = watersheds.filter(w =>
                w.location_lat && w.location_lng &&
                !isNaN(w.location_lat) && !isNaN(w.location_lng)
            )

            if (validCoords.length > 0) {
                const bounds = L.latLngBounds(
                    validCoords.map(w => [w.location_lat!, w.location_lng!])
                )
                map.fitBounds(bounds, { padding: [20, 20] })
            }
        }
    }, [watersheds, center, zoom, map])

    return null
}

interface GlobalWatershedMapProps {
    watersheds: Watershed[]
    height?: string
    center?: [number, number]
    zoom?: number
    onWatershedClick?: (watershed: Watershed) => void
}

export default function GlobalWatershedMap({
    watersheds,
    height = '400px',
    center,
    zoom,
    onWatershedClick
}: GlobalWatershedMapProps) {
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <div 
                className="bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center"
                style={{ height }}
            >
                <div className="text-gray-500 dark:text-gray-400">Loading map...</div>
            </div>
        )
    }

    const validWatersheds = watersheds.filter(w => 
        w.location_lat && w.location_lng && 
        !isNaN(w.location_lat) && !isNaN(w.location_lng)
    )

    if (validWatersheds.length === 0) {
        return (
            <div 
                className="bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center"
                style={{ height }}
            >
                <div className="text-gray-500 dark:text-gray-400">No watershed coordinates available</div>
            </div>
        )
    }

    // Use provided center/zoom or default to Texas
    const mapCenter = center || [31.0, -100.0]
    const mapZoom = zoom || 6

    return (
        <div style={{ height }} className="rounded-lg overflow-hidden">
            <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                style={{ height: '100%', width: '100%' }}
                className="rounded-lg"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    className="map-tiles"
                />

                <MapController watersheds={validWatersheds} center={center} zoom={zoom} />
                
                {validWatersheds.map((watershed) => (
                    <Marker
                        key={watershed.id}
                        position={[watershed.location_lat!, watershed.location_lng!]}
                        icon={createRiskIcon(watershed.current_risk_level)}
                        eventHandlers={{
                            click: () => onWatershedClick?.(watershed),
                        }}
                    >
                        <Popup>
                            <div className="min-w-[200px] p-2">
                                <h3 className="font-semibold text-gray-900 mb-2">{watershed.name}</h3>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Risk Level:</span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                            watershed.current_risk_level === 'High' ? 'bg-red-100 text-red-800' :
                                            watershed.current_risk_level === 'Moderate' ? 'bg-yellow-100 text-yellow-800' :
                                            watershed.current_risk_level === 'Low' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {watershed.current_risk_level}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Risk Score:</span>
                                        <span className="font-medium">{watershed.risk_score}/10</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Streamflow:</span>
                                        <span className="font-medium">{watershed.current_streamflow_cfs.toLocaleString()} CFS</span>
                                    </div>
                                    {watershed.trend && watershed.trend !== 'stable' && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Trend:</span>
                                            <span className={`font-medium ${
                                                watershed.trend === 'rising' ? 'text-red-600' : 'text-green-600'
                                            }`}>
                                                {watershed.trend}
                                            </span>
                                        </div>
                                    )}
                                    {watershed.data_source && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Source:</span>
                                            <span className="font-medium text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                                                {watershed.data_source.toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    )
}