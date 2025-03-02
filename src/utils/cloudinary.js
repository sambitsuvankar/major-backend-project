import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

 // Configuration
 cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});


// Before uploading our files to cloudinary we need a middleware function that will 1st save the fils to the server and then apply some checks wheather the files are being uploaded to cloudinary or not.
// after successfully file upload to cloudinary we will delete the files from the server by delinking the files from the server.
// This middleware function will be used in the route where we are uploading the files to the cloudinary.

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;

        // Upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {resource_type : "auto"});

        // File has been uploaded successfully

        console.log("File is uploaded on cloudinary", response.url)
        fs.unlinkSync(localFilePath)  // remove the locally saved temporary file as the upload operation got Successful
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        return null
    }
}

export {uploadOnCloudinary}
// NOTE : We are exporting the uploadOnCloudinary function so that we can use it in the route where we are uploading the files to the cloudinary.
// NOTE : We are using the fs.unlinkSync() method to remove the locally saved temporary file as the upload operation got failed.
// NOTE : We are using the cloudinary.uploader.upload() method to upload the file on cloudinary. This method takes the local file path and the resource type as the argument.
// NOTE : The cloudinary.uploader.upload() method returns a promise which resolves to the response object containing the url of the uploaded file.
