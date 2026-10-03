import request from "./request";

const login = async (username, password) => {
    const { data } = await request.post('/login', { username, password })
    return data;
}

const getMe = async () => {
    const { data } = await request.get('/me')
    return data;
}




export { login, getMe };