-- Run this in Railway's PostgreSQL dashboard
CREATE TABLE shows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1536440136628-849c177e76a1',
    start_time TIMESTAMP NOT NULL,
    total_seats INTEGER NOT NULL,
    available_seats INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 4.5,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    show_id INTEGER REFERENCES shows(id),
    total_seats INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample data
INSERT INTO shows (name, description, category, start_time, total_seats, available_seats, price) VALUES
('Avengers: Endgame', 'Epic conclusion', 'Action', NOW() + INTERVAL '2 days', 100, 100, 350),
('Inception', 'Mind-bending thriller', 'Sci-Fi', NOW() + INTERVAL '1 day', 80, 80, 300);