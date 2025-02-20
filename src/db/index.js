import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`,) // Connecting Mongoose to the database}`)
        
        console.log(`\n MongoDB connected: ${connectionInstance.connection.host}`)
    } catch (error) {
        console.error("Mongo DB connectio error ", error)
        process.exit(1)
    }
}

export default connectDB;