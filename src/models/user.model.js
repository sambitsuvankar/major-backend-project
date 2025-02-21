import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const userSchema = new Schema(
    {
        username : {
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
            index : true    // If we want to search the user by username then we can use this index. It will enhace the search speed.
        },
        email : {
            type : String,
            required : true,
            unique : true,
            lowercase : true,
            trim : true,
        },
        fullName : {
            type : String,
            required : true,
            trim : true,
            index : true
        },
        avatar : {
            type : String,   // CLoudinaary URL
            required : true,
        },
        coverImage : {
            type : String   // Cloudinary URL
        },
        watchHistory : [
            {
                type : Schema.Types.ObjectId,
                ref : "Video"
            }
        ],
        password : {
            type : String,
            required : [true, "Password is required"],
        },
        refreshToken : {
            type : String
        }
        
    },
    {
        timestamps: true
    }
)

// "Pre" save hook to hash the password before saving the user to the database
userSchema.pre("save", async function(next) {
    if(this.isModified("password")) {               // If the password is modified then only hash the password .(isModified is a inbuilt mongoose method)
        this.password = bcrypt.hash(this.password, 8)
    }
    next()
})

// Method to compare the password
// NOTE : Schema methods are used to define instance methods. Instance methods must be added to the schema before compiling it with mongoose.model()
userSchema.methods.comparePassword = async function(plainPassword) {
    return await bcrypt.compare(plainPassword, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id : this._id,
            email : this.email,
            username : this.username,
            fullName : this.fullName,
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id : this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn : process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

// NOTE : JWT is a bearer token

export const User = mongoose.model('User', userSchema)