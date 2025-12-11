

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// SQLite database setup
const db = new sqlite3.Database('./cinebook.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});



// Initialize database
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Create shows table
      db.run(`
        CREATE TABLE IF NOT EXISTS shows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          image_url TEXT DEFAULT 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&h=200&fit=crop',
          start_time TEXT NOT NULL,
          total_seats INTEGER NOT NULL,
          available_seats INTEGER NOT NULL,
          price REAL NOT NULL,
          rating REAL DEFAULT 4.5,
          is_active BOOLEAN DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create bookings table
      db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          show_id INTEGER,
          seat_numbers TEXT,
          user_name TEXT NOT NULL,
          user_email TEXT NOT NULL,
          total_seats INTEGER NOT NULL,
          total_amount REAL NOT NULL,
          status TEXT DEFAULT 'PENDING',
          expires_at TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          confirmed_at TEXT,
          FOREIGN KEY (show_id) REFERENCES shows(id)
        )
      `);

      // Check and insert sample data
      db.get('SELECT COUNT(*) as count FROM shows', (err, row) => {
        if (err) {
          console.error('Error checking shows:', err);
          reject(err);
          return;
        }

        if (row.count === 0) {
          const sampleShows = [
            ['Avengers: Endgame', 'The epic conclusion to the Infinity Saga where the Avengers take one final stand against Thanos.', 'Action', new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), 100, 100, 350, 4.8],
            ['Inception', 'A mind-bending thriller about dream theft and subconscious security.', 'Sci-Fi', new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), 80, 80, 300, 4.7],
            ['Dune: Part Two', 'Paul Atreides unites with the Fremen to seek revenge against those who destroyed his family.', 'Adventure', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), 120, 120, 400, 4.9],
            ['Interstellar', 'A team of explorers travel through a wormhole in space in an attempt to ensure humanitys survival.', 'Sci-Fi', new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(), 90, 90, 320, 4.6],
            ['The Dark Knight', 'Batman faces the Joker, a criminal mastermind who seeks to undermine order in Gotham City.', 'Action', new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), 110, 110, 280, 4.9]
          ];

          const stmt = db.prepare(`
            INSERT INTO shows (name, description, category, start_time, total_seats, available_seats, price, rating) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);

          sampleShows.forEach(show => {
            stmt.run(show, (err) => {
              if (err) console.error('Error inserting show:', err);
            });
          });

          stmt.finalize();
          console.log('✅ Sample shows inserted');
        }
        
        console.log('✅ Database initialized');
        resolve();
      });
    });
  });
}

// ✅ HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CineBook Pro Backend',
    timestamp: new Date().toISOString(),
    database: 'SQLite'
  });
});

// ✅ GET ALL SHOWS
app.get('/api/shows', (req, res) => {
  const { category, sort = 'rating' } = req.query;
  
  let query = `
    SELECT id, name, description, category, start_time as "startTime", 
           total_seats as "totalSeats", available_seats as "availableSeats", 
           price, rating, image_url as image
    FROM shows 
    WHERE is_active = 1
  `;
  
  const params = [];
  
  if (category && category !== '') {
    query += ' AND category = ?';
    params.push(category);
  }
  
  // Add sorting
  switch(sort) {
    case 'date':
      query += ' ORDER BY start_time';
      break;
    case 'price':
      query += ' ORDER BY price';
      break;
    default:
      query += ' ORDER BY rating DESC';
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching shows:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch shows'
      });
    }
    
    const shows = rows.map(show => ({
      ...show,
      startTime: show.startTime,
      duration: '2h 30m',
      availableSeats: show.availableSeats || 0
    }));
    
    res.json({ 
      success: true, 
      shows,
      total: shows.length
    });
  });
});

// ✅ GET SINGLE SHOW WITH SEAT MAP
app.get('/api/shows/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT id, name, description, category, start_time as "startTime", 
           total_seats as "totalSeats", available_seats as "availableSeats", 
           price, rating, image_url as image
    FROM shows 
    WHERE id = ? AND is_active = 1
  `, [id], (err, show) => {
    if (err) {
      console.error('Error fetching show:', err);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch show'
      });
    }
    
    if (!show) {
      return res.status(404).json({ 
        success: false, 
        error: 'Show not found' 
      });
    }
    
    // Get booked seats for this show
    db.all(`
      SELECT seat_numbers 
      FROM bookings 
      WHERE show_id = ? 
      AND status IN ('CONFIRMED', 'PENDING')
      AND expires_at > datetime('now')
    `, [id], (err, bookings) => {
      if (err) {
        console.error('Error fetching bookings:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch seat data'
        });
      }
      
      // Generate seat map
      const totalSeats = show.totalSeats;
      const rows = Math.ceil(totalSeats / 10);
      const seatMap = {};
      const bookedSeats = new Set();
      
      // Flatten booked seats
      bookings.forEach(booking => {
        const seats = JSON.parse(booking.seat_numbers);
        seats.forEach(seat => bookedSeats.add(seat));
      });
      
      for (let i = 0; i < rows; i++) {
        const rowLetter = String.fromCharCode(65 + i);
        seatMap[rowLetter] = [];
        
        for (let j = 1; j <= 10; j++) {
          const seatNumber = j + (i * 10);
          if (seatNumber > totalSeats) break;
          
          const seatId = `${rowLetter}${j}`;
          const isBooked = bookedSeats.has(seatId);
          
          seatMap[rowLetter].push({
            seatNumber: seatId,
            number: j,
            status: isBooked ? 'BOOKED' : 'AVAILABLE',
            price: show.price,
            isVip: ['A', 'B'].includes(rowLetter)
          });
        }
      }
      
      res.json({
        success: true,
        show: {
          ...show,
          startTime: show.startTime,
          seatMap
        }
      });
    });
  });
});

// ✅ BOOK SEATS
app.post('/api/bookings', (req, res) => {
  const { showId, seatNumbers, userEmail, userName } = req.body;
  
  if (!showId || !seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid request data' 
    });
  }
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // 1. Get show details
    db.get('SELECT available_seats, price FROM shows WHERE id = ?', [showId], (err, show) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ 
          success: false, 
          error: 'Database error' 
        });
      }
      
      if (!show) {
        db.run('ROLLBACK');
        return res.status(404).json({ 
          success: false, 
          error: 'Show not found' 
        });
      }
      
      const availableSeats = show.available_seats;
      const seatPrice = show.price;
      
      // 2. Check availability
      if (availableSeats < seatNumbers.length) {
        db.run('ROLLBACK');
        return res.status(409).json({ 
          success: false, 
          error: 'Not enough seats available' 
        });
      }
      
      // 3. Check for seat conflicts
      const placeholders = seatNumbers.map(() => '?').join(',');
      const query = `
        SELECT 1 FROM bookings 
        WHERE show_id = ? 
        AND seat_numbers LIKE ?
        AND status IN ('CONFIRMED', 'PENDING')
        AND expires_at > datetime('now')
      `;
      
      let hasConflict = false;
      
      const checkSeat = (index) => {
        if (index >= seatNumbers.length) {
          if (hasConflict) {
            db.run('ROLLBACK');
            res.status(409).json({ 
              success: false, 
              error: 'Some seats are already taken' 
            });
            return;
          }
          
          // All checks passed, proceed with booking
          // 4. Reduce available seats
          db.run(
            'UPDATE shows SET available_seats = available_seats - ? WHERE id = ?',
            [seatNumbers.length, showId],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ 
                  success: false, 
                  error: 'Failed to update seats' 
                });
              }
              
              // 5. Create booking
              const expiresAt = new Date(Date.now() + 120000);
              db.run(
                `INSERT INTO bookings 
                 (show_id, seat_numbers, user_name, user_email, total_seats, total_amount, status, expires_at) 
                 VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
                [
                  showId,
                  JSON.stringify(seatNumbers),
                  userName || 'Guest',
                  userEmail || 'guest@example.com',
                  seatNumbers.length,
                  seatNumbers.length * seatPrice,
                  expiresAt.toISOString()
                ],
                function(err) {
                  if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ 
                      success: false, 
                      error: 'Failed to create booking' 
                    });
                  }
                  
                  db.run('COMMIT');
                  
                  res.json({
                    success: true,
                    booking: {
                      id: this.lastID,
                      showId,
                      seatNumbers,
                      totalSeats: seatNumbers.length,
                      totalAmount: seatNumbers.length * seatPrice,
                      status: 'PENDING',
                      createdAt: new Date().toISOString(),
                      expiresAt: expiresAt.toISOString()
                    },
                    message: `Successfully reserved ${seatNumbers.length} seat(s). Confirm within 2 minutes.`
                  });
                }
              );
            }
          );
          return;
        }
        
        const seat = seatNumbers[index];
        db.get(
          'SELECT 1 FROM bookings WHERE show_id = ? AND seat_numbers LIKE ? AND status IN ("CONFIRMED", "PENDING") AND expires_at > datetime("now")',
          [showId, `%"${seat}"%`],
          (err, row) => {
            if (err) {
              db.run('ROLLBACK');
              res.status(500).json({ 
                success: false, 
                error: 'Database error' 
              });
              return;
            }
            
            if (row) {
              hasConflict = true;
            }
            
            checkSeat(index + 1);
          }
        );
      };
      
      checkSeat(0);
    });
  });
});

// ✅ CONFIRM BOOKING
app.post('/api/bookings/:id/confirm', (req, res) => {
  const { id } = req.params;
  
  db.run(
    `UPDATE bookings 
     SET status = 'CONFIRMED', confirmed_at = datetime('now') 
     WHERE id = ? 
     AND status = 'PENDING' 
     AND expires_at > datetime('now')`,
    [id],
    function(err) {
      if (err) {
        console.error('Confirm booking error:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to confirm booking' 
        });
      }
      
      if (this.changes === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Booking not found, expired, or already confirmed' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Booking confirmed successfully!' 
      });
    }
  );
});

// ✅ GET BOOKING STATUS
app.get('/api/bookings/:id', (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT b.*, s.name as show_name
     FROM bookings b
     JOIN shows s ON b.show_id = s.id
     WHERE b.id = ?`,
    [id],
    (err, booking) => {
      if (err) {
        console.error('Get booking error:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch booking' 
        });
      }
      
      if (!booking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }
      
      // Parse seat numbers
      if (booking.seat_numbers) {
        try {
          booking.seat_numbers = JSON.parse(booking.seat_numbers);
        } catch (e) {
          booking.seat_numbers = [];
        }
      }
      
      res.json({ 
        success: true, 
        booking 
      });
    }
  );
});

// ✅ CREATE SHOW (ADMIN)
app.post('/api/admin/shows', (req, res) => {
  const { name, description, category, startTime, totalSeats, price } = req.body;
  
  if (!name || !startTime || !totalSeats || !price) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields' 
    });
  }
  
  db.run(
    `INSERT INTO shows 
     (name, description, category, start_time, total_seats, available_seats, price) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      description || `${name} - An amazing cinematic experience`,
      category || 'Action',
      new Date(startTime).toISOString(),
      parseInt(totalSeats),
      parseInt(totalSeats),
      parseFloat(price)
    ],
    function(err) {
      if (err) {
        console.error('Create show error:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to create show' 
        });
      }
      
      res.json({ 
        success: true, 
        showId: this.lastID,
        message: `Show "${name}" created successfully` 
      });
    }
  );
});

// ✅ GET STATISTICS
app.get('/api/stats', (req, res) => {
  db.serialize(() => {
    db.get('SELECT COUNT(*) as total, SUM(total_seats) as total_seats FROM shows WHERE is_active = 1', (err, shows) => {
      if (err) {
        console.error('Stats error:', err);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch statistics' 
        });
      }
      
      db.get(
        `SELECT 
          COUNT(*) as total_bookings,
          COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed,
          COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed
         FROM bookings`,
        (err, bookings) => {
          if (err) {
            console.error('Stats error:', err);
            return res.status(500).json({ 
              success: false, 
              error: 'Failed to fetch statistics' 
            });
          }
          
          db.get(
            'SELECT COALESCE(SUM(total_amount), 0) as revenue FROM bookings WHERE status = "CONFIRMED"',
            (err, revenue) => {
              if (err) {
                console.error('Stats error:', err);
                return res.status(500).json({ 
                  success: false, 
                  error: 'Failed to fetch statistics' 
                });
              }
              
              res.json({
                success: true,
                shows: {
                  total: parseInt(shows.total) || 0,
                  totalSeats: parseInt(shows.total_seats) || 0
                },
                bookings: {
                  totalBookings: parseInt(bookings.total_bookings) || 0,
                  confirmed: parseInt(bookings.confirmed) || 0,
                  failed: parseInt(bookings.failed) || 0
                },
                revenue: {
                  total: parseFloat(revenue.revenue) || 0
                }
              });
            }
          );
        }
      );
    });
  });
});

// ✅ CLEANUP EXPIRED BOOKINGS
function cleanupExpiredBookings() {
  db.run(
    `UPDATE bookings 
     SET status = 'FAILED' 
     WHERE status = 'PENDING' 
     AND expires_at <= datetime('now')`,
    (err) => {
      if (err) {
        console.error('Cleanup error:', err);
      } else {
        console.log('✅ Cleaned up expired bookings');
      }
    }
  );
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredBookings, 5 * 60 * 1000);

// Initialize and start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✅ API Base URL: http://localhost:${PORT}/api`);
      console.log(`✅ Database file: cinebook.db`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();