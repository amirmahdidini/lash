const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const DB_PATH = path.join(__dirname, 'data.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: });
}

// Initial default data if data.json doesn't exist
const initialData = {
    passwordHash: "amirmahdiisformine", // Plaintext check as per requirement
    disabledSlots: [], // array of objects { isoDate, timeSlot }
    services: [
        { id: 'classic', name: 'اکستنشن مژه کلاسیک', price: '650,000', duration: '2 ساعت', desc: 'کاشت تار به تار و طبیعی برای استفاده روزمره با ظاهری بسیار شیک.', image: '' },
        { id: 'volume', name: 'اکستنشن مژه والیوم', price: '850,000', duration: '2 ساعت', desc: 'حجم‌دهی چشمگیر با مژه‌های ابریشمی سبک بدون سنگینی روی پلک.', image: '' },
        { id: 'megavolume', name: 'اکستنشن مگا والیوم', price: '1,100,000', duration: '2.5 ساعت', desc: 'حجم فوق‌العاده مشکی و پرحجم مناسب برای مراسم و علاقه‌مندان نگاه‌های جذاب.', image: '' },
        { id: 'lift', name: 'لیفت و لمینت مژه', price: '500,000', duration: '1 ساعت', desc: 'تقویت و فر مژه طبیعی با مواد حاوی بوتاکس و آرگان.', image: '' },
        { id: 'repair', name: 'ترمیم مژه تخصصی', price: '450,000', duration: '1.5 ساعت', desc: 'پر کردن و فرم‌دهی مجدد مژه‌ها پس از ۳ الی ۴ هفته.', image: '' }
    ],
    bookings: [
        {
            id: 'LV-1001',
            name: 'سارا احمدی',
            phone: '09939006148',
            service: 'اکستنشن مژه والیوم',
            date: 'امروز',
            isoDate: new Date().toISOString().split('T')[0],
            time: '14:00 الی 16:00',
            notes: 'افکت گربه‌ای C اسپایک مد نظرم است',
            status: 'تأیید شده',
            createdAt: new Date().toLocaleDateString('fa-IR')
        }
    ]
};

function readData() {
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
        return initialData;
    }
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return initialData;
    }
}

function writeData(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'lash_vibe_secret_key_roya_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, 'public')));

// Multer setup for memory storage to crop with Sharp
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Auth Middleware
function checkAuth(req, res, next) {
    if (req.session && req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'عدم دسترسی. لطفاً وارد شوید.' });
    }
}

// --- PUBLIC ROUTES ---

// Get Public Initial Data (Services, Disabled Slots, Bookings for tracking)
app.get('/api/public-data', (req, res) => {
    const db = readData();
    res.json({
        services: db.services,
        disabledSlots: db.disabledSlots || []
    });
});

// Create Booking
app.post('/api/bookings', (req, res) => {
    const { name, phone, service, date, isoDate, time, notes } = req.body;
    if (!name || !phone || !service || !date || !time) {
        return res.status(400).json({ success: false, message: 'اطلاعات کامل نیست.' });
    }

    const db = readData();
    const randomCode = 'LV-' + Math.floor(1000 + Math.random() * 9000);
    const newBooking = {
        id: randomCode,
        name: name.trim(),
        phone: phone.trim(),
        service,
        date,
        isoDate: isoDate || new Date().toISOString().split('T')[0],
        time,
        notes: notes ? notes.trim() : '',
        status: 'در انتظار تأیید',
        createdAt: new Date().toLocaleDateString('fa-IR')
    };

    db.bookings.unshift(newBooking);
    writeData(db);

    res.json({ success: true, booking: newBooking });
});

// Search Bookings
app.get('/api/bookings/search', (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ success: true, results: [] });

    const db = readData();
    const results = db.bookings.filter(b => 
        b.id.toLowerCase().includes(q) || b.phone.includes(q)
    );
    res.json({ success: true, results });
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    const db = readData();
    if (password === db.passwordHash || password === 'amirmahdiisformine') {
        req.session.isAdmin = true;
        return res.json({ success: true, message: 'ورود موفقیت‌آمیز بود.' });
    }
    return res.status(401).json({ success: false, message: 'رمز عبور اشتباه است.' });
});

app.post('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/admin/check-auth', (req, res) => {
    if (req.session && req.session.isAdmin) {
        res.json({ authenticated: true });
    } else {
        res.json({ authenticated: false });
    }
});

// --- ADMIN PROTECTED ROUTES ---

// Get All Admin Data
app.get('/api/admin/dashboard', checkAuth, (req, res) => {
    const db = readData();
    res.json({
        bookings: db.bookings,
        services: db.services,
        disabledSlots: db.disabledSlots || []
    });
});

// Change Booking Status (Approve / Reject)
app.post('/api/admin/bookings/status', checkAuth, (req, res) => {
    const { id, status } = req.body;
    const db = readData();
    const booking = db.bookings.find(b => b.id === id);
    if (!booking) {
        return res.status(404).json({ success: false, message: 'سفارش پیدا نشد.' });
    }
    booking.status = status; // e.g. 'تأیید شده' or 'لغو شده'
    writeData(db);
    res.json({ success: true, booking });
});

// Toggle Manual Slot Lock (Close or Open specific slot on a date)
app.post('/api/admin/slots/toggle', checkAuth, (req, res) => {
    const { isoDate, timeSlot } = req.body;
    if (!isoDate || !timeSlot) {
        return res.status(400).json({ success: false, message: 'اطلاعات زمان کامل نیست.' });
    }

    const db = readData();
    if (!db.disabledSlots) db.disabledSlots = [];

    const existingIndex = db.disabledSlots.findIndex(s => s.isoDate === isoDate && s.timeSlot === timeSlot);
    if (existingIndex > -1) {
        // Unlock slot
        db.disabledSlots.splice(existingIndex, 1);
    } else {
        // Lock slot
        db.disabledSlots.push({ isoDate, timeSlot });
    }

    writeData(db);
    res.json({ success: true, disabledSlots: db.disabledSlots });
});

// Add or Edit Service with Image Upload (Auto-cropped to 500x500)
app.post('/api/admin/services', checkAuth, upload.single('image'), async (req, res) => {
    try {
        const { id, name, price, duration, desc } = req.body;
        const db = readData();

        let imageUrl = '';

        if (req.file) {
            const filename = `service-${Date.now()}.jpg`;
            const outputPath = path.join(UPLOADS_DIR, filename);

            // Resize and crop image to 500x500 exactly
            await sharp(req.file.buffer)
                .resize(500, 500, {
                    fit: 'cover',
                    position: 'center'
                })
                .toFormat('jpeg', { quality: 85 })
                .toFile(outputPath);

            imageUrl = `/uploads/${filename}`;
        }

        if (id) {
            // Edit existing service
            const service = db.services.find(s => s.id === id);
            if (service) {
                service.name = name || service.name;
                service.price = price || service.price;
                service.duration = duration || service.duration;
                service.desc = desc || service.desc;
                if (imageUrl) service.image = imageUrl;
            }
        } else {
            // Add new service
            const newId = 'service-' + Date.now();
            const newService = {
                id: newId,
                name,
                price,
                duration: duration || '2 ساعت',
                desc: desc || '',
                image: imageUrl || ''
            };
            db.services.push(newService);
        }

        writeData(db);
        res.json({ success: true, services: db.services });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'خطا در ذخیره‌سازی خدمت یا تصویر.' });
    }
});

// Delete Service
app.delete('/api/admin/services/:id', checkAuth, (req, res) => {
    const db = readData();
    db.services = db.services.filter(s => s.id !== req.params.id);
    writeData(db);
    res.json({ success: true, services: db.services });
});

// Route for admin panel page
app.get('/admin-panel-secret', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
    console.log(`Lash Vibe Server running on port ${PORT}`);
});
