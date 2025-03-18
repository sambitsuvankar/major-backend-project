import mongoose, {isValidObjectId, mongo} from "mongoose";
import { Video } from "../models/video.model.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { upload } from "../middlewares/multer.middleware.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";



const getAllVideos = asyncHandler(async(req,res) => {
    const {page = 1, limit = 10, query, sortBy, sortType = "desc", userId} = req.query

    const pipeline = []

    //for using full text based search you need to create a search index in mongo DB atlas.
    // You can include field mapping in search index eg: title, description as well
    // Field mapping specify which fields within your documents should be indexed for text search
    // This helps in searching only in title, descsription providing faster search result
    // Here the name of search index is "search-videos"

    // If someone tries to search videos we get the search texts from "req.query"
    if(query){
        pipeline.push({
            $search : {
                index : "search-videos",
                path : ["title", "description"]   // seach only on title & description
            }
        })
    }


    // Fetch videos on the basis of userId
    if(userId){
        if(!isValidObjectId(userId)){
            throw new ApiError(400, "Invalid UserId")
        }

        pipeline.push({
            $match : {
                owner : new mongoose.Types.ObjectId(userId)
            }
        })
    }


    // Fetch videos only that are set "isPublished" as true
    pipeline.push({
        $match : {
            isPublished : true
        }
    })

    // "sortBy" can be views, createdAt, duration
    // "sortType" can be ascending (1) or descending (-1)
    if(sortBy && sortType){
        pipeline.push(
            {
                $sort : {
                    [sortBy] : sortType === "asc" ? 1 : -1
                }
            }
        )
    }else {
        pipeline.push(
            {
                $sort : {
                    createdAt : -1
                }
            }
        )
    }

    pipeline.push(
        {
            $lookup : {
                from : "users",
                localField : "owner",
                foreignField : "_id",
                as : "ownerDetails",
                pipeline : [
                    {
                        $project : {
                            username : 1,
                            avatar : 1
                        }
                    }
                ]
            }
        },
        {
            $unwind : "$ownerDetails"
        }
    )

    const videoAggregate = await Video.aggregate(pipeline);

    const options = {
        page : parseInt(page, 10),
        limit : parseInt(limit, 10)
    }


    const video = await Video.aggregatePaginate(videoAggregate, options);

    return res.status(200)
              .json(new ApiResponse(200, video, "videos fetched successfully"))


})


// get video , upload to cloudinary, create video
const publishAVideo = asyncHandler(async(req, res) => {
    
    // We will get the title & description from the req.body
    // we will get the files from req.files
    // we will upload the files in cloudinary
    // then we will send the data to the database


    const {title, description} = req.body
    // console.log(title , "&", description)

    if(title.trim() === "" || description.trim() === ""){
        throw new ApiError(400, "All fields are required")
    }

    // console.log(req.files)
    const videoFileLocalPath = req.files?.videoFile[0]?.path
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path

    if(!videoFileLocalPath){
        throw new ApiError(400, "videoFileLocalPath is required")
    }
    if(!thumbnailLocalPath){
        throw new ApiError(400, "thumbnailLocalPath is required")
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!videoFile){
        throw new ApiError(400, "Video file not found")
    }
    if(!thumbnail){
        throw new ApiError(400, "thumbnail not found")
    }

    console.log("Video File", videoFile)

    const video = await Video.create({
        title,
        description,
        videoFile : {
            url : videoFile.url,
            public_id : videoFile.public_id
        },
        thumbnail : {
            url : thumbnail.url,
            public_id : thumbnail.public_id
        },
        duration : videoFile.duration,
        owner : req.user?._id,
        isPublished  : false
    })

    if(!video) {
        throw new ApiError(400, "Video is not uploaded")
    }

    console.log("Video", video)

    return res.status(200)
              .json(new ApiResponse(200, video))
})

const getVideoById = asyncHandler(async(req, res) => {
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Invalid videoId")
    }
    if(!isValidObjectId(req.user?._id)){
        throw new ApiError(400, "Invalid user id")
    }

    const video = await Video.aggregate(
        [
            {
                $match : {
                    _id : new mongoose.Types.ObjectId(videoId)
                }
            },
            {
                $lookup : {
                    from : "likes",
                    localField : "_id",
                    foreignField : "video",
                    as : "likes"
                }
            },
            {
                $lookup : {
                    from : "users",   // Here we are finding the user associated with the video (owner)
                    localField : "owner",
                    foreignField : "_id",
                    as : "owner",
                    pipeline : [
                        {
                            $lookup : {
                                from : "subscriptions",
                                localField : "_id",   // matching video owner's _id with num of channel
                                foreignField : "channel",
                                as : "subscribers"
                            }
                        },
                        {
                            $addFields : {
                                subscribersCount : {
                                    $size : "$subscribers"  // summation of total num of field $subscribers
                                },
                                isSubscribed : {
                                    $cond : {
                                        if : {
                                            $in : [
                                                req.user?._id, // Checking the cond if the logged in user's _id is in video onwer's subscriber list
                                                "$subscribers.subscriber"
                                            ]
                                        },
                                        then : true,  // If yes then user has subscribed to the video owner
                                        else : false  // If no then the user has not subscribed yet.
                                    }
                                }
                            }
                        },
                        {
                            $project : {
                                username : 1,
                                avatar : 1,
                                subscribersCount : 1,
                                isSubscribed : 1
                            }
                        }
                    ]
                }
            },
            {
                $addFields : {
                    likesCount : {
                        $size : "$likes"
                    },
                    owner : {
                        $first : "$owner"
                    },
                    isLiked : {
                        $cond : {
                            if : {
                                $in : [req.user?._id, "$likes.likedBy"]
                            },
                            then : true,
                            else : false
                        }
                    }
                }
            },
            {
                $project : {
                    videoFile : 1,
                    title : 1,
                    description : 1,
                    views : 1,
                    createdAt : 1,
                    duration : 1,
                    comments : 1,
                    owner : 1,
                    likesCount : 1,
                    isLiked : 1
                }
            }
        ]
    )

    if(!video) {
        throw new ApiError(500, "Failed to fetched the video")
    }

    // Increment views if video fetched successfully
    await Video.findByIdAndUpdate(videoId, {
            $inc: {   // increase the value 
                views : 1    /// if given (-1) then it will decrease the value.
            } 
        },
    // {
    //     new : true     // (This returns an updated document. )
    // }
    )

    // Add this video to our user watch history.
    await User.findByIdAndUpdate(req.user?._id, {
        $addToSet : {   //$addToSet is an update operator that adds a unique value to an array field (only if it doesn’t already exist). Unlike $push, it prevents duplicates.
            watchHistory : videoId
        }
    })

    return res.status(200)
              .json(
                new ApiResponse(200, video[0], "Video details fetched successfully")
              )
})

// Update video details like title, description, thumbnail
const updateVideo = asyncHandler(async (req, res) => {
    const {title, description} = req.body;
    const {videoId} = req.params

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Video Id is not valid")
    }

    if(!(title && description)){
        throw new ApiError(400, "Both title & description are required")
    }

    const video = Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "Video id not found")
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "You are not allowed to edit this video as you are not the owner of it")
    }

    const thumbnailToDelete = video.thumbnail.public_id

    const thumbnailLocalPath = req.files?.path

    if(!thumbnailLocalPath){
        throw new ApiError(400, "File path not found")
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!thumbnail){
        throw new ApiError(400, "Video not uploaded to cloudinary")
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set : {
                title,
                description,
                thumbnail : {
                    url : thumbnail.url,
                    public_id : thumbnail.public_id
                }
            }
        },
        {
            new : true
        }
    )

    if(!updatedVideo){
        throw new ApiError(400, "Video not updated Successfully")
    }

    if(updatedVideo){
        await deleteOnCloudinary(thumbnailToDelete)
    }

    return res.status(200)
              .json(200, updatedVideo, "Video updated successfully")

})

// Delete Video
const deleteVideo = asyncHandler(async(req, res) => {
    const { videoId } = req.params;

    if(!isValidObjectId(videoId)){
        throw new ApiError(400, "Video id is not valid")
    }
    
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(400, "Video not found")
    }

    if(video.owner.toString() !== req.user?._id.toString()){
        throw new ApiError(400, "You are not allowed to delete this video as you are not the owner")
    }

    const videoDeleted = await Video.findByIdAndDelete(video._id, {new : true})

    if(!videoDeleted){
        throw new ApiError(400, "Failed to delete the video. Please try again")
    }

    await deleteOnCloudinary(video?.thumbnail.public_id)
    await deleteOnCloudinary(video?.videoFile.public_id, "video") // specify video while deleting video

    // delete video likes
    await Like.deleteMany({
        video : videoId
    })
    // delete Video comments
    await Comment.deleteMany({
        video : videoId
    })

    return res.status(200)
              .json(new ApiResponse(200, {}, "Video deleted successfully"))
})

// Toggle Public status of a video
const togglePublishStatus = asyncHandler(async(req, res) => {
   const { videoId } = req.params;
   if(!isValidObjectId(videoId)){
        throw new ApiError(400, "videoId is not valid")
   }

   const video = await Video.findById(videoId)

   if(!video){
     throw new ApiError(400, "Failed to fetch the video from videoId. Please try again")
   }

   if(video?.owner.toString() !== req.user?._id.toString()){
    throw new ApiError(400, "You can't toggle the publish Button as you are not the owner")
   }

   const toggledVideo = await Video.findByIdAndUpdate(
        video._id,
        {
            $set : {
                isPublished : !video?.isPublished
            }
        },
        {
            new : true
        }
   )

   if(!toggledVideo){
    throw new ApiError(400, "Failed to toggle the video status. Please try again")
   }

   return res.status(200)
          .json(new ApiResponse(200, 
                                {isPublished : toggledVideo.isPublished},
                                "Video publish toggled successfully"
                            ))
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}