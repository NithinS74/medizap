// src/components/NearbyMap.jsx (Confirm this structure or modify your file to match it)

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../contexts/AuthContext';
import { app, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import '../styles/NearbyMap.css'; // Make sure this import is present

// Fix for Leaflet's default icon issue with Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});


const NearbyMap = () => {
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const markers = useRef([]);

    const { currentUser } = useAuth();
    const [profileLocation, setProfileLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [inputPincode, setInputPincode] = useState('');
    const [currentSearchLocation, setCurrentSearchLocation] = useState(null);

    const defaultCenter = { lat: 12.9716, lng: 77.5946 }; // Bengaluru, Karnataka, India
    const defaultLocationName = "Bengaluru, India";

    const appId = app?.options?.projectId || 'default-app-id';

    const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

    const clearMarkers = useCallback(() => {
        markers.current.forEach(marker => {
            if (mapInstance.current && mapInstance.current.hasLayer(marker)) {
                mapInstance.current.removeLayer(marker);
            }
        });
        markers.current = [];
    }, []);

    const addMarker = useCallback((latlng, title, iconUrl = null) => {
        const markerOptions = {};
        if (iconUrl) {
            markerOptions.icon = L.icon({
                iconUrl: iconUrl,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32]
            });
        }
        const marker = L.marker(latlng, markerOptions).bindPopup(title);
        markers.current.push(marker);
        if (mapInstance.current) {
            marker.addTo(mapInstance.current);
        }
        return marker;
    }, []);

    const geocodeLocation = useCallback(async (locationQuery) => {
        if (!locationQuery) return null;
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationQuery)}&format=json&limit=1`;
        try {
            const response = await fetch(nominatimUrl);
            const data = await response.json();
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon),
                    name: data[0].display_name
                };
            }
            return null;
        } catch (e) {
            console.error("Error geocoding location with Nominatim:", e);
            return null;
        }
    }, []);

    const fetchPoisFromOverpass = useCallback(async (centerLat, centerLng, radius = 5000) => {
        const initialMarkersCount = markers.current.length;
        clearMarkers();
        if (mapInstance.current && currentSearchLocation && initialMarkersCount > 0) {
            addMarker([currentSearchLocation.lat, currentSearchLocation.lng], `You are here (approx): ${currentSearchLocation.name}`, 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png');
        }

        setLoading(true);
        setError('');

        const queries = [
            `node(around:${radius},${centerLat},${centerLng})[amenity=pharmacy];out body;`,
            `way(around:${radius},${centerLat},${centerLng})[amenity=pharmacy];out body;`,
            `rel(around:${radius},${centerLat},${centerLng})[amenity=pharmacy];out body;`,
            `node(around:${radius},${centerLat},${centerLng})[amenity=hospital];out body;`,
            `way(around:${radius},${centerLat},${centerLng})[amenity=hospital];out body;`,
            `rel(around:${radius},${centerLat},${centerLng})[amenity=hospital];out body;`,
        ];

        let foundPois = 0;

        for (const queryPart of queries) {
            const overpassQuery = `
                [out:json];
                ${queryPart}
            `;
            try {
                const response = await fetch(OVERPASS_API_URL, {
                    method: 'POST',
                    body: overpassQuery,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                const data = await response.json();
                if (data.elements) {
                    data.elements.forEach(element => {
                        const lat = element.lat || (element.center && element.center.lat);
                        const lng = element.lon || (element.center && element.center.lon);
                        const name = element.tags.name || element.tags.operator || element.type;
                        const amenityType = element.tags.amenity;

                        if (lat && lng && name && (amenityType === 'pharmacy' || amenityType === 'hospital')) {
                            let iconUrl;
                            if (amenityType === 'pharmacy') {
                                iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png';
                            } else {
                                iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
                            }
                            addMarker([lat, lng], name, iconUrl);
                            foundPois++;
                        }
                    });
                }
            } catch (e) {
                console.error("Error fetching data from Overpass API:", e);
                setError("Failed to fetch real data from OpenStreetMap. Please try again later.");
                break;
            }
        }
        if (foundPois === 0 && !error) {
              setError("No pharmacies or hospitals found in this area on OpenStreetMap. Try a different pincode or expand the search radius.");
        }
        setLoading(false);
    }, [addMarker, clearMarkers, setError, currentSearchLocation]);

    useEffect(() => {
        const initMap = () => {
            if (mapContainerRef.current && !mapInstance.current) {
                const rect = mapContainerRef.current.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    console.warn("Map container has zero dimensions. Retrying map initialization...");
                    setTimeout(initMap, 200);
                    return;
                }
                console.log("Initializing Leaflet map.");
                mapInstance.current = L.map(mapContainerRef.current).setView([defaultCenter.lat, defaultCenter.lng], 12);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(mapInstance.current);
                mapInstance.current.invalidateSize();
            }
        };
        initMap();

        const fetchProfileData = async () => {
            setLoading(true);
            setError('');
            if (!currentUser?.uid || !db) {
                setError("User not authenticated or Firestore not available. Cannot load profile location.");
                setLoading(false);
                return;
            }
            const userProfileDocRef = doc(db, `artifacts/${appId}/users/${currentUser.uid}/profile_data`, currentUser.uid);
            try {
                const docSnap = await getDoc(userProfileDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const city = data.preferredDeliveryAddress?.city || data.address?.split(',').pop()?.trim();
                    const country = data.preferredDeliveryAddress?.country?.trim();
                    if (city && country) {
                        setProfileLocation({ city, country });
                        console.log("Profile location found:", city, country);
                    } else {
                        setError("City/Country not found in profile address. Please enter a pincode or update your profile.");
                        setProfileLocation(null);
                    }
                } else {
                    setError("Profile data not found. Please enter a pincode to find nearby places.");
                    setProfileLocation(null);
                }
            } catch (err) {
                console.error("Error fetching profile data:", err);
                setError("Failed to fetch profile location. Please enter a pincode.");
                setProfileLocation(null);
            } finally {
                setLoading(false);
            }
        };
        fetchProfileData();

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [currentUser?.uid, db, appId, defaultCenter.lat, defaultCenter.lng]);

    const updateMapContent = useCallback(async (locationSource) => {
        setLoading(true);
        setError('');
        clearMarkers();

        let center = defaultCenter;
        let locationName = defaultLocationName;
        let geocodedResult = null;

        if (locationSource.type === 'pincode' && locationSource.value) {
            console.log("Attempting to geocode pincode:", locationSource.value);
            geocodedResult = await geocodeLocation(locationSource.value);
            if (geocodedResult) {
                center = { lat: geocodedResult.lat, lng: geocodedResult.lng };
                locationName = geocodedResult.name;
                setError('');
            } else {
                setError(`Could not find coordinates for pincode: ${locationSource.value}. Using default location.`);
            }
        } else if (locationSource.type === 'profile' && locationSource.value?.city && locationSource.value?.country) {
            console.log("Attempting to geocode profile location:", locationSource.value.city, locationSource.value.country);
            geocodedResult = await geocodeLocation(`${locationSource.value.city}, ${locationSource.value.country}`);
            if (geocodedResult) {
                center = { lat: geocodedResult.lat, lng: geocodedResult.lng };
                locationName = geocodedResult.name;
                setError('');
            } else {
                setError(`Could not find coordinates for profile location: ${locationSource.value.city}, ${locationSource.value.country}. Please enter a pincode or try updating your profile. Using default location.`);
            }
        } else {
            setError("No valid location source provided. Using default location.");
        }

        if (mapInstance.current) {
            mapInstance.current.setView([center.lat, center.lng], 14);
            setCurrentSearchLocation({ lat: center.lat, lng: center.lng, name: locationName });
            addMarker([center.lat, center.lng], `You are here (approx): ${locationName}`, 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png');
            await fetchPoisFromOverpass(center.lat, center.lng);
        } else {
              setLoading(false);
        }
    }, [geocodeLocation, clearMarkers, addMarker, fetchPoisFromOverpass, defaultCenter]);

    useEffect(() => {
        if (mapInstance.current && !loading) {
            if (!inputPincode && profileLocation) {
                updateMapContent({ type: 'profile', value: profileLocation });
            } else if (!inputPincode && !profileLocation && !currentSearchLocation) {
                updateMapContent({ type: 'default' });
            }
        }
    }, [profileLocation, loading, inputPincode, updateMapContent, currentSearchLocation]);

    const handlePincodeChange = (e) => {
        setInputPincode(e.target.value);
    };

    const handleSearchByPincode = () => {
        if (inputPincode.trim()) {
            updateMapContent({ type: 'pincode', value: inputPincode.trim() });
        } else {
            setError("Please enter a pincode to search.");
        }
    };


    return (
        <div className="nearby-map-container">
            {/* THIS IS THE map-header SECTION */}
            <div className="map-header">
                <h1 className="map-title">Nearby Pharmacies & Hospitals</h1>

                <div className="pincode-input-section">
                    <input
                        id="pincode-input"
                        type="text"
                        placeholder="Enter Pincode"
                        value={inputPincode}
                        onChange={handlePincodeChange}
                        className="pincode-input"
                        aria-label="Enter Pincode"
                    />
                    <button onClick={handleSearchByPincode} className="search-button">
                        Search
                    </button>
                </div>
            </div> {/* END .map-header */}

            {loading && <div className="map-loading">Loading map and finding nearby places...</div>}
            {error && <div className="map-error">{error}</div>}

            <div ref={mapContainerRef} className="map-canvas"></div>

            {!loading && (
                <p className="map-disclaimer">
                    Showing results near: {currentSearchLocation ? currentSearchLocation.name : defaultLocationName}.
                    <br />
                    <span className="disclaimer-note">
                        (Data provided by OpenStreetMap via Overpass API. Locations may not be exhaustive or perfectly accurate. Please verify directly with establishments.)
                    </span>
                </p>
            )}
        </div>
    );
};

export default NearbyMap;