import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";


const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()  // We give accessToken to user in response body
        const refreshToken = user.generateRefreshToken() // We save the refresh Token in the database.

        user.refreshToken = refreshToken;

        await user.save({validateBeforeSave : false}) // we have used this {validateBeforeSave : false} because while saving the user into the database it will check all the required field. As we are saving only one field hence we pass this validate: false argument 

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and acccess token")
    }
}

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


// Steps to Login a user

    // 1. Get the data from req.body
    // 2. Decide how to log in the user via username or email
    // 3. Find the user.
    // 4. Password check
    // 5. Access and refresh token
    // 6. Send Cookie
const loginUser = asyncHandler(async(req, res) => {
    
    // Step-1
    const {email, username, password} = req.body

    // step-2
    if(!username && !email){
        throw new ApiError(400, "Username or email is required")
    }

    // Step-3
    const user = await User.findOne({
        $or : [{username}, {email}]
    })

    if(!user) {
        throw new ApiError(404, "User does not exists")
    }

    // step-4
    const isPasswordCorrect = await user.isPasswordCorrect(password)
    if(!isPasswordCorrect) {
        throw new ApiError(404, "Invalid user credentials")
    }

    // step-5
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    // If we want a new user Object without password and refreshToken we can make a database call here again
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    // Or We can simply remove the 'password' field from the existing user object.
    const updatedUser = Object.fromEntries(Object.entries(user).filter(([key]) => key != "password"))



    // step-6
    const options = {
        httpOnly : true,
        secure : true
    }

    return res.status(200).cookie("accessToken", accessToken, options)
                          .cookie("refreshToken", refreshToken, options)
                          .json(new ApiResponse(200, {
                            user : loggedInUser,
                            accessToken,
                            refreshToken
                          },
                          "User logged in Successfully"
                        ))

})


const logoutUser = asyncHandler(async(req, res) => {
        User.findByIdAndUpdate(req.user._id , 
            {
                $set : {
                    refreshToken : undefined
                },
            },
            {
                new : true
            }
                
        )

        const options = {
            httpOnly : true,
            secure : true
        }

        return res.status(200)
                  .clearCookie("accessToken", options)
                  .clearCookie("refreshToken", options)
                  .json(new ApiResponse(200, {}, "User logged out"))
})


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used")
        }
    
        const options = {
            httpOnly : true,
            secure : true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res.status(200)
                  .cookie("accessToken", accessToken, options)
                  .cookie("refreshToken", newRefreshToken, options)
                  .json(new ApiResponse(200,
                     {accessToken, refreshToken : newRefreshToken},
                     "Access Token Refreshed"
                    ))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})


const changeCurrentPassword = asyncHandler(async (req, res) => {
    // We get the old password from req.body
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400," Invalid Old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res.status(200)
              .json(new ApiResponse(200, {}, "Password Changed"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res.status(200)
              .json(new ApiResponse(200, req.user , "Current user fethced Successfully"))
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email} = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "All Fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id ,
        {
            $set: {  // Mondo DB aggregator syntax
                fullName : fullName,
                email : email
            }
        },
        {
            new : true     // this will return the new updated user Object after updating to DB
        }
    ).select("-password")   // This will return the new user object excluding the password field

    return res.status(200)
              .json(new ApiResponse(200, user, "Account details updated successfully"))
})


const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }
    console.log("avatarLocalPath :", avatarLocalPath)

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                avatar : avatar.url
            }
        },
        {
            new : true
        }
    ).select("-password")

    return res.status(200)
              .json(
                new ApiResponse(200,
                user,
                "Avatar Image updated"
              )
            )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing")
    }
    console.log("coverImageLocalPath :", coverImageLocalPath)

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading cover image on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : {
                coverImage : coverImage.url
            }
        },
        {
            new : true
        }
    ).select("-password")

    return res.status(200)
              .json(
                new ApiResponse(200,
                user,
                "Cover Image updated"
              )
            )
})

const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params  // we directly get it from the url

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match : {
                username : username?.toLowerCase()
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : '_id',
                foreignField : "channel",
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : '_id',
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        {
            $addFields : {  //"$addFields" will add new values to the original Object
                subscriberCount : {
                    $size : "$subscribers"   // "$size" will sums up entire number of "subscribers" fields which are filtered out from the above lookup pipeline
                },
                channelsSubscribedToCount : {
                    $size : "$subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if : {$in : [req.user?._id, "$subscribers.subscriber"]},  // This means if user._id present in "$subscribers.subscriber"
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            $project : {   // "$project : " is the final projection which will only send the selected fields
                fullName : 1,
                username : 1,
                subscriberCount : 1,
                channelsSubscribedToCount : 1,
                isSubscribed : 1,
                avatar : 1,
                coverImage : 1,
                email : 1
            }
        }
    ])   // Note: Aggregate pipeline always return array

    if(!channel?.length) {
        throw new ApiError(404, "Channel does not exists")
    }

    return res.status(200)
              .json(
                new ApiResponse(200, channel[0], "User channel fetched successfully")
              )

})


const getWatchHistory = asyncHandler(async(req, res) => {
    //req.user._id == String not ObjectId. 
    // To convert it into ObjectId we need mongoose
    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory",
                pipeline : [   // This is used for creating sub-pipeline
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {
                                        fullName : 1,
                                        username : 1,
                                        avatar : 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields : {
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
              .json(new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully"))
})

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};