// require('dotenv').config({path : './env})      // This is the conventional method to access the environmental variables through dotenv package but this way we are hampering the code consostency.


import dotenv from 'dotenv';
import connectDB from './db/index.js';
import app from './app.js';

dotenv.config({
    path : "./.env"
})

//Loads .env file contents into process.env by default. If DOTENV_KEY is present, it smartly attempts to load encrypted .env.vault file contents into process.env.

connectDB().then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running on port ${process.env.PORT}`)
    })
}).catch((error) => {
    console.error("MONGO DB connection failed !!! ", error)
})


/*

import mongoose from "mongoose";
import { DB_NAME } from "./constants";
import express from "express";
const app = express();

( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`,) // Connecting Mongoose to the database

        app.on("error", (error) => {    // here we can listen for errors in the app in conecting database through express
            console.error("Error connecting to database")
            throw error
        })

        app.listen(process.env.PORT, () => { // Listening to the port
            console.log(`Server is running on port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("ERROR : ", error)
        throw error
    }
})()

*/