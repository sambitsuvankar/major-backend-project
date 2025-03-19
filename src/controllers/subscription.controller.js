import mongoose, { isValidObjectId } from "mongoose";
import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/apiError.js";
import {ApiResponse} from "../utils/apiResponse.js";
import { Subscription } from "../models/subscription.model.js";
import { request } from "express";

const toggleSubscription = asyncHandler(async(req, res)=> {
    const { channelId } = req.params;

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Channel Id not valid")
    }

    const isSubscribed = await Subscription.findOne({
        subscriber : req.user?._id,
        channel : channelId
    })

    if(isSubscribed){
        Subscription.findByIdAndDelete(isSubscribed._id);

        return res.status(200)
                  .json(new ApiResponse(200, {subscribed : false}, "Unsubscribed successfully"))
    }

    await Subscription.create({
        subscriber : req.user?._id,
        channel : channelId
    })

    return res.status(200)
              .json(new ApiResponse(200, {subscribed : true}, "Subscribed succcessfully"))
})

// Controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async(req, res)=> {
    let {channelId} = request.params

    if(!isValidObjectId(channelId)){
        throw new ApiError(400, "Channel Id not valid")
    }

    channelId = new mongoose.Types.ObjectId(channelId)

    const subscribers = await Subscription.aggregate([
        {
            $match : {
                channel : channelId
            }
        },
        {
            $lookup : {
                from : "users",
                localField : "subscriber",
                foreignField : "_id",
                as : "subscriber",
                pipeline : [
                    {
                        $lookup :{
                            from : "subscriptions",
                            localField : "_id",
                            foreignField : "channel",
                            as : "subscribedToSubscriber"
                        }
                    },
                    {
                        $addFields : {
                            subscribedToSubscriber : {  // To check if the channelId has subscribed back to it's subscribers or not
                                $cond : {
                                    if : {
                                        $in : [
                                            channelId,
                                            "$subscribedToSubscriber.subscriber"
                                        ]
                                    },
                                    then : true,
                                    else : false
                                }
                            },
                            subscriberCountOfSubscribers : {
                                $size : "$subscribedToSubscriber"
                            }
                        }
                    }
                ]
            }
        },
        {
            $addFields : {
                subscribersCountOfChannel : {
                    $size : "$subscriber"
                }
            }
        },
        {
            $unwind: "$subscriber",
        },
        {
            $project : {
                _id : 0, 
                subscribersCountOfChannel : 1,
                subscriber : {
                    _id : 1,
                    username : 1, 
                    fullName : 1,
                    avatar : 1,
                    subscribedToSubscriber : 1,
                    subscriberCountOfSubscribers : 1
                }
            }
        }
    ])

    return res.status(200)
              .json(new ApiResponse(200, subscribers, "Subscribers fetched successfully"))
})

// Controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async(req, res)=> {
    const {subscriberId} = req.params;

    if(!isValidObjectId(subscriberId)){
        throw new ApiError(400, "subscriberId is not valid")
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match : {
                subscriber  : new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup : {
                from : "users",
                localField : "channel",
                foreignField : "_id",
                as : "subscribedChannel",
                pipeline : [
                    {
                        $lookup : {
                            from : "videos",
                            localField : "_id",
                            foreignField : "owner",
                            as : "videos"
                        }
                    },
                    {
                        $addFields : {
                            latestVideo : {
                                $last : "$videos"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind : "$subscribedChannel"
        },
        {
            $project : {
                _id : 0,
                subscribedChannel : {
                    username : 1,
                    fullName : 1,
                    "avatar.url" : 1,
                    latestVideo : {
                        _id : 1,
                        "videoFile.url": 1,
                        "thumbnail.url": 1,
                        owner: 1,
                        title: 1,
                        description: 1,
                        duration: 1,
                        createdAt: 1,
                        views: 1
                    }
                }
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            subscribedChannels,
            "subscribed channels fetched successfully"
        )
    );
})

export {toggleSubscription, getSubscribedChannels, getUserChannelSubscribers}