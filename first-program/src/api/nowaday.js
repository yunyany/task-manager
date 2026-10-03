import request from "./request";

const getStats = async ()=>{
    const {data} = await request.get('/stats')
    return data
}

const postNowaday = async ()=>{
    const {data} = await request.post('/checkins')
    return data
}

const getTasklist = async (params)=>{
    const {data} = await request.get('/everyday',{params})
    return data
}

export {getStats,postNowaday,getTasklist}