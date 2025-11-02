from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
fs = AsyncIOMotorGridFSBucket(db)

# Security
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class UserRole(BaseModel):
    role: str  # admin, order_uploader, pattern_maker, pattern_checker, general_user

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: str = "general_user"
    is_approved: bool = False
    is_active: bool = True
    is_email_verified: bool = False
    verification_code: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    google_sheet_link: str
    final_measurements_link: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    initial_pattern_date: Optional[str] = None
    initial_pattern_status: Optional[str] = None  # approved, rejected
    initial_patterns_done: bool = False  # Pattern Maker marks as done
    second_pattern_status: Optional[str] = None  # approved, rejected
    second_pattern_date: Optional[str] = None
    approved_pattern_status: Optional[str] = None  # approved, rejected
    approved_pattern_date: Optional[str] = None

class OrderCreate(BaseModel):
    order_number: str
    google_sheet_link: str

class OrderUpdate(BaseModel):
    order_number: Optional[str] = None
    google_sheet_link: Optional[str] = None

class Pattern(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    stage: str  # initial, second, approved
    slot: int  # 1-5
    file_id: str
    filename: str
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    user_id: str
    user_name: str
    message: str
    image_id: Optional[str] = None
    quoted_message_id: Optional[str] = None
    quoted_message_text: Optional[str] = None
    quoted_user_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatMessageCreate(BaseModel):
    message: str

class ApprovalAction(BaseModel):
    status: str  # approved, rejected
    stage: str  # second, approved

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    try:
        if not credentials:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user_doc.get('created_at'), str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

# Auth endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if this is the first user - make them admin and auto-approve
    user_count = await db.users.count_documents({})
    is_first_user = user_count == 0
    role = "admin" if is_first_user else "general_user"
    
    # Generate verification code
    import random
    verification_code = ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        role=role,
        is_approved=is_first_user,  # First user is auto-approved
        is_email_verified=is_first_user,  # First user is auto-verified for testing
        verification_code=verification_code if not is_first_user else None
    )
    
    user_doc = user.model_dump()
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    user_doc['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(user_doc)
    
    # TODO: Send verification email with code
    # For now, just log it
    if not is_first_user:
        logger.info(f"Verification code for {user_data.email}: {verification_code}")
    
    token = create_access_token({"sub": user.id})
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc or not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    del user_doc['password']
    user = User(**user_doc)
    
    token = create_access_token({"sub": user.id})
    return Token(access_token=token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# User management (Admin only)
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find({}, {"_id": 0, "password": 0}).to_list(1000)
    for u in users:
        if isinstance(u.get('created_at'), str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

@api_router.patch("/users/{user_id}/role", response_model=User)
async def update_user_role(user_id: str, role_data: UserRole, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_roles = ["admin", "order_uploader", "pattern_maker", "pattern_checker", "general_user"]
    if role_data.role not in valid_roles:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"role": role_data.role}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    return User(**user_doc)

@api_router.get("/users/{user_id}/approve", response_model=User)
async def approve_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_approved": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    return User(**user_doc)

@api_router.patch("/users/{user_id}/toggle-active", response_model=User)
async def toggle_user_active(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user_doc.get('is_active', True)
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": new_status}})
    
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    return User(**user_doc)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

@api_router.get("/dashboard/metrics")
async def get_dashboard_metrics(days: int = 30, current_user: User = Depends(get_current_user)):
    """Get dashboard metrics for specified time period"""
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    start_date_iso = start_date.isoformat()
    
    # Get orders in date range
    orders = await db.orders.find({
        "created_at": {"$gte": start_date_iso}
    }).to_list(10000)
    
    # Get all patterns for these orders
    order_ids = [o['id'] for o in orders]
    patterns = await db.patterns.find({
        "order_id": {"$in": order_ids}
    }).to_list(10000)
    
    # Calculate metrics
    total_orders = len(orders)
    total_patterns = len(patterns)
    
    # Count approved patterns (check order status)
    approved_count = 0
    for order in orders:
        if order.get('approved_pattern_status') == 'approved':
            approved_count += 1
    
    # Calculate average pattern making time
    pattern_making_times = []
    for order in orders:
        if order.get('initial_pattern_date'):
            try:
                created = datetime.fromisoformat(order['created_at'])
                first_pattern = datetime.fromisoformat(order['initial_pattern_date'])
                time_diff = (first_pattern - created).total_seconds() / 3600  # hours
                pattern_making_times.append(time_diff)
            except:
                pass
    
    avg_pattern_making_time = sum(pattern_making_times) / len(pattern_making_times) if pattern_making_times else 0
    
    # Calculate average approval time
    approval_times = []
    for order in orders:
        if order.get('initial_pattern_date') and order.get('initial_pattern_status'):
            try:
                first_pattern = datetime.fromisoformat(order['initial_pattern_date'])
                # Use second_pattern_date or approved_pattern_date for approval time
                approval_date = order.get('second_pattern_date') or order.get('approved_pattern_date')
                if approval_date:
                    approval = datetime.fromisoformat(approval_date)
                    time_diff = (approval - first_pattern).total_seconds() / 3600  # hours
                    approval_times.append(time_diff)
            except:
                pass
    
    avg_approval_time = sum(approval_times) / len(approval_times) if approval_times else 0
    
    return {
        "total_orders": total_orders,
        "total_patterns": total_patterns,
        "approved_patterns": approved_count,
        "avg_pattern_making_time_hours": round(avg_pattern_making_time, 2),
        "avg_approval_time_hours": round(avg_approval_time, 2),
        "date_range": {
            "start": start_date_iso,
            "end": end_date.isoformat(),
            "days": days
        }
    }

# Order endpoints
@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "order_uploader"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    order = Order(
        order_number=order_data.order_number,
        google_sheet_link=order_data.google_sheet_link,
        created_by=current_user.id
    )
    
    order_doc = order.model_dump()
    order_doc['created_at'] = order_doc['created_at'].isoformat()
    
    await db.orders.insert_one(order_doc)
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders(current_user: User = Depends(get_current_user)):
    # Check if user is approved (admins are always approved)
    if current_user.role != "admin" and not current_user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending admin approval")
    
    orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
    for o in orders:
        if isinstance(o.get('created_at'), str):
            o['created_at'] = datetime.fromisoformat(o['created_at'])
    return orders

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    # Check if user is approved (admins are always approved)
    if current_user.role != "admin" and not current_user.is_approved:
        raise HTTPException(status_code=403, detail="Your account is pending admin approval")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    return Order(**order)

@api_router.patch("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, order_data: OrderUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "order_uploader"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    update_data = {k: v for k, v in order_data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if isinstance(order.get('created_at'), str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    return Order(**order)

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Delete all patterns associated with this order
    patterns = await db.patterns.find({"order_id": order_id}).to_list(1000)
    for pattern in patterns:
        try:
            from bson import ObjectId
            await fs.delete(ObjectId(pattern['file_id']))
        except:
            pass  # Continue even if file deletion fails
    
    await db.patterns.delete_many({"order_id": order_id})
    
    # Delete all chats for this order
    await db.chats.delete_many({"order_id": order_id})
    
    # Delete the order
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": "Order deleted successfully"}

# Pattern endpoints
@api_router.post("/orders/{order_id}/patterns")
async def upload_pattern(
    order_id: str,
    stage: str = Form(...),
    slot: int = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Permission check
    if stage == "initial":
        if current_user.role not in ["admin", "pattern_maker"]:
            raise HTTPException(status_code=403, detail="Permission denied")
    elif stage in ["second", "approved"]:
        if current_user.role not in ["admin", "pattern_checker"]:
            raise HTTPException(status_code=403, detail="Permission denied")
    else:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    if slot < 1 or slot > 5:
        raise HTTPException(status_code=400, detail="Slot must be between 1 and 5")
    
    # Check if order exists
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Upload file to GridFS
    contents = await file.read()
    file_id = await fs.upload_from_stream(
        file.filename,
        io.BytesIO(contents),
        metadata={"order_id": order_id, "stage": stage, "slot": slot}
    )
    
    # Create pattern record
    pattern = Pattern(
        order_id=order_id,
        stage=stage,
        slot=slot,
        file_id=str(file_id),
        filename=file.filename,
        uploaded_by=current_user.id
    )
    
    pattern_doc = pattern.model_dump()
    pattern_doc['uploaded_at'] = pattern_doc['uploaded_at'].isoformat()
    
    await db.patterns.insert_one(pattern_doc)
    
    # Update order date if first pattern in stage
    if stage == "initial" and not order.get('initial_pattern_date'):
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"initial_pattern_date": datetime.now(timezone.utc).isoformat()}}
        )
    
    return {"message": "Pattern uploaded successfully", "pattern_id": pattern.id}

@api_router.get("/orders/{order_id}/patterns")
async def get_patterns(order_id: str, stage: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"order_id": order_id}
    if stage:
        query["stage"] = stage
    
    patterns = await db.patterns.find(query, {"_id": 0}).to_list(100)
    for p in patterns:
        if isinstance(p.get('uploaded_at'), str):
            p['uploaded_at'] = datetime.fromisoformat(p['uploaded_at'])
    return patterns

@api_router.get("/patterns/{pattern_id}/download")
async def download_pattern(pattern_id: str, current_user: User = Depends(get_current_user)):
    pattern = await db.patterns.find_one({"id": pattern_id}, {"_id": 0})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")
    
    try:
        from bson import ObjectId
        grid_out = await fs.open_download_stream(ObjectId(pattern['file_id']))
        contents = await grid_out.read()
        
        # Properly encode filename for Content-Disposition header
        import urllib.parse
        encoded_filename = urllib.parse.quote(pattern['filename'])
        
        return StreamingResponse(
            io.BytesIO(contents),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")

@api_router.delete("/patterns/{pattern_id}")
async def delete_pattern(pattern_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    pattern = await db.patterns.find_one({"id": pattern_id}, {"_id": 0})
    if not pattern:
        raise HTTPException(status_code=404, detail="Pattern not found")
    
    try:
        from bson import ObjectId
        # Delete file from GridFS
        await fs.delete(ObjectId(pattern['file_id']))
        # Delete pattern record
        await db.patterns.delete_one({"id": pattern_id})
        return {"message": "Pattern deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting pattern: {str(e)}")

# Approval endpoints
@api_router.post("/orders/{order_id}/approve")
async def approve_reject_order(order_id: str, action: ApprovalAction, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "pattern_checker"]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    if action.stage not in ["initial", "second", "approved"]:
        raise HTTPException(status_code=400, detail="Invalid stage")
    
    if action.status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    update_data = {}
    if action.stage == "initial":
        update_data["initial_pattern_status"] = action.status
        if not (await db.orders.find_one({"id": order_id})).get("initial_pattern_date"):
            update_data["initial_pattern_date"] = datetime.now(timezone.utc).isoformat()
    elif action.stage == "second":
        update_data["second_pattern_status"] = action.status
        update_data["second_pattern_date"] = datetime.now(timezone.utc).isoformat()
    else:
        update_data["approved_pattern_status"] = action.status
        update_data["approved_pattern_date"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"message": f"Order {action.status} successfully"}

# Chat endpoints
@api_router.post("/orders/{order_id}/chat")
async def send_message(
    order_id: str,
    message: str = Form(""),
    image: Optional[UploadFile] = File(None),
    quoted_message_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    # Validate that at least message or image is provided
    if not message.strip() and not image:
        raise HTTPException(status_code=400, detail="Message or image is required")
    
    # Check permissions for image upload
    if image and current_user.role not in ["admin", "pattern_maker", "pattern_checker"]:
        raise HTTPException(status_code=403, detail="Only Pattern Maker and Pattern Checker can upload images")
    
    image_id = None
    if image:
        contents = await image.read()
        image_id = str(await fs.upload_from_stream(
            image.filename,
            io.BytesIO(contents),
            metadata={"order_id": order_id, "type": "chat_image"}
        ))
    
    # Get quoted message if provided
    quoted_message_text = None
    quoted_user_name = None
    if quoted_message_id:
        quoted_msg = await db.chats.find_one({"id": quoted_message_id}, {"_id": 0})
        if quoted_msg:
            quoted_message_text = quoted_msg.get('message')
            quoted_user_name = quoted_msg.get('user_name')
    
    chat_msg = ChatMessage(
        order_id=order_id,
        user_id=current_user.id,
        user_name=current_user.name,
        message=message,
        image_id=image_id,
        quoted_message_id=quoted_message_id,
        quoted_message_text=quoted_message_text,
        quoted_user_name=quoted_user_name
    )
    
    chat_doc = chat_msg.model_dump()
    chat_doc['created_at'] = chat_doc['created_at'].isoformat()
    
    await db.chats.insert_one(chat_doc)
    return chat_msg

@api_router.get("/orders/{order_id}/chat")
async def get_messages(order_id: str, current_user: User = Depends(get_current_user)):
    messages = await db.chats.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for m in messages:
        if isinstance(m.get('created_at'), str):
            m['created_at'] = datetime.fromisoformat(m['created_at'])
    return messages

@api_router.get("/chat/images/{image_id}")
async def get_chat_image(image_id: str):
    # Public endpoint - images are served without auth
    # Access control is done at order level, not individual images
    try:
        from bson import ObjectId
        grid_out = await fs.open_download_stream(ObjectId(image_id))
        contents = await grid_out.read()
        
        return StreamingResponse(
            io.BytesIO(contents),
            media_type="image/jpeg"
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Image not found")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
