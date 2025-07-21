# products.py
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from firebase_admin import firestore
import uuid

# Import the specific client type for type hinting
from google.cloud.firestore_v1.async_client import AsyncClient

router = APIRouter()

# --- Pydantic Models (No changes needed) ---
class ProductBase(BaseModel):
    name: str = Field(..., example="Pain Reliever 500mg")
    description: Optional[str] = Field(None, example="Fast-acting pain relief for headaches and body aches.")
    price: float = Field(..., gt=0, example=9.99)
    category: Optional[str] = Field(None, example="Over-the-Counter")
    in_stock: bool = Field(True, example=True)
    image_url: Optional[str] = Field(None, example="https://example.com/pain_reliever.jpg")

class ProductCreate(ProductBase):
    pass

class ProductUpdate(ProductBase):
    name: Optional[str] = None
    price: Optional[float] = None
    in_stock: Optional[bool] = None

class ProductInDB(ProductBase):
    id: str = Field(..., example="uniqueProductId123")
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None

    class Config:
        orm_mode = True
        arbitrary_types_allowed = True

# NEW: Pydantic model for Product Availability Request
class ProductAvailabilityRequest(BaseModel):
    product_name: str
    include_out_of_stock: Optional[bool] = False # Optional field to include out-of-stock items

# NEW: Pydantic model for Product Availability Response
class ProductAvailabilityResponse(BaseModel):
    product_name: str
    available_products: List[ProductInDB]
    message: str = "Product availability search completed."
    disclaimer: str = "This information reflects current database stock status and may not reflect real-time physical stock."


# --- Dependency Injection Setup ---

# This placeholder is overridden by main.py on startup
get_firestore_client_dependency = None

# NEW: Create a robust dependency getter for the endpoints to use.
# This function checks if the dependency was successfully injected from main.py.
def get_db_client():
    """
    Dependency function that checks if the Firestore client provider is available
    and then calls it to get the actual client instance.
    """
    if get_firestore_client_dependency is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firestore is not configured or available on the server."
        )
    return get_firestore_client_dependency()

# --- CRUD Endpoints (Updated to use the new `get_db_client` dependency) ---

@router.post("/products", response_model=ProductInDB, status_code=status.HTTP_201_CREATED)
async def create_product(product: ProductCreate, db: AsyncClient = Depends(get_db_client)):
    products_ref = db.collection('products')
    product_id = str(uuid.uuid4())
    product_data = product.dict(exclude_unset=True)
    product_data["created_at"] = firestore.SERVER_TIMESTAMP
    product_data["updated_at"] = firestore.SERVER_TIMESTAMP
    try:
        await products_ref.document(product_id).set(product_data)
        created_product_doc = await products_ref.document(product_id).get()
        if created_product_doc.exists:
            created_product_data = created_product_doc.to_dict()
            return ProductInDB(id=created_product_doc.id, **created_product_data)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve created product."
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating product: {e}"
        )


@router.get("/products/{product_id}", response_model=ProductInDB)
async def read_product(product_id: str, db: AsyncClient = Depends(get_db_client)):
    products_ref = db.collection('products')
    doc_ref = products_ref.document(product_id)
    try:
        doc = await doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        product_data = doc.to_dict()
        return ProductInDB(id=doc.id, **product_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving product: {e}"
        )


@router.get("/products", response_model=List[ProductInDB])
async def read_all_products(db: AsyncClient = Depends(get_db_client)):
    products_ref = db.collection('products')
    try:
        docs = []
        async for doc in products_ref.stream():
            product_data = doc.to_dict()
            docs.append(ProductInDB(id=doc.id, **product_data))
        return docs
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving products: {e}"
        )


@router.put("/products/{product_id}", response_model=ProductInDB)
async def update_product(product_id: str, product_update: ProductUpdate, db: AsyncClient = Depends(get_db_client)):
    products_ref = db.collection('products')
    doc_ref = products_ref.document(product_id)

    try:
        existing_doc = await doc_ref.get()
        if not existing_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        update_data = product_update.dict(exclude_unset=True)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields provided for update."
            )

        update_data["updated_at"] = firestore.SERVER_TIMESTAMP

        await doc_ref.update(update_data)

        updated_product_doc = await doc_ref.get()
        if updated_product_doc.exists:
            updated_product_data = updated_product_doc.to_dict()
            return ProductInDB(id=updated_product_doc.id, **updated_product_data)
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve updated product."
            )
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating product: {e}"
        )


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: str, db: AsyncClient = Depends(get_db_client)):
    products_ref = db.collection('products')
    doc_ref = products_ref.document(product_id)
    try:
        doc = await doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        await doc_ref.delete()
        # Per FastAPI docs, for a 204 response, the return value is not sent.
        # Returning None is clearer than returning a dictionary.
        return None
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting product: {e}"
        )

# NEW ENDPOINT: Check Product Availability
@router.post("/products/availability", response_model=ProductAvailabilityResponse)
async def check_product_availability(request: ProductAvailabilityRequest, db: AsyncClient = Depends(get_db_client)):
    """
    Checks the availability of a product by name in the Firestore database.
    Can optionally include out-of-stock items.
    """
    products_ref = db.collection('products')
    query = products_ref.where('name', '==', request.product_name)

    if not request.include_out_of_stock:
        query = query.where('in_stock', '==', True)

    available_products_list = []
    try:
        async for doc in query.stream():
            product_data = doc.to_dict()
            available_products_list.append(ProductInDB(id=doc.id, **product_data))

        message = ""
        if not available_products_list:
            message = f"No products found matching '{request.product_name}'."
            if not request.include_out_of_stock:
                message += " (Only in-stock items were searched)."
        else:
            message = f"Found {len(available_products_list)} product(s) matching '{request.product_name}'."

        return ProductAvailabilityResponse(
            product_name=request.product_name,
            available_products=available_products_list,
            message=message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking product availability: {e}"
        )

# NEW ENDPOINT FOR GLOB/WILDCARD SEARCH
@router.post("/products/search", response_model=ProductAvailabilityResponse)
async def search_products_glob(request: ProductAvailabilityRequest, db: AsyncClient = Depends(get_db_client)):
    """
    Checks the availability of products using a "starts-with" search on the product name.
    This provides a wildcard/glob-like functionality.
    """
    products_ref = db.collection('products')

    search_term = request.product_name
    # The \uf8ff character is a very high code point in Unicode.
    # Appending it to the search term creates an upper bound for the query,
    # effectively matching all strings that start with 'search_term'.
    end_term = search_term + u'\uf8ff'

    # Build the base query using the range operators for a "starts-with" search
    query = products_ref.where('name', '>=', search_term).where('name', '<=', end_term)

    if not request.include_out_of_stock:
        query = query.where('in_stock', '==', True)

    available_products_list = []
    try:
        async for doc in query.stream():
            product_data = doc.to_dict()
            available_products_list.append(ProductInDB(id=doc.id, **product_data))

        message = ""
        if not available_products_list:
            message = f"No products found starting with '{request.product_name}'."
            if not request.include_out_of_stock:
                message += " (Only in-stock items were searched)."
        else:
            message = f"Found {len(available_products_list)} product(s) starting with '{request.product_name}'."

        return ProductAvailabilityResponse(
            product_name=request.product_name,
            available_products=available_products_list,
            message=message
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error checking product availability: {e}"
        )
