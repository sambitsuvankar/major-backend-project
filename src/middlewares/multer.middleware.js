import multer from 'multer';
import path from 'path';


const storage = multer.diskStorage({
    destination : function(req, file, cb) {
        cb(null, "./public/temp")
    },
    filename : function(req, file, cb) {
        cb(null, file.originalname)
    }
})

export const upload = multer({storage : storage})
// NOTE : We are using the multer.diskStorage() method to create a storage object that will be used by the multer middleware to save the uploaded files to the server.
// NOTE : The storage object has two properties destination and filename. The destination property specifies the directory where the uploaded files will be saved.
// NOTE : The filename property specifies the name of the uploaded file on the server.
// NOTE : We are using the multer() method to create a middleware function that will use the storage object to save the uploaded files to the server.
// NOTE : The upload middleware function will be used in the route where we are uploading the files to the server.
// NOTE : We are exporting the upload middleware function so that we can use it in the route where we are uploading the files to the server.
// NOTE : The upload middleware function will save the uploaded files to the public/temp directory on the server.