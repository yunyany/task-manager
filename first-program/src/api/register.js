import request from "./request";

const postRegister = async (obj)=>{
    const {data} = await request.post('/register',obj)
    return data
}

export {postRegister}