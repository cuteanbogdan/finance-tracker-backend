const express = require('express');
const passport = require('passport');
const dotenv = require('dotenv');
const PORT = process.env.PORT || 5000;
const connectDB = require('./db');
require('./passport')(passport);
const cors = require('cors');

dotenv.config();
connectDB()

const app = express();

// Middleware
app.use(express.json());
app.use(passport.initialize());
app.use(cors());

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const transactionRoutes = require("./routes/transactions");
app.use("/api/transactions", transactionRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
