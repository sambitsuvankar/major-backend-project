import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";

 // Steps to register a user
    // 1. Get the user data from the request body
    // 2. Validation - not empty
    // 3. Check if User is already exists : username, email
    // 4. check for images, check for avatar
    // 5. Upload them to cloudinary, avatar
    // 6. Create User object - create entry in DB
    // 7. Remove password and refresh token field from response.
    // 8. Check for user creation.
    // 9. return response.

const registerUser = asyncHandler(async(req, res) => {
    /* res.status(200).json({
         message : "chai aur code"
     })  */

        // Step : 1
    const { fullName, email, username, password } = req.body   // We get data from the request body
    console.log("Email :" , email)

       // Step : 2
    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ){
        throw new ApiError(400, "All fields are required")
    }
       // Step : 3
    const existingUser = await User.findOne({
        $or : [
            {username} , {email}
        ]
    })

    if(existingUser){
        throw new ApiError(400, "User with email or username already exists")
    }

       // Step : 4
    const avatarLocalPath = req.files?.avatar[0]?.path    // We get file information from req.files
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

         // Step : 5

    const avatar = await uploadOnCloudinary(avatarLocalPath)  // Uploading on cloudinary always takes time so we have to use "await" to wait for the response.
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

        // Step : 6
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username : username.toLowerCase()
    })

    // Step : 7 
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    // Step : 8
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while creating a user")
    }

    // Step : 9
    return res.status(201).json(new ApiResponse(201, "User created successfully", createdUser))
})

export {registerUser};