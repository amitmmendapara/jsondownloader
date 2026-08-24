require("dotenv").config({ path: "../.env" });
const mongoose = require('mongoose');

const connectDb = async () => {
    try {
        console.log("process.env.MONGO_URI", process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI, {
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
            readPreference: 'secondaryPreferred', // reads go to secondary if available
            writeConcern: { w: 'majority' },      // writes go to primary
        });
        console.log('✅ MongoDB connected');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDb;