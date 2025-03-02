// Promise way of handling async functions
const asyncHandler = (requestHandler) => {
    return ((req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch(err => next(err))
    })
}

export {asyncHandler}


// Under the hood how this asyncHandler function works

// const asyncHandler = () => {}
// const asyncHandler = (func) => {() => {}}
// const asyncHandler = (func) => async () => {}



// handling async functions in a try catch block

const asyncHandler_2 = (fn) => async (req, res, next)=>{
    try {
        await fn(req, res, next)
    } catch (error) {
        res.status(error.code || 500).json({
            success : false,
            message : error.message
        })
    }
}