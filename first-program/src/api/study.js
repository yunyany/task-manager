import request from "./request";

const postTime = async (obj)=>{
    const {data} = await request.post('/time',obj)
    return data
}

const getTime = async ()=>{
    const {data} = await request.get('/allTime')
    return data
}


export {postTime,getTime}