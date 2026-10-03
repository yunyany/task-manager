import request from "./request";
// 获取任务列表
const getTasks = async (params) => {
    const { data } = await request.get('/tasks',{params})
    return data;
}
// 发布任务
const postTasks = async (obj) => {
    const { data } = await request.post('/tasks',obj)
    return data;
} 

const updateTasks = async (id,obj) => {
    const { data } = await request.put(`/tasks/${id}`,obj)
    return data;
}
const deleteTasks = async (id) => {
    const { data } = await request.delete(`/tasks/${id}`)
    return data;
}

export {getTasks, postTasks, updateTasks, deleteTasks}