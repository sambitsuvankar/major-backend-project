import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { deleteVideo, getAllVideos, getVideoById, publishAVideo, togglePublishStatus, updateVideo } from "../controllers/video.controller.js";


const videoRouter = Router();

// videoRouter.use(verifyJWT);  // This will apply verifyJWT middleware to all the routes in this file

videoRouter.route("/")
           .get(getAllVideos)
           .post(
            verifyJWT,
            upload.fields(
                [
                    {
                        name : "videoFile",
                        maxCount : 1
                    },
                    {
                        name : "thumbnail",
                        maxCount : 1
                    }
                ]
            ),
            publishAVideo
           )

videoRouter.route("/v/:videoId")
           .get(verifyJWT,getVideoById)
           .delete(verifyJWT, deleteVideo)
           .patch(verifyJWT, upload.single("thumbnail"), updateVideo)

videoRouter.route("toggle/publish/:videoId")
           .patch(verifyJWT, togglePublishStatus)

export default videoRouter