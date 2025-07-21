// src/features/ProductManager.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../contexts/AuthContext"; // To get the user's ID token

// Define your API base URL
const API_BASE_URL = "http://localhost:8000/api/v1"; // Adjust if your backend is on a different host/port/prefix

const ProductManager = () => {
  const { currentUser } = useAuth(); // Get currentUser from AuthContext
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null); // For editing, holds the product being edited
  const [formInput, setFormInput] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    in_stock: true, // Default to true
    // image_url: "", // REMOVED: No longer needed
  });

  useEffect(() => {
    fetchProducts();
  }, [currentUser]); // Re-fetch products when currentUser changes (e.g., after login)

  const getAuthHeaders = async () => {
    if (!currentUser) {
      return {}; // No headers if no user
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

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        setLoading(false);
        return; // Don't fetch if no auth token
      }
      const response = await axios.get(`${API_BASE_URL}/products`, {
        headers,
      });
      setProducts(response.data);
    } catch (err) {
      console.error("Error fetching products:", err);
      setError(
        "Failed to fetch products. " +
          (err.response?.data?.detail || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormInput((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      setLoading(false);
      return;
    }

    try {
      const productData = {
        ...formInput,
        price: parseFloat(formInput.price), // Ensure price is a number
      };

      if (currentProduct) {
        // Update existing product
        await axios.put(
          `${API_BASE_URL}/products/${currentProduct.id}`,
          productData,
          { headers },
        );
        alert("Product updated successfully!");
      } else {
        // Add new product
        await axios.post(`${API_BASE_URL}/products`, productData, { headers });
        alert("Product added successfully!");
      }
      setIsModalOpen(false);
      setFormInput({
        name: "",
        description: "",
        price: "",
        category: "",
        in_stock: true,
        // image_url: "", // REMOVED
      });
      setCurrentProduct(null); // Clear current product after submission
      fetchProducts(); // Refresh the list
    } catch (err) {
      console.error("Error saving product:", err);
      setError(
        "Failed to save product. " +
          (err.response?.data?.detail || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setCurrentProduct(product);
    setFormInput({
      name: product.name,
      description: product.description || "", // Handle null for optional fields
      price: product.price,
      category: product.category || "",
      in_stock: product.in_stock,
      // image_url: product.image_url || "", // REMOVED
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    setLoading(true);
    setError(null);
    const headers = await getAuthHeaders();
    if (!headers.Authorization) {
      setLoading(false);
      return;
    }

    try {
      await axios.delete(`${API_BASE_URL}/products/${productId}`, { headers });
      alert("Product deleted successfully!");
      fetchProducts(); // Refresh the list
    } catch (err) {
      console.error("Error deleting product:", err);
      setError(
        "Failed to delete product. " +
          (err.response?.data?.detail || err.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setCurrentProduct(null); // Ensure no product is being edited
    setFormInput({
      name: "",
      description: "",
      price: "",
      category: "",
      in_stock: true,
      // image_url: "", // REMOVED
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProduct(null);
    setFormInput({
      name: "",
      description: "",
      price: "",
      category: "",
      in_stock: true,
      // image_url: "", // REMOVED
    });
  };

  if (loading && products.length === 0) {
    return <div className="loading-message">Loading products...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  return (
    <div className="product-manager-container">
      <h2 className="product-manager-title">Product Inventory Management</h2>

      <button className="add-product-button" onClick={openAddModal}>
        Add New Product
      </button>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{currentProduct ? "Edit Product" : "Add New Product"}</h3>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-group">
                <label htmlFor="name">Product Name:</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formInput.name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description:</label>
                <textarea
                  id="description"
                  name="description"
                  value={formInput.description}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="price">Price:</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  value={formInput.price}
                  onChange={handleInputChange}
                  step="0.01" // Allow decimal values
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="category">Category:</label>
                <input
                  type="text"
                  id="category"
                  name="category"
                  value={formInput.category}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group checkbox-group">
                <input
                  type="checkbox"
                  id="in_stock"
                  name="in_stock"
                  checked={formInput.in_stock}
                  onChange={handleInputChange}
                />
                <label htmlFor="in_stock">In Stock</label>
              </div>
              {
                /* REMOVED: Image URL input field
              <div className="form-group">
                <label htmlFor="image_url">Image URL:</label>
                <input
                  type="url"
                  id="image_url"
                  name="image_url"
                  value={formInput.image_url}
                  onChange={handleInputChange}
                />
              </div>
              */
              }
              <div className="form-actions">
                <button type="submit" disabled={loading}>
                  {loading
                    ? "Saving..."
                    : currentProduct
                    ? "Update Product"
                    : "Add Product"}
                </button>
                <button type="button" onClick={closeModal} disabled={loading}>
                  Cancel
                </button>
              </div>
              {error && <p className="error-message">{error}</p>}
            </form>
          </div>
        </div>
      )}

      <div className="product-list">
        {products.length === 0
          ? <p>No products found. Add a new product to get started!</p>
          : (
            <div className="product-cards-grid">
              {products.map((product) => (
                <div key={product.id} className="product-card">
                  {
                    /* REMOVED: Image display in product card
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="product-image"
                  />
                )}
                */
                  }
                  <h4 className="product-name">{product.name}</h4>
                  <p className="product-description">
                    {product.description || "No description"}
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
                  <div className="product-card-actions">
                    <button
                      className="edit-button"
                      onClick={() =>
                        handleEdit(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="delete-button"
                      onClick={() =>
                        handleDelete(product.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
};

export default ProductManager;
