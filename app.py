from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import os
import random
import string
import threading
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', os.urandom(24))

# ----------------------------------------------------
# DATABASE CONFIGURATION & RESILIENT CONNECTION
# ----------------------------------------------------
db_url = os.environ.get('DATABASE_URL')
if not db_url:
    # Resilient fallback: Use writeable /tmp/ directory in serverless Vercel, else local SQLite
    if os.environ.get('VERCEL') == '1':
        db_url = 'sqlite:////tmp/bharat_byte.db'
    else:
        db_url = 'sqlite:///bharat_byte.db'
else:
    # Neon/PostgreSQL requires psycopg2; enforce sslmode compatibility
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ----------------------------------------------------
# EMAIL / SMTP CONFIGURATION
# ----------------------------------------------------
app.config['MAIL_SERVER'] = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.environ.get('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
app.config['MAIL_USERNAME'] = os.environ.get('MAIL_USERNAME', 'aryankjhaa@gmail.com')
app.config['MAIL_PASSWORD'] = os.environ.get('MAIL_PASSWORD', 'qagy riub pxwa dzxv')
app.config['MAIL_SENDER'] = os.environ.get('MAIL_SENDER', 'BharatByte <contact@bharatbytesolutions.com>')

def send_email_thread(subject, recipient, body, is_html=False):
    try:
        msg = MIMEMultipart()
        msg['From'] = app.config['MAIL_SENDER']
        msg['To'] = recipient
        msg['Subject'] = subject

        if is_html:
            msg.attach(MIMEText(body, 'html'))
        else:
            msg.attach(MIMEText(body, 'plain'))

        # Clean Google app password formatting
        password = app.config['MAIL_PASSWORD'].replace(" ", "")

        server = smtplib.SMTP(app.config['MAIL_SERVER'], app.config['MAIL_PORT'])
        server.starttls()
        server.login(app.config['MAIL_USERNAME'], password)
        server.send_message(msg)
        server.quit()
        print(f"Email sent successfully to {recipient}")
    except Exception as e:
        print(f"Failed to send email: {e}")

def send_async_email(subject, recipient, body, is_html=False):
    thread = threading.Thread(target=send_email_thread, args=(subject, recipient, body, is_html))
    thread.start()

# ----------------------------------------------------
# DATABASE MODELS
# ----------------------------------------------------

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')  # 'user', 'lister', 'admin'
    otp_code = db.Column(db.String(10), nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    referral_code = db.Column(db.String(50), unique=True, nullable=True)
    referred_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reward_points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    listings = db.relationship('Listing', backref='lister', lazy=True, cascade="all, delete-orphan")
    reviews = db.relationship('Review', backref='user', lazy=True)
    favorites = db.relationship('Favorite', backref='user', lazy=True)
    reports = db.relationship('Report', backref='user', lazy=True)

class Listing(db.Model):
    __tablename__ = 'listings'
    id = db.Column(db.Integer, primary_key=True)
    lister_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)  # 'street_food', 'room', 'pg', 'hostel', 'flat', 'tiffin', 'laundry', 'medical', 'hospital', 'atm', 'other'
    price = db.Column(db.Float, nullable=False)
    address = db.Column(db.String(255), nullable=False)
    city = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    images = db.Column(db.Text, nullable=True)  # Comma separated URLs
    videos = db.Column(db.Text, nullable=True)  # Comma separated URLs
    
    # Accommodation Filters
    amenities = db.Column(db.Text, nullable=True)  # Comma separated: wifi, ac, parking, food, laundry, etc.
    gender_preference = db.Column(db.String(20), default='all')  # 'all', 'male', 'female', 'unisex'
    food_included = db.Column(db.Boolean, default=False)
    furnished_status = db.Column(db.String(30), default='unfurnished')  # 'furnished', 'semi-furnished', 'unfurnished'

    # Food Filters
    hygiene_rating = db.Column(db.Float, default=4.0)
    vendor_verified = db.Column(db.Boolean, default=False)
    is_trending = db.Column(db.Boolean, default=False)
    is_premium = db.Column(db.Boolean, default=False)

    views_count = db.Column(db.Integer, default=0)
    inquiries_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    reviews = db.relationship('Review', backref='listing', lazy=True, cascade="all, delete-orphan")
    favorites = db.relationship('Favorite', backref='listing', lazy=True, cascade="all, delete-orphan")
    inquiries = db.relationship('Inquiry', backref='listing', lazy=True, cascade="all, delete-orphan")
    reports = db.relationship('Report', backref='listing', lazy=True, cascade="all, delete-orphan")

class Review(db.Model):
    __tablename__ = 'reviews'
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False)  # 1 to 5
    comment = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Favorite(db.Model):
    __tablename__ = 'favorites'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Inquiry(db.Model):
    __tablename__ = 'inquiries'
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(30), default='pending')  # 'pending', 'contacted', 'resolved'
    type = db.Column(db.String(30), default='inquiry')  # 'inquiry', 'visit_schedule', 'booking'
    schedule_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Report(db.Model):
    __tablename__ = 'reports'
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('listings.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(30), default='pending')  # 'pending', 'resolved'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Notification(db.Model):
    __tablename__ = 'notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# ----------------------------------------------------
# DECORATORS & CORE AUTH HELPERS
# ----------------------------------------------------
def get_logged_user():
    if 'user_id' in session:
        return User.query.get(session['user_id'])
    return None

@app.context_processor
def inject_user_and_notifications():
    user = get_logged_user()
    notifs = []
    unread_count = 0
    if user:
        notifs = Notification.query.filter_by(user_id=user.id).order_by(Notification.created_at.desc()).limit(5).all()
        unread_count = Notification.query.filter_by(user_id=user.id, is_read=False).count()
    return dict(current_user=user, current_notifications=notifs, unread_notifications_count=unread_count)

# ----------------------------------------------------
# STANDARD RENDERING ROUTES
# ----------------------------------------------------
@app.route('/')
def index():
    featured = Listing.query.filter((Listing.is_premium == True) | (Listing.is_trending == True)).limit(6).all()
    popular_food = Listing.query.filter_by(category='street_food').order_by(Listing.hygiene_rating.desc()).limit(4).all()
    recommended_rooms = Listing.query.filter(Listing.category.in_(['room', 'pg', 'hostel'])).order_by(Listing.views_count.desc()).limit(4).all()
    
    # App statistics
    stats = {
        'listings': Listing.query.count(),
        'users': User.query.filter_by(role='user').count(),
        'listers': User.query.filter_by(role='lister').count(),
        'cities': db.session.query(Listing.city).distinct().count()
    }
    if stats['cities'] == 0:
        stats['cities'] = 1

    return render_template('index.html', featured=featured, popular_food=popular_food, recommended_rooms=recommended_rooms, stats=stats)

@app.route('/listings')
def listings():
    return render_template('listings.html')

@app.route('/listings/<int:listing_id>')
def listing_detail(listing_id):
    listing = Listing.query.get_or_404(listing_id)
    # Increment views count
    listing.views_count += 1
    db.session.commit()
    
    # Check if this listing is favorited by the logged in user
    is_fav = False
    user = get_logged_user()
    if user:
        is_fav = Favorite.query.filter_by(user_id=user.id, listing_id=listing.id).first() is not None

    similar_listings = Listing.query.filter(Listing.category == listing.category, Listing.id != listing.id).limit(3).all()
    return render_template('listing_detail.html', listing=listing, similar=similar_listings, is_favorited=is_fav)

@app.route('/auth')
def auth_page():
    if 'user_id' in session:
        return redirect(url_for('index'))
    return render_template('auth.html')

@app.route('/dashboard')
def dashboard():
    user = get_logged_user()
    if not user or user.role != 'lister':
        flash('Lister login required.', 'danger')
        return redirect(url_for('auth_page'))
    
    my_listings = Listing.query.filter_by(lister_id=user.id).all()
    
    # Calculate analytics
    total_views = sum(l.views_count for l in my_listings)
    total_inquiries = sum(l.inquiries_count for l in my_listings)
    
    # Get all inquiries for listings owned by this lister
    listing_ids = [l.id for l in my_listings]
    inquiries = Inquiry.query.filter(Inquiry.listing_id.in_(listing_ids)).order_by(Inquiry.created_at.desc()).all() if listing_ids else []
    
    return render_template('dashboard.html', listings=my_listings, total_views=total_views, total_inquiries=total_inquiries, inquiries=inquiries)

@app.route('/admin')
def admin_page():
    if session.get('admin_authenticated') != True:
        return render_template('admin_login.html')
    
    # Statistics
    stats = {
        'users': User.query.filter_by(role='user').count(),
        'listers': User.query.filter_by(role='lister').count(),
        'listings': Listing.query.count(),
        'reports': Report.query.filter_by(status='pending').count()
    }
    
    users = User.query.all()
    listings = Listing.query.all()
    reports = Report.query.order_by(Report.created_at.desc()).all()
    
    return render_template('admin_dashboard.html', stats=stats, users=users, listings=listings, reports=reports)

@app.route('/privacy-policy')
def privacy_policy():
    return render_template('privacy_policy.html')

@app.route('/terms-of-service')
def terms_of_service():
    return render_template('terms_of_service.html')

# ----------------------------------------------------
# REST API FOR AUTHENTICATION
# ----------------------------------------------------
@app.route('/api/auth/register', methods=['POST'])
def api_register():
    data = request.get_json() or {}
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'user')  # 'user' or 'lister'
    ref_by_code = data.get('referred_by')

    if not all([username, email, password]):
        return jsonify({'status': 'error', 'message': 'All fields are required.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'status': 'error', 'message': 'Email already registered.'}), 400

    # Create new user
    pass_hash = generate_password_hash(password)
    new_user = User(
        username=username,
        email=email,
        password_hash=pass_hash,
        role=role,
        is_verified=False
    )

    # Generate unique referral code
    new_user.referral_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    # Apply referral rewards
    if ref_by_code:
        referrer = User.query.filter_by(referral_code=ref_by_code).first()
        if referrer:
            new_user.referred_by = referrer.id
            referrer.reward_points += 100  # Give reward points
            new_user.reward_points += 50   # Welcome reward
            db.session.add(referrer)

    # Generate OTP Code
    otp = ''.join(random.choices(string.digits, k=6))
    new_user.otp_code = otp

    db.session.add(new_user)
    db.session.commit()

    # Send Simulated/Real OTP
    otp_subject = f"Verify Your Bharat Byte Account - {otp}"
    otp_body = f"""
    <h2>Welcome to Bharat Byte!</h2>
    <p>Please verify your email address to unlock discovery and accommodation bookings.</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #4f46e5;">{otp}</p>
    <p>Thank you!</p>
    """
    send_async_email(otp_subject, email, otp_body, is_html=True)

    # Automatically set session but mark unverified
    session['user_id'] = new_user.id
    session['username'] = new_user.username
    session['role'] = new_user.role

    return jsonify({
        'status': 'success', 
        'message': 'Registration successful! Verification OTP sent to email.',
        'user_id': new_user.id,
        'otp_preview': otp  # Send back for sandbox verification ease
    })

@app.route('/api/auth/verify-otp', methods=['POST'])
def api_verify_otp():
    data = request.get_json() or {}
    otp = data.get('otp')
    user_id = session.get('user_id')

    if not user_id:
        return jsonify({'status': 'error', 'message': 'Session expired. Please log in.'}), 401

    user = User.query.get(user_id)
    if not user:
        return jsonify({'status': 'error', 'message': 'User not found.'}), 404

    if user.otp_code == otp or otp == '123456': # Sandbox bypass code
        user.is_verified = True
        user.otp_code = None
        
        # Add welcome notification
        welcome_notif = Notification(
            user_id=user.id,
            title="Account Verified! 🎉",
            message=f"Welcome to Bharat Byte, {user.username}! Discover nearby food stalls, rentals, PGs, and lots more."
        )
        db.session.add(welcome_notif)
        db.session.commit()
        return jsonify({'status': 'success', 'message': 'Account verified successfully!'})

    return jsonify({'status': 'error', 'message': 'Invalid verification code.'}), 400

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return jsonify({'status': 'error', 'message': 'Email and Password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'status': 'error', 'message': 'Invalid email or password.'}), 400

    session['user_id'] = user.id
    session['username'] = user.username
    session['role'] = user.role

    return jsonify({
        'status': 'success',
        'message': 'Login successful!',
        'role': user.role,
        'is_verified': user.is_verified
    })

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'status': 'success', 'message': 'Logged out successfully!'})

# ----------------------------------------------------
# REST API FOR LISTINGS (CREATE, READ, FILTER, EDIT)
# ----------------------------------------------------
@app.route('/api/listings', methods=['GET'])
def api_get_listings():
    # Fetch all parameters for search & filters
    category = request.args.get('category')
    search = request.args.get('search')
    city = request.args.get('city')
    
    # Lat/Lng & Distance
    user_lat = request.args.get('latitude', type=float)
    user_lng = request.args.get('longitude', type=float)
    max_distance = request.args.get('distance', type=float)  # in km

    # Price / Rating / Verified
    max_price = request.args.get('price', type=float)
    min_rating = request.args.get('rating', type=float)
    verified_only = request.args.get('verified') == 'true'

    # Accommodations filters
    gender = request.args.get('gender')
    ac = request.args.get('ac') == 'true'
    wifi = request.args.get('wifi') == 'true'
    parking = request.args.get('parking') == 'true'
    food = request.args.get('food') == 'true'
    furnished = request.args.get('furnished')

    query = Listing.query

    # Apply standard text searches
    if category and category != 'all':
        query = query.filter_by(category=category)
    if city:
        query = query.filter(Listing.city.ilike(f"%{city}%"))
    if search:
        query = query.filter((Listing.title.ilike(f"%{search}%")) | (Listing.description.ilike(f"%{search}%")) | (Listing.address.ilike(f"%{search}%")))
    if max_price:
        query = query.filter(Listing.price <= max_price)
    if min_rating:
        query = query.filter(Listing.hygiene_rating >= min_rating)
    if verified_only:
        query = query.filter_by(vendor_verified=True)
    if gender and gender != 'all':
        query = query.filter(Listing.gender_preference == gender)
    if ac:
        query = query.filter(Listing.amenities.ilike("%ac%"))
    if wifi:
        query = query.filter(Listing.amenities.ilike("%wifi%"))
    if parking:
        query = query.filter(Listing.amenities.ilike("%parking%"))
    if food:
        query = query.filter_by(food_included=True)
    if furnished and furnished != 'all':
        query = query.filter_by(furnished_status=furnished)

    all_listings = query.all()

    # Apply distance filters mathematically (Haversine formula approximation)
    filtered = []
    for item in all_listings:
        distance = None
        if user_lat is not None and user_lng is not None:
            # Quick coordinate distance approximation: 1 degree latitude = 111km, 1 degree longitude = 111 * cos(lat)
            lat_diff = item.latitude - user_lat
            lng_diff = item.longitude - user_lng
            distance = ((lat_diff * 111) ** 2 + (lng_diff * 102) ** 2) ** 0.5
            
            if max_distance and distance > max_distance:
                continue

        # Build return dictionary
        fav_status = False
        logged_u = get_logged_user()
        if logged_u:
            fav_status = Favorite.query.filter_by(user_id=logged_u.id, listing_id=item.id).first() is not None

        item_dict = {
            'id': item.id,
            'title': item.title,
            'description': item.description,
            'category': item.category,
            'price': item.price,
            'address': item.address,
            'city': item.city,
            'latitude': item.latitude,
            'longitude': item.longitude,
            'images': item.images.split(',') if item.images else [],
            'videos': item.videos.split(',') if item.videos else [],
            'amenities': item.amenities.split(',') if item.amenities else [],
            'gender_preference': item.gender_preference,
            'food_included': item.food_included,
            'furnished_status': item.furnished_status,
            'hygiene_rating': item.hygiene_rating,
            'vendor_verified': item.vendor_verified,
            'is_trending': item.is_trending,
            'is_premium': item.is_premium,
            'distance': round(distance, 2) if distance is not None else None,
            'is_favorited': fav_status,
            'views': item.views_count
        }
        filtered.append(item_dict)

    # Sort premium first, then by trending, then by rating
    filtered.sort(key=lambda x: (x['is_premium'], x['is_trending'], x['hygiene_rating']), reverse=True)
    return jsonify({'status': 'success', 'data': filtered})

@app.route('/api/listings/create', methods=['POST'])
def api_create_listing():
    user = get_logged_user()
    if not user or user.role != 'lister':
        return jsonify({'status': 'error', 'message': 'Unauthorized Lister session.'}), 403

    data = request.get_json() or {}
    title = data.get('title')
    description = data.get('description')
    category = data.get('category')
    price = data.get('price', 0)
    address = data.get('address')
    city = data.get('city')
    lat = data.get('latitude', 23.2156)
    lng = data.get('longitude', 72.6369)
    images = data.get('images', '')
    videos = data.get('videos', '')
    amenities = data.get('amenities', '')
    gender = data.get('gender_preference', 'all')
    food = data.get('food_included') == True
    furnished = data.get('furnished_status', 'unfurnished')
    hygiene = data.get('hygiene_rating', 4.0)

    if not all([title, description, category, price, address, city]):
        return jsonify({'status': 'error', 'message': 'Missing essential fields.'}), 400

    new_list = Listing(
        lister_id=user.id,
        title=title,
        description=description,
        category=category,
        price=float(price),
        address=address,
        city=city,
        latitude=float(lat),
        longitude=float(lng),
        images=images,
        videos=videos,
        amenities=amenities,
        gender_preference=gender,
        food_included=food,
        furnished_status=furnished,
        hygiene_rating=float(hygiene)
    )

    db.session.add(new_list)
    db.session.commit()

    return jsonify({'status': 'success', 'message': 'Listing created successfully!', 'listing_id': new_list.id})

@app.route('/api/listings/<int:listing_id>/edit', methods=['POST'])
def api_edit_listing(listing_id):
    user = get_logged_user()
    listing = Listing.query.get_or_404(listing_id)
    
    if not user or (user.role != 'lister' and user.role != 'admin') or (user.role == 'lister' and listing.lister_id != user.id):
        return jsonify({'status': 'error', 'message': 'Unauthorized request.'}), 403

    data = request.get_json() or {}
    listing.title = data.get('title', listing.title)
    listing.description = data.get('description', listing.description)
    listing.category = data.get('category', listing.category)
    listing.price = float(data.get('price', listing.price))
    listing.address = data.get('address', listing.address)
    listing.city = data.get('city', listing.city)
    listing.latitude = float(data.get('latitude', listing.latitude))
    listing.longitude = float(data.get('longitude', listing.longitude))
    listing.images = data.get('images', listing.images)
    listing.videos = data.get('videos', listing.videos)
    listing.amenities = data.get('amenities', listing.amenities)
    listing.gender_preference = data.get('gender_preference', listing.gender_preference)
    listing.food_included = data.get('food_included') == True
    listing.furnished_status = data.get('furnished_status', listing.furnished_status)
    listing.hygiene_rating = float(data.get('hygiene_rating', listing.hygiene_rating))

    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Listing updated successfully!'})

@app.route('/api/listings/<int:listing_id>/delete', methods=['POST'])
def api_delete_listing(listing_id):
    user = get_logged_user()
    listing = Listing.query.get_or_404(listing_id)
    
    if not user or (user.role != 'lister' and user.role != 'admin') or (user.role == 'lister' and listing.lister_id != user.id):
        return jsonify({'status': 'error', 'message': 'Unauthorized request.'}), 403

    db.session.delete(listing)
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Listing deleted successfully!'})

@app.route('/api/listings/<int:listing_id>/promote', methods=['POST'])
def api_promote_listing(listing_id):
    user = get_logged_user()
    listing = Listing.query.get_or_404(listing_id)
    
    if not user or (user.role != 'lister' and user.role != 'admin') or (user.role == 'lister' and listing.lister_id != user.id):
        return jsonify({'status': 'error', 'message': 'Unauthorized request.'}), 403

    # Simulated payment: promote listing to premium/trending
    listing.is_premium = True
    listing.is_trending = True
    db.session.commit()
    return jsonify({'status': 'success', 'message': 'Listing promoted successfully! It is now boosted as Premium & Trending.'})

# ----------------------------------------------------
# REST API FOR INQUIRIES, FAVORITES, REVIEWS & REPORTS
# ----------------------------------------------------
@app.route('/api/listings/<int:listing_id>/inquire', methods=['POST'])
def api_post_inquiry(listing_id):
    listing = Listing.query.get_or_404(listing_id)
    data = request.get_json() or {}
    
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    message = data.get('message')
    inq_type = data.get('type', 'inquiry')  # 'inquiry', 'visit_schedule', 'booking'
    sched_str = data.get('schedule_date')

    if not all([name, email, phone, message]):
        return jsonify({'status': 'error', 'message': 'Please complete all required fields.'}), 400

    sched_date = None
    if sched_str:
        try:
            sched_date = datetime.strptime(sched_str, "%Y-%m-%dT%H:%M")
        except:
            sched_date = datetime.utcnow() + timedelta(days=2)

    user = get_logged_user()
    inq = Inquiry(
        listing_id=listing.id,
        user_id=user.id if user else None,
        name=name,
        email=email,
        phone=phone,
        message=message,
        type=inq_type,
        schedule_date=sched_date
    )

    listing.inquiries_count += 1
    db.session.add(inq)

    # Create listing notification to lister
    lister_notif = Notification(
        user_id=listing.lister_id,
        title=f"New Lead: {listing.title}",
        message=f"Received a new {inq_type} request from {name} ({phone}). View lister dashboard to details."
    )
    db.session.add(lister_notif)
    db.session.commit()

    # Send async email to Lister
    lister_email = User.query.get(listing.lister_id).email
    email_subject = f"Bharat Byte - New Marketplace Inquiry for {listing.title}"
    email_body = f"""
    <h2>You have a new inquiry!</h2>
    <p><strong>Listing:</strong> {listing.title}</p>
    <p><strong>Visitor:</strong> {name}</p>
    <p><strong>Email:</strong> {email} | <strong>Phone:</strong> {phone}</p>
    <p><strong>Type:</strong> {inq_type.upper()}</p>
    <p><strong>Scheduled Visit:</strong> {sched_date if sched_date else 'N/A'}</p>
    <p><strong>Message:</strong> "{message}"</p>
    <p>Log in to your Lister Dashboard to manage leads.</p>
    """
    send_async_email(email_subject, lister_email, email_body, is_html=True)

    return jsonify({'status': 'success', 'message': 'Inquiry submitted successfully! Lister notified.'})

@app.route('/api/inquiries/<int:inquiry_id>/status', methods=['POST'])
def api_update_inquiry_status(inquiry_id):
    user = get_logged_user()
    inq = Inquiry.query.get_or_404(inquiry_id)
    listing = Listing.query.get(inq.listing_id)

    if not user or (user.role != 'lister' and user.role != 'admin') or (user.role == 'lister' and listing.lister_id != user.id):
        return jsonify({'status': 'error', 'message': 'Unauthorized request.'}), 403

    data = request.get_json() or {}
    status = data.get('status')
    if status in ['pending', 'contacted', 'resolved']:
        inq.status = status
        db.session.commit()
        return jsonify({'status': 'success', 'message': f'Inquiry status updated to {status}.'})
    return jsonify({'status': 'error', 'message': 'Invalid status option.'}), 400

@app.route('/api/listings/<int:listing_id>/favorite', methods=['POST'])
def api_toggle_favorite(listing_id):
    user = get_logged_user()
    if not user:
        return jsonify({'status': 'error', 'message': 'Authentication required.'}), 401

    fav = Favorite.query.filter_by(user_id=user.id, listing_id=listing_id).first()
    if fav:
        db.session.delete(fav)
        db.session.commit()
        return jsonify({'status': 'success', 'action': 'removed', 'message': 'Removed from favorites.'})
    else:
        new_fav = Favorite(user_id=user.id, listing_id=listing_id)
        db.session.add(new_fav)
        db.session.commit()
        return jsonify({'status': 'success', 'action': 'added', 'message': 'Saved to favorites!'})

@app.route('/api/listings/<int:listing_id>/review', methods=['POST'])
def api_post_review(listing_id):
    user = get_logged_user()
    if not user:
        return jsonify({'status': 'error', 'message': 'Authentication required to review.'}), 401

    data = request.get_json() or {}
    rating = data.get('rating', type=int)
    comment = data.get('comment')

    if not rating or rating < 1 or rating > 5:
        return jsonify({'status': 'error', 'message': 'Rating must be between 1 and 5 stars.'}), 400

    # Ensure user hasn't already reviewed this listing
    existing = Review.query.filter_by(user_id=user.id, listing_id=listing_id).first()
    if existing:
        existing.rating = rating
        existing.comment = comment
        db.session.commit()
        msg = 'Review updated successfully!'
    else:
        rev = Review(
            listing_id=listing_id,
            user_id=user.id,
            rating=rating,
            comment=comment
        )
        db.session.add(rev)
        db.session.commit()
        msg = 'Review posted successfully!'

    # Recalculate listing average hygiene/overall rating
    listing = Listing.query.get(listing_id)
    reviews = Review.query.filter_by(listing_id=listing_id).all()
    avg_rating = sum(r.rating for r in reviews) / len(reviews)
    listing.hygiene_rating = round(avg_rating, 1)
    db.session.commit()

    return jsonify({'status': 'success', 'message': msg, 'new_rating': listing.hygiene_rating})

@app.route('/api/listings/<int:listing_id>/report', methods=['POST'])
def api_report_listing(listing_id):
    user = get_logged_user()
    if not user:
        return jsonify({'status': 'error', 'message': 'Authentication required to report listings.'}), 401

    data = request.get_json() or {}
    reason = data.get('reason')

    if not reason:
        return jsonify({'status': 'error', 'message': 'Reason is required to file a report.'}), 400

    report = Report(
        listing_id=listing_id,
        user_id=user.id,
        reason=reason
    )
    db.session.add(report)
    db.session.commit()

    return jsonify({'status': 'success', 'message': 'Listing reported. Admin team will review it within 24 hours.'})

# ----------------------------------------------------
# ADMIN DASHBOARD LOGIN & CORE APIs
# ----------------------------------------------------
@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    data = request.get_json() or {}
    pin = data.get('pin')
    expected_pin = os.environ.get('ADMIN_PIN', '1947')

    if pin == expected_pin:
        session['admin_authenticated'] = True
        session['role'] = 'admin'
        session['username'] = 'SuperAdmin'
        return jsonify({'status': 'success', 'message': 'Admin login successful!'})
    return jsonify({'status': 'error', 'message': 'Invalid secure Admin PIN.'}), 401

@app.route('/api/admin/logout', methods=['POST'])
def api_admin_logout():
    session.pop('admin_authenticated', None)
    if session.get('role') == 'admin':
        session.clear()
    return jsonify({'status': 'success', 'message': 'Admin session terminated.'})

@app.route('/api/admin/verify-listing/<int:listing_id>', methods=['POST'])
def api_admin_verify_listing(listing_id):
    if session.get('admin_authenticated') != True:
        return jsonify({'status': 'error', 'message': 'Unauthorized admin.'}), 403

    listing = Listing.query.get_or_404(listing_id)
    listing.vendor_verified = not listing.vendor_verified
    db.session.commit()
    
    # Notify Lister
    notif = Notification(
        user_id=listing.lister_id,
        title="Listing Verification Updated! 🛡️",
        message=f"Admin updated your listing status '{listing.title}' to " + ("VERIFIED" if listing.vendor_verified else "UNVERIFIED")
    )
    db.session.add(notif)
    db.session.commit()

    return jsonify({
        'status': 'success', 
        'message': f"Listing verification status toggled to {listing.vendor_verified}."
    })

@app.route('/api/admin/reports/<int:report_id>/resolve', methods=['POST'])
def api_admin_resolve_report(report_id):
    if session.get('admin_authenticated') != True:
        return jsonify({'status': 'error', 'message': 'Unauthorized admin.'}), 403

    report = Report.query.get_or_404(report_id)
    data = request.get_json() or {}
    action = data.get('action') # 'dismiss' or 'delete_listing'

    if action == 'delete_listing':
        listing = Listing.query.get(report.listing_id)
        if listing:
            # Create ban warning notification to lister
            warning = Notification(
                user_id=listing.lister_id,
                title="Listing Deleted by Admin ⚠️",
                message=f"Your listing '{listing.title}' was deleted due to multiple fake listing reports: '{report.reason}'."
            )
            db.session.add(warning)
            db.session.delete(listing)
        report.status = 'resolved'
        msg = "Listing removed and report resolved."
    else:
        report.status = 'resolved'
        msg = "Report dismissed successfully."

    db.session.commit()
    return jsonify({'status': 'success', 'message': msg})

# ----------------------------------------------------
# AI SIMULATION SERVICE ENGINES
# ----------------------------------------------------
@app.route('/api/ai/generate-description', methods=['POST'])
def api_ai_generate_description():
    data = request.get_json() or {}
    title = data.get('title', 'Cozy Living')
    category = data.get('category', 'room')
    price = data.get('price', '5000')
    amenities = data.get('amenities', '')
    gender = data.get('gender_preference', 'all')
    furnished = data.get('furnished_status', 'semi-furnished')

    # Highly creative heuristic description auto-builder
    intro_options = [
        f"Step into premium convenience at this amazing {category} in India!",
        f"Looking for comfort and modern amenities? Discover this premium {category} located at prime hotspots.",
        f"Welcome to your next home! This fully functional {category} fits perfectly for those seeking value and ease."
    ]
    
    body = f"This property offers '{title}' lifestyle at a highly attractive price point of just ₹{price}."
    
    details = ""
    if category in ['room', 'pg', 'hostel', 'flat', 'roommate']:
        details = f" Tailored specifically with comfort in mind, this listing accommodates '{gender.upper()}' residents in an attractive, {furnished} setup."
        if amenities:
            details += f" Loaded with modern, modern conveniences like {amenities} ensuring premium convenience."
    elif category == 'street_food':
        details = " Serving verified authentic street food that is curated perfectly for taste, hygiene, and outstanding speed."
    elif category == 'tiffin':
        details = " Offering healthy, homemade, hot meal deliveries right to your doorstep. Tailored for working professionals and students!"

    outro = " Verified, secure, and ready for viewings. Tap 'Book a Visit' or drop us a WhatsApp message to lock it down before it's gone!"

    ai_description = f"{random.choice(intro_options)}\n\n{body}{details}\n\n{outro}"
    return jsonify({'status': 'success', 'ai_description': ai_description})

@app.route('/api/ai/search-assistant', methods=['POST'])
def api_ai_search_assistant():
    data = request.get_json() or {}
    message = data.get('message', '').strip().lower()

    if not message:
        return jsonify({'status': 'error', 'message': 'Empty message.'}), 400

    # AI assistant parsing keyword simulation
    # Categories matching
    cat_match = 'all'
    if any(k in message for k in ['food', 'stall', 'chaat', 'dosa', 'momo', 'street', 'fast', 'eat', 'hungry']):
        cat_match = 'street_food'
    elif 'pg' in message:
        cat_match = 'pg'
    elif 'hostel' in message:
        cat_match = 'hostel'
    elif any(k in message for k in ['room', 'rent', 'flat', 'apartment', 'house', 'stay', 'living', 'accommodation']):
        cat_match = 'room'
    elif 'tiffin' in message:
        cat_match = 'tiffin'
    elif 'laundry' in message:
        cat_match = 'laundry'
    elif 'medical' in message or 'hospital' in message or 'doctor' in message:
        cat_match = 'medical'
    elif 'atm' in message:
        cat_match = 'atm'

    # Filter details
    gender_match = 'all'
    if 'girls' in message or 'female' in message or 'women' in message:
        gender_match = 'female'
    elif 'boys' in message or 'male' in message or 'men' in message:
        gender_match = 'male'

    # Price parsing heuristics
    price_match = None
    words = message.split()
    for i, word in enumerate(words):
        if word in ['under', 'below', 'less', '<', 'budget']:
            # Search next word for number
            for next_w in words[i+1:i+3]:
                # Clean up punctuation
                cleaned = ''.join(c for c in next_w if c.isdigit())
                if cleaned:
                    price_match = float(cleaned)
                    break
        elif 'k' in word and any(c.isdigit() for c in word):
            num = ''.join(c for c in word if c.isdigit())
            if num:
                price_match = float(num) * 1000

    # Amenities extraction
    ac_match = 'ac' in message
    wifi_match = 'wifi' in message or 'wi-fi' in message or 'internet' in message
    parking_match = 'parking' in message or 'garage' in message

    # Build response message
    ai_reply = "I've analyzed your request! "
    filters_applied = []
    
    if cat_match != 'all':
        filters_applied.append(f"Category: <strong>{cat_match.upper()}</strong>")
    if gender_match != 'all':
        filters_applied.append(f"Gender Preference: <strong>{gender_match.upper()}</strong>")
    if price_match:
        filters_applied.append(f"Price limit: <strong>₹{price_match}</strong>")
    if ac_match:
        filters_applied.append("Amenity: <strong>AC</strong>")
    if wifi_match:
        filters_applied.append("Amenity: <strong>WiFi</strong>")
    if parking_match:
        filters_applied.append("Amenity: <strong>Parking</strong>")

    if filters_applied:
        ai_reply += "I have applied the following discovery filters to your search view:<br><ul class='mb-2'>" + "".join(f"<li>{f}</li>" for f in filters_applied) + "</ul>"
    else:
        ai_reply += "I couldn't detect specific filters. Let me search all listings nearby. Let me know if you need to find PGs, Hostels, Street Food, or Services!"

    return jsonify({
        'status': 'success',
        'reply': ai_reply,
        'filters': {
            'category': cat_match,
            'gender': gender_match,
            'price': price_match,
            'ac': ac_match,
            'wifi': wifi_match,
            'parking': parking_match
        }
    })

# ----------------------------------------------------
# DATABASE SEEDING ON STARTUP
# ----------------------------------------------------
def seed_data():
    with app.app_context():
        # Build tables
        db.create_all()

        # Check if users already exist
        if User.query.count() == 0:
            # Create default admin user
            admin_hash = generate_password_hash("admin123")
            admin_user = User(
                username="SuperAdmin",
                email="admin@bharatbyte.com",
                password_hash=admin_hash,
                role="admin",
                is_verified=True,
                referral_code="BBADMIN"
            )
            
            # Create a mock lister
            lister_hash = generate_password_hash("lister123")
            mock_lister = User(
                username="Rajesh Kumar",
                email="rajesh@bharatbyte.com",
                password_hash=lister_hash,
                role="lister",
                is_verified=True,
                referral_code="BBRAJESH"
            )

            # Create a mock regular user
            user_hash = generate_password_hash("user123")
            mock_user = User(
                username="Amit Patel",
                email="amit@bharatbyte.com",
                password_hash=user_hash,
                role="user",
                is_verified=True,
                referral_code="BBAMIT"
            )

            db.session.add(admin_user)
            db.session.add(mock_lister)
            db.session.add(mock_user)
            db.session.commit()

            # Add Mock Listings
            listings_data = [
                {
                    'lister_id': mock_lister.id,
                    'title': 'Annapurna South Indian Corner',
                    'description': 'Famous for organic butter Masala Dosa, hot steamed Idlis, and crispy Vada. Served with fresh coconut chutney and spicy sambar. Fully verified hygienic preparation.',
                    'category': 'street_food',
                    'price': 80.0,
                    'address': 'Ch-3 Circle, Sector 21',
                    'city': 'Gandhinagar',
                    'latitude': 23.2156,
                    'longitude': 72.6369,
                    'images': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80',
                    'amenities': 'parking,food',
                    'gender_preference': 'all',
                    'food_included': True,
                    'furnished_status': 'unfurnished',
                    'hygiene_rating': 4.8,
                    'vendor_verified': True,
                    'is_trending': True,
                    'is_premium': True
                },
                {
                    'lister_id': mock_lister.id,
                    'title': 'Sneh Girls Premium PG & Hostel',
                    'description': 'Beautiful fully-furnished rooms designed exclusively for college girls and working women. High-speed unlimited WiFi, split ACs, refrigerator, home-cooked food included, 24/7 security cameras.',
                    'category': 'pg',
                    'price': 6500.0,
                    'address': 'Khabar Gali, Sector 15',
                    'city': 'Gandhinagar',
                    'latitude': 23.2201,
                    'longitude': 72.6410,
                    'images': 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80,https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
                    'amenities': 'wifi,ac,parking,laundry,food',
                    'gender_preference': 'female',
                    'food_included': True,
                    'furnished_status': 'furnished',
                    'hygiene_rating': 4.6,
                    'vendor_verified': True,
                    'is_trending': True,
                    'is_premium': True
                },
                {
                    'lister_id': mock_lister.id,
                    'title': 'Sai Tiffin Service & Hot Meals',
                    'description': 'Delicious and balanced homemade North Indian and Gujarati thalis. Prepared using quality ingredients and low oil. Free delivery to sectors 15, 16, 21, and 22.',
                    'category': 'tiffin',
                    'price': 120.0,
                    'address': 'Sector 16 Market Plaza',
                    'city': 'Gandhinagar',
                    'latitude': 23.2105,
                    'longitude': 72.6321,
                    'images': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
                    'amenities': 'food',
                    'gender_preference': 'all',
                    'food_included': True,
                    'furnished_status': 'unfurnished',
                    'hygiene_rating': 4.7,
                    'vendor_verified': True,
                    'is_trending': False,
                    'is_premium': False
                },
                {
                    'lister_id': mock_lister.id,
                    'title': 'Apex Co-living Hostel & Boys Stay',
                    'description': 'Modern, high-tech co-living boys hostel. Comes with premium quality bunk beds, study desks, laundry cleaning service, high speed WiFi, parking space, and recreational lounge. No restrictions.',
                    'category': 'hostel',
                    'price': 9000.0,
                    'address': 'Near InfoCity Road',
                    'city': 'Gandhinagar',
                    'latitude': 23.2321,
                    'longitude': 72.6512,
                    'images': 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
                    'amenities': 'wifi,ac,parking,laundry',
                    'gender_preference': 'male',
                    'food_included': False,
                    'furnished_status': 'furnished',
                    'hygiene_rating': 4.4,
                    'vendor_verified': False,
                    'is_trending': True,
                    'is_premium': False
                },
                {
                    'lister_id': mock_lister.id,
                    'title': 'Shree Ji Fast Food (Chaat & Momos)',
                    'description': 'Hot steamed and pan-fried veg momos, Delhi style Aloo Tikki chaat, and tangy Pani Puri. Everything is water purified, with excellent sanitation practices. Always crowded!',
                    'category': 'street_food',
                    'price': 60.0,
                    'address': 'G-4 Circle Food Stalls',
                    'city': 'Gandhinagar',
                    'latitude': 23.2285,
                    'longitude': 72.6450,
                    'images': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=800&q=80',
                    'amenities': 'parking',
                    'gender_preference': 'all',
                    'food_included': True,
                    'furnished_status': 'unfurnished',
                    'hygiene_rating': 4.5,
                    'vendor_verified': True,
                    'is_trending': True,
                    'is_premium': False
                },
                {
                    'lister_id': mock_lister.id,
                    'title': 'Apollo Pharmacy Sector 21',
                    'description': 'All essential medicines, health supplements, baby food, and surgical equipment. Open 24/7. Home delivery available for prescriptions.',
                    'category': 'medical',
                    'price': 0.0,
                    'address': 'Plot 432, Sector 21 Shopping Arcade',
                    'city': 'Gandhinagar',
                    'latitude': 23.2162,
                    'longitude': 72.6395,
                    'images': 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?auto=format&fit=crop&w=800&q=80',
                    'amenities': 'parking',
                    'gender_preference': 'all',
                    'food_included': False,
                    'furnished_status': 'unfurnished',
                    'hygiene_rating': 4.9,
                    'vendor_verified': True,
                    'is_trending': False,
                    'is_premium': False
                }
            ]

            for val in listings_data:
                item = Listing(**val)
                db.session.add(item)
            db.session.commit()

            # Seed simple reviews
            r1 = Review(listing_id=1, user_id=mock_user.id, rating=5, comment="Absolutely delicious dosa! The best in Gandhinagar Sector 21.")
            r2 = Review(listing_id=2, user_id=mock_user.id, rating=4, comment="Very clean rooms, fast wifi is a major plus.")
            db.session.add(r1)
            db.session.add(r2)
            db.session.commit()
            print("Database seeded with sample Bharat Byte listings!")

# Create tables and seed data automatically on startup / import
with app.app_context():
    try:
        seed_data()
    except Exception as e:
        print(f"Resilient database startup check warning: {e}")

if __name__ == '__main__':
    app.run(debug=True)
