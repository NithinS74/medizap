import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom"; // 1. IMPORT useNavigate
import { getAuth } from "firebase/auth"; // Import getAuth for API calls
import NearbyMap from "../components/NearbyMaps";
import "../styles/DashboardHome.css"; // Make sure this import is correct
const DashboardHome = () => {
    const { reminders, formatDateTime } = useOutletContext();
    const auth = getAuth(); // Initialize Firebase Auth
    const navigate = useNavigate(); // 2. INITIALIZE useNavigate
    // State for news updates
    const [newsUpdates, setNewsUpdates] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState(null);
    // NEW STATES for Medicine Availability Search
    const [medicineSearchName, setMedicineSearchName] = useState("");
    const [medicineSearchPincode, setMedicineSearchPincode] = useState("");
    const [medicineSearchResults, setMedicineSearchResults] = useState([]);
    const [medicineSearchLoading, setMedicineSearchLoading] = useState(false);
    const [medicineSearchError, setMedicineSearchError] = useState(null);
    const [medicineSearchMessage, setMedicineSearchMessage] = useState("");
    // Effect to fetch news from the API
    useEffect(() => {
        const fetchNews = async () => {
            try {
                setNewsLoading(true);
                const user = auth.currentUser;
                if (!user) {
                    throw new Error("Authentication required to fetch news.");
                }
                const idToken = await user.getIdToken();
                const response = await fetch("http://localhost:8000/news", {
                    headers: {
                        Authorization: `Bearer ${idToken}`,
                    },
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Failed to fetch news");
                }
                const data = await response.json();
                setNewsUpdates(data.articles); // Get all for marquee
            } catch (error) {
                console.error("Error fetching news:", error);
                setNewsError(error.message);
            } finally {
                setNewsLoading(false);
            }
        };
        fetchNews();
    }, [auth]);
    // Filter for truly upcoming, non-dismissed reminders for the dashboard card
    const actualUpcomingReminders = reminders
        .filter((rem) =>
            !rem.isDismissed && rem.dateTime.getTime() > Date.now()
        )
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
        .slice(0, 3);
    // UPDATED: Handle Medicine Search using the new glob search endpoint
    const handleMedicineSearch = async () => {
        if (!medicineSearchName.trim()) {
            setMedicineSearchError("Please enter a medicine name to search.");
            setMedicineSearchResults([]);
            setMedicineSearchMessage("");
            return;
        }
        setMedicineSearchLoading(true);
        setMedicineSearchError(null);
        setMedicineSearchResults([]);
        setMedicineSearchMessage("");
        try {
            const user = auth.currentUser;
            if (!user) {
                throw new Error(
                    "Authentication required to search for medicine.",
                );
            }
            const idToken = await user.getIdToken();
            // The payload now targets the /products/search endpoint.
            // Pincode is ignored; include_out_of_stock is hardcoded to true to show all results.
            const payload = {
                product_name: medicineSearchName.trim(),
                include_out_of_stock: true,
            };
            const response = await fetch(
                "http://localhost:8000/api/v1/products/search", // MODIFIED: Point to the glob search endpoint
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${idToken}`,
                    },
                    body: JSON.stringify(payload),
                },
            );
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.detail ||
                        "Failed to search for medicine availability",
                );
            }
            const data = await response.json();
            // MODIFIED: The response object has an 'available_products' key
            setMedicineSearchResults(data.available_products);
            setMedicineSearchMessage(data.message);
        } catch (error) {
            console.error("Error searching medicine availability:", error);
            setMedicineSearchError(error.message);
            setMedicineSearchMessage("Failed to retrieve availability.");
        } finally {
            setMedicineSearchLoading(false);
        }
    };
    return (
        <>
            {/* News & Updates Marquee/Top Bar */}
            <div className="dashboard-news-marquee-container">
                <span className="dashboard-news-marquee-title">
                    NEWS & UPDATES:
                </span>
                <div className="dashboard-news-marquee-wrapper">
                    <div className="dashboard-news-marquee-content">
                        {newsLoading
                            ? (
                                <span className="dashboard-news-marquee-item">
                                    Loading latest health news...
                                </span>
                            )
                            : newsError
                            ? (
                                <span className="dashboard-news-marquee-item error-message">
                                    Error fetching news: {newsError}
                                </span>
                            )
                            : newsUpdates.length > 0
                            ? (
                                Array(5)
                                    .fill(null)
                                    .map((_, repeatIndex) =>
                                        newsUpdates.map((news, index) => (
                                            <span
                                                key={`${
                                                    news.url || index
                                                }-${repeatIndex}`}
                                                className="dashboard-news-marquee-item"
                                            >
                                                <a
                                                    href={news.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {news.title}
                                                </a>
                                                {news.source_name &&
                                                    news.published_at && (
                                                    <span>
                                                        ({news.source_name} -
                                                        {" "}
                                                        {new Date(
                                                            news.published_at,
                                                        ).toLocaleDateString(
                                                            "en-US",
                                                            {
                                                                month: "short",
                                                                day: "numeric",
                                                            },
                                                        )}
                                                        )
                                                    </span>
                                                )}
                                            </span>
                                        ))
                                    )
                            )
                            : (
                                <span className="dashboard-news-marquee-item">
                                    No news available at the moment.
                                </span>
                            )}
                    </div>
                </div>
            </div>
            {/* THIS IS THE MAIN GRID CONTAINER */}
            <div className="dashboard-layout-with-map">
                {/* Map section - left column */}
                <div className="dashboard-map-container">
                    <NearbyMap />
                </div>
                {/* Right section for Reminders and other cards */}
                <div className="dashboard-secondary-content">
                    {/* Upcoming Reminders Card */}
                    <div className="dashboard-card appointments-card">
                        <h2 className="card-title">Upcoming Reminders</h2>
                        {actualUpcomingReminders.length > 0
                            ? (
                                <ul className="appointment-list">
                                    {actualUpcomingReminders.map((rem) => (
                                        <li
                                            key={rem.id}
                                            className="appointment-item"
                                        >
                                            <span className="appointment-time">
                                                {formatDateTime(rem.dateTime)}
                                            </span>
                                            <span className="appointment-description">
                                                {rem.title || rem.message}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )
                            : (
                                <p className="no-data-message">
                                    No upcoming reminders.
                                </p>
                            )}
                        {/* Button for Upcoming Reminders */}
                        <div className="reminders-button-container">
                            <button
                                className="reminders-button"
                                onClick={() => navigate("/dashboard/reminders")}
                            >
                                View All Reminders
                            </button>
                        </div>
                    </div>
                    {/* NEW: Medicine Availability Card */}
                    <div className="dashboard-card medicine-availability-card">
                        <h2 className="card-title">Medicine Availability</h2>
                        <div className="medicine-search-inputs">
                            <input
                                type="text"
                                placeholder="Medicine Name (e.g., Paracetamol)"
                                value={medicineSearchName}
                                onChange={(e) =>
                                    setMedicineSearchName(e.target.value)}
                                className="medicine-input"
                                aria-label="Medicine Name"
                            />
                            <input
                                type="text"
                                placeholder="Pincode (Not Used)"
                                value={medicineSearchPincode}
                                onChange={(e) =>
                                    setMedicineSearchPincode(e.target.value)}
                                className="pincode-input"
                                aria-label="Pincode"
                                disabled
                            />
                            <button
                                onClick={handleMedicineSearch}
                                className="search-button"
                                disabled={medicineSearchLoading}
                            >
                                {medicineSearchLoading
                                    ? "Searching..."
                                    : "Search"}
                            </button>
                        </div>
                        {medicineSearchError && (
                            <p className="error-message">
                                {medicineSearchError}
                            </p>
                        )}
                        {medicineSearchMessage && !medicineSearchLoading && (
                            <p className="search-message">
                                {medicineSearchMessage}
                            </p>
                        )}
                        {medicineSearchResults.length > 0 && (
                            <ul className="medicine-results-list">
                                {medicineSearchResults.map((result) => (
                                    // MODIFIED: The rendering logic now matches the ProductInDB model
                                    <li
                                        key={result.id}
                                        className="medicine-result-item"
                                    >
                                        <div className="pharmacy-info">
                                            <span className="pharmacy-name">
                                                {result.name}
                                            </span>
                                            <span className="pharmacy-address">
                                                {result.description ||
                                                    `Price: $${
                                                        result.price.toFixed(2)
                                                    }`}
                                            </span>
                                        </div>
                                        <span
                                            className={`stock-status ${
                                                result.in_stock
                                                    ? "in-stock"
                                                    : "out-of-stock"
                                            }`}
                                        >
                                            {result.in_stock
                                                ? "In Stock"
                                                : "Out of Stock"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {/* 3. ADDED BUTTON TO NAVIGATE TO THE PRODUCT AVAILABILITY PAGE */}
                        <div className="reminders-button-container">
                            <button
                                className="reminders-button"
                                onClick={() =>
                                    navigate("/dashboard/product-availability")}
                            >
                                Go to Product Database
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
export default DashboardHome;
