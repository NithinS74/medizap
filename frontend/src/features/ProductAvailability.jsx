// src/features/ProductAvailability.jsx
import React, { useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext"; // To get the user's ID token
import "../styles/ProductAvailability.css"; // Assuming you will create a corresponding CSS file for styling

// Define your API base URL
const API_BASE_URL = "http://localhost:8000/api/v1"; // Adjust if needed

const ProductAvailability = () => {
  const { currentUser } = useAuth(); // Get currentUser from AuthContext

  // State for search inputs
  const [productName, setProductName] = useState("");
  const [includeOutOfStock, setIncludeOutOfStock] = useState(false);

  // State for API interaction
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Generates authentication headers with the Firebase ID token.
   */
  const getAuthHeaders = async () => {
    if (!currentUser) {
      setError("You must be logged in to perform this action.");
      return {};
    }
    try {
      const idToken = await currentUser.getIdToken();
      return { Authorization: `Bearer ${idToken}` };
    } catch (err) {
      console.error("Error getting ID token:", err);
      setError("Failed to authenticate. Please log in again.");
      return {};
    }
  };

  /**
   * Handles the form submission to search for products.
   */
  const handleProductSearch = async (e) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError("Please enter a product name to search.");
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResults(null);

    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      setLoading(false);
      return; // Stop if authentication fails
    }

    const requestBody = {
      product_name: productName,
      include_out_of_stock: includeOutOfStock,
    };

    try {
      // UPDATED: Point to the new '/products/search' endpoint for glob search
      const response = await axios.post(
        `${API_BASE_URL}/products/search`,
        requestBody,
        { headers },
      );
      setSearchResults(response.data);
    } catch (err) {
      console.error("Error searching for products:", err);
      setError(
        "Failed to perform search. " +
          (err.response?.data?.detail || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-availability-container">
      <h2 className="product-availability-title">Search Product Inventory</h2>

      <form onSubmit={handleProductSearch} className="availability-form">
        <div className="form-group">
          <label htmlFor="product_name">Product Name:</label>
          <input
            type="text"
            id="product_name"
            name="product_name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g., Pain Reliever"
            required
          />
        </div>
        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="include_out_of_stock"
            name="include_out_of_stock"
            checked={includeOutOfStock}
            onChange={(e) => setIncludeOutOfStock(e.target.checked)}
          />
          <label htmlFor="include_out_of_stock">
            Include Out of Stock Items
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {error && <div className="error-message">{error}</div>}

      {loading && <div className="loading-message">Loading results...</div>}

      {searchResults && (
        <div className="results-container">
          <p className="results-message">
            <strong>{searchResults.message}</strong>
          </p>

          {searchResults.available_products &&
              searchResults.available_products.length > 0
            ? (
              <div className="product-cards-grid">
                {searchResults.available_products.map((product) => (
                  <div key={product.id} className="product-card">
                    <h4 className="product-name">{product.name}</h4>
                    <p className="product-description">
                      {product.description || "No description available."}
                    </p>
                    <p className="product-price">
                      Price: ${product.price.toFixed(2)}
                    </p>
                    <p className="product-category">
                      Category: {product.category || "N/A"}
                    </p>
                    <p
                      className={`product-stock ${
                        product.in_stock ? "in-stock" : "out-of-stock"
                      }`}
                    >
                      {product.in_stock ? "In Stock" : "Out of Stock"}
                    </p>
                  </div>
                ))}
              </div>
            )
            : <p>No products to display based on your search.</p>}

          <p className="results-disclaimer">
            <em>Disclaimer: {searchResults.disclaimer}</em>
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductAvailability;
